import type {
    Response,
    NextFunction
} from "express";
import { verifyToken } from "../utils/token";
import { ErrorCodes } from "../utils/errorCodes";
import { AppError } from "../utils/AppError";
import { Session } from "../models/Session";
import { User } from "../models/User";

export async function requireAuth(req: any, res: Response, next: NextFunction) {
    try {
        let token = req.cookies?.access_token as string | undefined;

        if (!token && req.headers.authorization?.startsWith("Bearer ")) {
            token = req.headers.authorization.slice(7);
        }

        if (!token) {
            return next(new AppError(401, ErrorCodes.NO_TOKEN));
        }

        let payload;
        try {
            payload = verifyToken(token);
        }

        catch (jwtErr: any) {
            return next(jwtErr);
        }

        if (payload.typ !== "access") {
            return next(new AppError(401, ErrorCodes.WRONG_TOKEN_TYPE));
        }

        const session = await Session.findOne({
            sessionId: payload.sid,
            expiresAt: { $gt: new Date() },
        });

        if (!session) {
            return next(new AppError(401, ErrorCodes.SESSION_NOT_FOUND));
        }

        const user = await User.findById(payload.sub).select("-password").lean();
        if (!user) {
            return next(new AppError(401, ErrorCodes.UNAUTHENTICATED));
        }

        if ((user as any).isBanned) {
            return next(new AppError(403, ErrorCodes.ACCOUNT_DISABLED));
        }

        req.user = user;
        req.session = session;

        // fire-and-forget
        Session.updateOne(
            { _id: session._id },
            { lastActiveAt: new Date() }
        ).catch((err) => {
            console.warn("[requireAuth] touch failed:", err?.message);
        });

        return next();
    }

    catch (err) {
        return next(err);
    }
}

export async function optionalAuth(req: any, _res: Response, next: NextFunction) {
    try {
        const token = req.cookies?.access_token as string | undefined;
        if (!token)
            return next();

        const payload = verifyToken(token);
        if (payload.typ !== "access")
            return next();

        const session = await Session.findOne({
            sessionId: payload.sid,
            expiresAt: { $gt: new Date() },
        });
        if (!session)
            return next();

        const user = await User.findById(payload.sub).select("-password").lean();
        if (user && !(user as any).isBanned) {
            req.user = user;
            req.session = session;
        }
    }

    catch (err) {
        console.debug("[optionalAuth] ignored:", (err as Error)?.message);
    }

    return next();
}

export async function redirectProfile(req: any, res: Response, next: NextFunction) {
    try {
        const token = req.cookies?.access_token as string | undefined;
        if (!token) return next();

        /* -------- verify token -------- */
        let payload;
        try {
            payload = verifyToken(token);
        }

        catch {
            return next();
        }

        if (payload.typ !== "access") return next();

        /* -------- session check -------- */
        const session = await Session.findOne({
            sessionId: payload.sid,
            expiresAt: { $gt: new Date() }
        });
        if (!session)
            return next();

        /* -------- user check -------- */
        const user = await User.findById(payload.sub).lean();
        if (!user)
            return next();

        return res.redirect("/dashboard/profile");
    }

    catch (err) {
        console.debug("[redirectProfile] ignored:", (err as Error)?.message);
        return next();
    }
}

/**
 * Copyright (c) 2026 Sobhan Rasoulzadeh Asl (Sobhan-SRZA / Mr. Sinre)
 *
 * Licensed under the BSD 3-Clause License.
 * See the LICENSE file in the project root for license information.
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */