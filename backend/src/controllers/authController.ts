import {
    startSession,
    endSession,
    endAllSessions
} from "../services/sessionService";
import {
    AppError,
    Conflict,
    Unauthorized
} from "../utils/AppError";
import {
    registerSchema,
    loginSchema
} from "../validators/authValidator";
import {
    signAccessToken,
    verifyToken
} from "../utils/token";
import type {
    Request,
    Response
} from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { ErrorCodes } from "../utils/errorCodes";
import { validate } from "../utils/validate";
import { Session } from "../models/Session";
import { User } from "../models/User";
import { shouldBecomeDeveloper } from "../services/roleService";

/* ==================================================================
   Helpers
   ================================================================== */
const cookieOpts = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/"
};

function setAuthCookies(res: Response, access: string, refresh: string, remember: boolean) {
    const accessMaxAge = remember ? 7 * 24 * 60 * 60 * 1000 : 60 * 60 * 1000;
    const refreshMaxAge = 30 * 24 * 60 * 60 * 1000;

    res.cookie("access_token", access, { ...cookieOpts, maxAge: accessMaxAge });
    res.cookie("refresh_token", refresh, { ...cookieOpts, maxAge: refreshMaxAge });
}

function clearAuthCookies(res: Response) {
    res.clearCookie("access_token", cookieOpts);
    res.clearCookie("refresh_token", cookieOpts);
}

export function publicUser(u: any) {
    return {
        id: u._id,
        name: u.name,
        username: u.username,
        email: u.email,
        emailVerified: !!u.emailVerified,
        bio: u.bio || "",
        avatar: u.avatar || null,
        role: u.role || "user",
        createdAt: u.createdAt,

        pendingEmail: u.pendingEmail
            ? {
                newEmail: u.pendingEmail.newEmail,
                expiresAt: u.pendingEmail.expiresAt,
                requestedAt: u.pendingEmail.requestedAt
            }

            : null
    };
}


function getDeviceHints(req: Request) {
    const body = (req.body || {}) as Record<string, unknown>;

    return {
        fingerprint: typeof body.fingerprint === "string" ? body.fingerprint : undefined,
        deviceId: typeof body.deviceId === "string" ? body.deviceId : undefined
    };
}

/* ==================================================================
   REGISTER
   ================================================================== */
export const register = asyncHandler(async (req: Request, res: Response) => {
    const data = validate(registerSchema, req.body);

    const usernameLower = data.username.toLowerCase();
    const emailLower = data.email.toLowerCase();

    /* -------- چک تکراری بودن -------- */
    const [existingUsername, existingEmail] = await Promise.all([
        User.findOne({ usernameLower }).lean(),
        User.findOne({ email: emailLower }).lean()
    ]);

    if (existingUsername) {
        throw Conflict(ErrorCodes.USERNAME_TAKEN, undefined, { field: "username" });
    }
    if (existingEmail) {
        throw Conflict(ErrorCodes.EMAIL_TAKEN, undefined, { field: "email" });
    }

    /* -------- ساخت کاربر -------- */
    let user;
    try {
        /* ---------- نقش اولیه ---------- */
        // اگه هیچ developer وجود نداره، این کاربر اول developer می‌شه
        const isFirstDeveloper = await shouldBecomeDeveloper();

        user = await User.create({
            name: data.name,
            username: data.username,
            usernameLower,
            email: emailLower,
            password: data.password,
            role: isFirstDeveloper ? "developer" : "user",
            ...(isFirstDeveloper && {
                roleChangedAt: new Date(),
                roleChangeReason: "First registered user"
            })
        });

        if (isFirstDeveloper) {
            console.log(`🎉 First user registered as developer: ${user.email}`);
        }
    }

    catch (err: any) {
        if (err?.code === 11000) {
            const dupField = Object.keys(err.keyPattern || {})[0] || "";
            if (dupField === "usernameLower" || dupField === "username") {
                throw Conflict(ErrorCodes.USERNAME_TAKEN, undefined, { field: "username" });
            }

            if (dupField === "email") {
                throw Conflict(ErrorCodes.EMAIL_TAKEN, undefined, { field: "email" });
            }
        }

        throw err;
    }

    /* -------- ساخت/آپدیت سشن -------- */
    const hints = getDeviceHints(req);
    let sessionResult;

    try {
        sessionResult = await startSession(user._id, req, {
            ...hints,
            ttlDays: 7
        });
    }

    catch (err) {
        // rollback — کاربر رو پاک کن که دیتابیس تمیز بمونه
        await User.deleteOne({ _id: user._id }).catch(() => { });
        throw err;
    }

    setAuthCookies(res, sessionResult.access, sessionResult.refresh, true);

    res.status(201).json({
        ok: true,
        message: "حساب با موفقیت ساخته شد",
        user: publicUser(user)
    });
});

/* ==================================================================
   LOGIN — email OR username, case-insensitive
   ================================================================== */
export const login = asyncHandler(async (req: Request, res: Response) => {
    const data = validate(loginSchema, req.body);

    const raw = data.identifier.trim();
    const identifierLower = raw.toLowerCase();

    const user = await User.findOne({
        $or: [
            { email: identifierLower },
            { usernameLower: identifierLower }
        ],
    }).select("+password");

    if (!user) {
        throw Unauthorized(ErrorCodes.INVALID_CREDENTIALS);
    }

    const ok = await user.comparePassword(data.password);
    if (!ok) {
        throw Unauthorized(ErrorCodes.INVALID_CREDENTIALS);
    }

    /* -------- ساخت یا استفاده مجدد از سشن -------- */
    const hints = getDeviceHints(req);
    const { access, refresh, reused } = await startSession(user._id, req, {
        ...hints,
        ttlDays: data.remember ? 30 : 7
    });

    setAuthCookies(res, access, refresh, !!data.remember);

    res.json({
        ok: true,
        message: reused ? "ورود موفق (سشن قبلی تمدید شد)" : "ورود موفق",
        user: publicUser(user),
        reused
    });
});

/* ==================================================================
   LOGOUT — delete current session
   ================================================================== */
export const logout = asyncHandler(async (req: Request, res: Response) => {
    const refresh = req.cookies?.refresh_token as string | undefined;

    if (refresh) {
        try {
            const payload = verifyToken(refresh);
            // پاک کردن کامل — نه mark کردن
            await endSession(payload.sid, payload.sub);
        }

        catch {
            /* ignore invalid/expired token */
        }
    }

    clearAuthCookies(res);
    res.json({ ok: true, message: "خروج انجام شد" });
});

/* ==================================================================
   LOGOUT ALL — delete all sessions of the user
   ================================================================== */
export const logoutAll = asyncHandler(async (req: any, res: Response) => {
    if (!req.user) throw Unauthorized(ErrorCodes.UNAUTHENTICATED);

    const count = await endAllSessions(req.user._id);

    clearAuthCookies(res);
    res.json({
        ok: true,
        message: `از ${count} دستگاه خارج شدید`,
        count
    });
});

/* ==================================================================
   ME
   ================================================================== */
export const me = asyncHandler(async (req: any, res: Response) => {
    if (!req.user) throw Unauthorized(ErrorCodes.UNAUTHENTICATED);

    res.json({
        ok: true,
        user: publicUser(req.user),
        session: req.session
            ? {
                id: req.session._id,
                loginAt: req.session.loginAt,
                lastActiveAt: req.session.lastActiveAt,
                device: req.session.device,
                location: {
                    ip: req.session.location.ip,
                    city: req.session.location.city,
                    country: req.session.location.country
                }
            }
            : null
    });
});

/* ==================================================================
   REFRESH
   ================================================================== */
export const refresh = asyncHandler(async (req: Request, res: Response) => {
    const refreshToken = req.cookies?.refresh_token as string | undefined;
    if (!refreshToken) throw Unauthorized(ErrorCodes.NO_REFRESH_TOKEN);

    let payload;
    try {
        payload = verifyToken(refreshToken);
    }

    catch {
        throw Unauthorized(ErrorCodes.INVALID_REFRESH_TOKEN);
    }

    if (payload.typ !== "refresh") {
        throw Unauthorized(ErrorCodes.WRONG_TOKEN_TYPE);
    }

    const session = await Session.findOne({
        sessionId: payload.sid,
        refreshToken,
        expiresAt: { $gt: new Date() },
    }).select("+refreshToken");

    if (!session)
        throw Unauthorized(ErrorCodes.SESSION_NOT_FOUND);

    if (session.expiresAt < new Date())
        throw Unauthorized(ErrorCodes.SESSION_EXPIRED);

    const access = signAccessToken({ sub: payload.sub, sid: payload.sid });
    session.token = access;
    session.lastActiveAt = new Date();
    await session.save();

    res.cookie("access_token", access, { ...cookieOpts, maxAge: 60 * 60 * 1000 });
    res.json({ ok: true, access });
});

/* ==================================================================
   LIST SESSIONS
   ================================================================== */
export const listSessions = asyncHandler(async (req: any, res: Response) => {
    if (!req.user)
        throw Unauthorized(ErrorCodes.UNAUTHENTICATED);

    const sessions = await Session.find({
        user: req.user._id,
        expiresAt: { $gt: new Date() }
    })
        .sort({ lastActiveAt: -1 })
        .lean();

    res.json({
        ok: true,
        current: req.session?._id ?? null,
        sessions: sessions.map((s) => ({
            id: s._id,
            loginAt: s.loginAt,
            lastActiveAt: s.lastActiveAt,
            expiresAt: s.expiresAt,
            device: s.device,
            location: {
                ip: s.location.ip,
                city: s.location.city,
                country: s.location.country,
                isp: s.location.isp
            }
        }))
    });
});

/* ==================================================================
   REVOKE SESSION — delete a specific session
   ================================================================== */
export const revokeSession = asyncHandler(async (req: any, res: Response) => {
    if (!req.user)
        throw Unauthorized(ErrorCodes.UNAUTHENTICATED);

    const session = await Session.findOne({
        _id: req.params.id,
        user: req.user._id
    });

    if (!session) {
        throw new AppError(404, ErrorCodes.SESSION_NOT_FOUND);
    }

    const isCurrent =
        req.session && String(req.session._id) === String(session._id);

    // پاک کردن کامل
    await Session.deleteOne({ _id: session._id });

    if (isCurrent) {
        clearAuthCookies(res);
    }

    res.json({ ok: true, message: "سشن بسته شد" });
});

/**
 * Copyright (c) 2026 Sobhan Rasoulzadeh Asl (Sobhan-SRZA / Mr. Sinre)
 *
 * Licensed under the BSD 3-Clause License.
 * See the LICENSE file in the project root for license information.
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */