import type { Request, Response } from "express";

import {
    forgotPasswordSchema,
    loginSchema,
    registerSchema,
    resendPasswordResetSchema,
    resendVerifyEmailSchema,
    resetPasswordSchema,
    verifyEmailSchema
} from "../validators/authValidator";

import {
    endAllSessions,
    endSession,
    startSession
} from "../services/sessionService";

import {
    createVerificationCode,
    verifyCode
} from "../services/verificationService";

import { shouldBecomeDeveloper } from "../services/roleService";

import {
    AppError,
    Conflict,
    Unauthorized
} from "../utils/AppError";

import {
    signAccessToken,
    signEmailVerifyToken,
    signPasswordResetToken,
    verifyEmailVerifyToken,
    verifyPasswordResetToken,
    verifyToken
} from "../utils/token";

import { asyncHandler } from "../utils/asyncHandler";
import { ErrorCodes } from "../utils/errorCodes";
import { validate } from "../utils/validate";
import { Session } from "../models/Session";
import { User } from "../models/User";

/* ========================================================================== */
/* Authentication Helpers                                                     */
/* ========================================================================== */

/**
 * Shared options for authentication cookies.
 *
 * Cookies are HTTP-only to prevent direct access from client-side JavaScript.
 * Secure transport is enforced in production environments.
 */
const cookieOpts = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/"
};

/**
 * Sets access and refresh token cookies.
 *
 * @param res - Express response object.
 * @param access - Signed access token.
 * @param refresh - Signed refresh token.
 * @param remember - Whether the user selected the remember-me option.
 */
function setAuthCookies(
    res: Response,
    access: string,
    refresh: string,
    remember: boolean
): void {
    const accessMaxAge = remember
        ? 7 * 24 * 60 * 60 * 1000
        : 60 * 60 * 1000;

    const refreshMaxAge = 30 * 24 * 60 * 60 * 1000;

    res.cookie("access_token", access, {
        ...cookieOpts,
        maxAge: accessMaxAge
    });

    res.cookie("refresh_token", refresh, {
        ...cookieOpts,
        maxAge: refreshMaxAge
    });
}

/**
 * Clears authentication cookies from the response.
 *
 * The cookie options must match those used when setting the cookies.
 *
 * @param res - Express response object.
 */
function clearAuthCookies(res: Response): void {
    res.clearCookie("access_token", cookieOpts);
    res.clearCookie("refresh_token", cookieOpts);
}

/**
 * Serializes a user document into a safe public representation.
 *
 * Sensitive fields, including password hashes and internal authentication
 * data, are intentionally excluded.
 *
 * @param user - User document or compatible object.
 * @returns The public user representation.
 */
export function publicUser(user: any) {
    return {
        id: user._id,
        name: user.name,
        username: user.username,
        email: user.email,
        emailVerified: Boolean(user.emailVerified),
        bio: user.bio || "",
        avatar: user.avatar || null,
        role: user.role || "user",
        createdAt: user.createdAt,

        pendingEmail: user.pendingEmail
            ? {
                newEmail: user.pendingEmail.newEmail,
                previousEmail: user.pendingEmail.previousEmail,
                oldVerified: Boolean(user.pendingEmail.oldVerified),
                expiresAt: user.pendingEmail.expiresAt,
                requestedAt: user.pendingEmail.requestedAt
            }
            : null
    };
}

/**
 * Extracts optional device identification hints from the request body.
 *
 * Non-string values are ignored to prevent unexpected input types from
 * entering the session creation workflow.
 *
 * @param req - Express request object.
 * @returns Validated device identification hints.
 */
function getDeviceHints(req: Request) {
    const body = (req.body || {}) as Record<string, unknown>;

    return {
        fingerprint:
            typeof body.fingerprint === "string"
                ? body.fingerprint
                : undefined,

        deviceId:
            typeof body.deviceId === "string"
                ? body.deviceId
                : undefined
    };
}

/* ========================================================================== */
/* Email Verification — Resend Verification Code                              */
/* ========================================================================== */

/**
 * Resends an email verification code using a signed verification token.
 *
 * Intended for unauthenticated callers or clients that have lost session
 * state but still possess a valid verification token from registration.
 *
 * @route POST /auth/resend-verification
 * @access Public (requires a valid verification token)
 */
export const resendVerification = asyncHandler(
    async (req: Request, res: Response) => {
        const data = validate(resendVerifyEmailSchema, req.body);

        let payload;

        try {
            payload = verifyEmailVerifyToken(data.verifyToken);
        } catch {
            throw new AppError(
                401,
                ErrorCodes.INVALID_TOKEN,
                "The email verification token has expired or is invalid."
            );
        }

        const user = await User.findById(payload.sub).select(
            "email name emailVerified"
        );

        if (!user) {
            throw new AppError(
                400,
                ErrorCodes.INVALID_TOKEN,
                "The verification token does not match an active account."
            );
        }

        if (user.emailVerified) {
            throw new AppError(
                400,
                ErrorCodes.VALIDATION_ERROR,
                "Your email address has already been verified."
            );
        }

        await createVerificationCode({
            userId: user._id,
            purpose: "verify_email",
            targetEmail: user.email,
            userName: user.name,
            req,
            ttlMinutes: 10
        });

        // Generate a fresh token so the client receives an updated expiration.
        const verifyToken = signEmailVerifyToken(
            user._id.toString(),
            user.email
        );

        res.json({
            ok: true,
            message: `A new verification code has been sent to ${user.email}.`,
            email: user.email,
            verifyToken,
            expiresIn: 600
        });
    }
);

/* ========================================================================== */
/* Email Verification — Verify Email Address                                  */
/* ========================================================================== */

/**
 * Verifies a user's email address using a signed verification token
 * and a one-time verification code.
 *
 * Upon successful verification, any pending email-change request is cleared
 * and an authenticated session is created.
 *
 * @route POST /auth/verify-email
 * @access Public
 */
export const verifyEmail = asyncHandler(
    async (req: Request, res: Response) => {
        const data = validate(verifyEmailSchema, req.body);

        let payload;

        try {
            payload = verifyEmailVerifyToken(data.verifyToken);
        } catch {
            throw new AppError(
                401,
                ErrorCodes.INVALID_TOKEN,
                "The email verification token has expired or is invalid."
            );
        }

        const user = await User.findById(payload.sub);

        if (!user) {
            throw new AppError(404, ErrorCodes.UNAUTHENTICATED);
        }

        if (user.emailVerified) {
            throw new AppError(
                400,
                ErrorCodes.VALIDATION_ERROR,
                "Your email address has already been verified."
            );
        }

        await verifyCode({
            userId: user._id,
            purpose: "verify_email",
            code: data.code,
            targetEmail: user.email
        });

        // Mark the email address as verified and clear any pending change.
        user.emailVerified = true;
        user.emailVerifiedAt = new Date();
        user.pendingEmail = null;

        await user.save();

        // Create an authenticated session after successful verification.
        const hints = getDeviceHints(req);

        const { access, refresh } = await startSession(user._id, req, {
            ...hints,
            ttlDays: 7
        });

        setAuthCookies(res, access, refresh, true);

        console.log(
            `[EMAIL VERIFIED] user=${user._id} email=${user.email}`
        );

        res.json({
            ok: true,
            message: "Your email address has been verified successfully.",
            user: publicUser(user)
        });
    }
);

/* ========================================================================== */
/* Registration — Create Account                                              */
/* ========================================================================== */

/**
 * Registers a new user account.
 *
 * The first registered user is promoted to developer when the role service
 * determines that the initial developer account has not yet been established.
 *
 * A session is created after account creation. If session initialization fails,
 * the newly created user is deleted to prevent an incomplete registration.
 *
 * @route POST /auth/register
 * @access Public
 */
export const register = asyncHandler(
    async (req: Request, res: Response) => {
        const data = validate(registerSchema, req.body);

        const usernameLower = data.username.toLowerCase();
        const emailLower = data.email.toLowerCase();

        // Check for existing usernames and email addresses concurrently.
        const [existingUsername, existingEmail] = await Promise.all([
            User.findOne({ usernameLower }).lean(),
            User.findOne({ email: emailLower }).lean()
        ]);

        if (existingUsername) {
            throw Conflict(
                ErrorCodes.USERNAME_TAKEN,
                undefined,
                { field: "username" }
            );
        }

        if (existingEmail) {
            throw Conflict(
                ErrorCodes.EMAIL_TAKEN,
                undefined,
                { field: "email" }
            );
        }

        let user;

        try {
            // Determine whether this account should receive the developer role.
            const isFirstDeveloper = await shouldBecomeDeveloper();

            user = await User.create({
                name: data.name,
                username: data.username,
                usernameLower,
                email: emailLower,
                emailVerified: false,
                password: data.password,
                role: isFirstDeveloper ? "developer" : "user",

                ...(isFirstDeveloper && {
                    roleChangedAt: new Date(),
                    roleChangeReason: "First registered user"
                })
            });

            if (isFirstDeveloper) {
                console.log(
                    `First user registered as developer: ${user.email}`
                );
            }
        } catch (err: any) {
            // Translate MongoDB duplicate-key errors into application errors.
            if (err?.code === 11000) {
                const duplicateField =
                    Object.keys(err.keyPattern || {})[0] || "";

                if (
                    duplicateField === "usernameLower" ||
                    duplicateField === "username"
                ) {
                    throw Conflict(
                        ErrorCodes.USERNAME_TAKEN,
                        undefined,
                        { field: "username" }
                    );
                }

                if (duplicateField === "email") {
                    throw Conflict(
                        ErrorCodes.EMAIL_TAKEN,
                        undefined,
                        { field: "email" }
                    );
                }
            }

            throw err;
        }

        /* -------------------- Email Verification Setup -------------------- */

        let verifyToken: string | null = null;
        const verifyExpiresIn = 600; // 10 minutes, matching the verification code TTL.

        // Generate the token even if email delivery subsequently fails.
        try {
            verifyToken = signEmailVerifyToken(
                user._id.toString(),
                user.email
            );
        } catch (err: any) {
            console.warn(
                "[register] Failed to sign verification token:",
                err?.message
            );
        }

        try {
            await createVerificationCode({
                userId: user._id,
                purpose: "verify_email",
                targetEmail: user.email,
                userName: user.name,
                req,
                ttlMinutes: 10
            });
        } catch (err: any) {
            // Registration should succeed even if delivery fails.
            // The user can request another code from the email verification page.
            console.warn(
                "[register] Failed to send verification code:",
                err?.message
            );
        }

        /* -------------------- Session Initialization -------------------- */

        const hints = getDeviceHints(req);

        let sessionResult;

        try {
            sessionResult = await startSession(user._id, req, {
                ...hints,
                ttlDays: 7
            });
        } catch (err) {
            await User.deleteOne({ _id: user._id }).catch(() => { });
            throw err;
        }

        setAuthCookies(
            res,
            sessionResult.access,
            sessionResult.refresh,
            true
        );

        res.status(201).json({
            ok: true,
            message: "Your account has been created successfully.",
            user: publicUser(user),
            email: user.email,
            verifyToken,
            expiresIn: verifyExpiresIn
        });
    }
);

/* ========================================================================== */
/* Authentication — Login                                                     */
/* ========================================================================== */

/**
 * Authenticates a user using an email address or username.
 *
 * Identifiers are normalized to lowercase before lookup. Successful
 * authentication creates or reuses a session and sets authentication cookies.
 *
 * @route POST /auth/login
 * @access Public
 */
export const login = asyncHandler(
    async (req: Request, res: Response) => {
        const data = validate(loginSchema, req.body);

        const identifier = data.identifier.trim().toLowerCase();

        const user = await User.findOne({
            $or: [
                { email: identifier },
                { usernameLower: identifier }
            ]
        }).select("+password");

        if (!user) {
            throw Unauthorized(ErrorCodes.INVALID_CREDENTIALS);
        }

        const passwordMatches = await user.comparePassword(data.password);

        if (!passwordMatches) {
            throw Unauthorized(ErrorCodes.INVALID_CREDENTIALS);
        }

        if ((user as any).isBanned) {
            throw new AppError(403, ErrorCodes.ACCOUNT_DISABLED);
        }

        // Create a new session or reuse an eligible existing session.
        const hints = getDeviceHints(req);

        const { access, refresh, reused } = await startSession(
            user._id,
            req,
            {
                ...hints,
                ttlDays: data.remember ? 30 : 7
            }
        );

        setAuthCookies(res, access, refresh, Boolean(data.remember));

        res.json({
            ok: true,
            message: reused
                ? "Login successful. The existing session has been renewed."
                : "Login successful.",
            user: publicUser(user),
            reused
        });
    }
);

/* ========================================================================== */
/* Password Recovery — Request Reset Code                                     */
/* ========================================================================== */

/**
 * Initiates password recovery by generating a reset token and requesting
 * a one-time verification code when the supplied email belongs to a user.
 *
 * A consistent response is returned regardless of whether the account exists
 * to reduce account enumeration risks.
 *
 * @route POST /auth/forgot-password
 * @access Public
 */
export const forgotPassword = asyncHandler(
    async (req: Request, res: Response) => {
        const data = validate(forgotPasswordSchema, req.body);

        const user = await User.findOne({
            email: data.email
        }).select("email name");

        let resetToken: string;
        const expiresIn = 900;

        if (user) {
            try {
                await createVerificationCode({
                    userId: user._id,
                    purpose: "reset_password",
                    targetEmail: user.email,
                    userName: user.name,
                    req,
                    ttlMinutes: 15
                });
            } catch (err: any) {
                // Avoid revealing delivery or rate-limit failures to the caller.
                console.warn(
                    "[forgotPassword] Code delivery failed:",
                    err?.message
                );
            }

            resetToken = signPasswordResetToken(
                user._id.toString(),
                user.email
            );
        } else {
            // Generate a token for a nonexistent account to preserve
            // a consistent response structure.
            const crypto = await import("crypto");
            const fakeSubject = crypto.randomBytes(12).toString("hex");

            resetToken = signPasswordResetToken(
                fakeSubject,
                data.email
            );

            // Add a small randomized delay to reduce timing discrepancies.
            await new Promise((resolve) => {
                setTimeout(resolve, 80 + Math.random() * 120);
            });
        }

        res.json({
            ok: true,
            message:
                "If an account with this email exists, a password recovery code will be sent.",
            email: data.email,
            resetToken,
            expiresIn
        });
    }
);

/* ========================================================================== */
/* Password Recovery — Reset Password                                         */
/* ========================================================================== */

/**
 * Verifies a password reset token and one-time code, updates the password,
 * and revokes all existing sessions for the account.
 *
 * The new password must differ from the current password. This check is
 * performed before consuming the verification code.
 *
 * @route POST /auth/reset-password
 * @access Public
 */
export const resetPassword = asyncHandler(
    async (req: Request, res: Response) => {
        const data = validate(resetPasswordSchema, req.body);

        let payload;

        try {
            payload = verifyPasswordResetToken(data.resetToken);
        } catch {
            throw new AppError(
                401,
                ErrorCodes.INVALID_TOKEN,
                "The password reset token has expired or is invalid. Please request a new one."
            );
        }

        const user = await User.findById(payload.sub).select("+password");

        if (!user) {
            // Use a generic error for nonexistent or previously deleted accounts.
            throw new AppError(
                400,
                ErrorCodes.INVALID_TOKEN,
                "The verification code is invalid or has expired."
            );
        }

        // Reject the current password before consuming the verification code.
        const isSamePassword = await user.comparePassword(data.newPassword);

        if (isSamePassword) {
            throw new AppError(
                400,
                ErrorCodes.VALIDATION_ERROR,
                "The new password must differ from the current password.",
                { field: "newPassword" }
            );
        }

        // Verify and consume the one-time password reset code.
        await verifyCode({
            userId: user._id,
            purpose: "reset_password",
            code: data.code,
            targetEmail: user.email
        });

        // Persist the new password.
        user.password = data.newPassword;
        await user.save();

        // Invalidate all existing sessions after a successful password reset.
        const result = await Session.deleteMany({
            user: user._id
        });

        console.log(
            `[PASSWORD RESET] user=${user._id} email=${user.email} — revoked ${result.deletedCount} sessions`
        );

        res.json({
            ok: true,
            message:
                "Your password has been reset successfully. You can now log in.",
            revokedSessions: result.deletedCount || 0
        });
    }
);

/* ========================================================================== */
/* Password Recovery — Resend Reset Code                                      */
/* ========================================================================== */

/**
 * Issues a new password recovery code for a valid reset token.
 *
 * Request throttling and cooldown enforcement are handled by the
 * verification service.
 *
 * @route POST /auth/resend-password-reset
 * @access Public
 */
export const resendPasswordReset = asyncHandler(
    async (req: Request, res: Response) => {
        const data = validate(resendPasswordResetSchema, req.body);

        let payload;

        try {
            payload = verifyPasswordResetToken(data.resetToken);
        } catch {
            throw new AppError(
                401,
                ErrorCodes.INVALID_TOKEN,
                "The password reset token has expired. Please submit a new request."
            );
        }

        const user = await User.findById(payload.sub).select("email name");

        if (!user) {
            throw new AppError(
                400,
                ErrorCodes.INVALID_TOKEN,
                "The verification code is invalid or has expired."
            );
        }

        await createVerificationCode({
            userId: user._id,
            purpose: "reset_password",
            targetEmail: user.email,
            userName: user.name,
            req,
            ttlMinutes: 15
        });

        res.json({
            ok: true,
            message: `A new password recovery code has been sent to ${user.email}.`,
            email: user.email,
            expiresIn: 900
        });
    }
);

/* ========================================================================== */
/* Authentication — Logout                                                    */
/* ========================================================================== */

/**
 * Ends the current session using the refresh token, when available,
 * and clears authentication cookies.
 *
 * Invalid or expired refresh tokens are ignored so the user can always
 * clear their local authentication cookies.
 *
 * @route POST /auth/logout
 * @access Public
 */
export const logout = asyncHandler(
    async (req: Request, res: Response) => {
        const refresh = req.cookies?.refresh_token as string | undefined;

        if (refresh) {
            try {
                const payload = verifyToken(refresh);

                // Permanently remove the current session.
                await endSession(payload.sid, payload.sub);
            } catch {
                // Ignore invalid or expired refresh tokens during logout.
            }
        }

        clearAuthCookies(res);

        res.json({
            ok: true,
            message: "You have been logged out successfully."
        });
    }
);

/* ========================================================================== */
/* Authentication — Logout All Sessions                                       */
/* ========================================================================== */

/**
 * Terminates all sessions belonging to the authenticated user and clears
 * the current authentication cookies.
 *
 * @route POST /auth/logout-all
 * @access Authenticated
 */
export const logoutAll = asyncHandler(
    async (req: any, res: Response) => {
        if (!req.user) {
            throw Unauthorized(ErrorCodes.UNAUTHENTICATED);
        }

        const count = await endAllSessions(req.user._id);

        clearAuthCookies(res);

        res.json({
            ok: true,
            message: `You have been logged out from ${count} device(s).`,
            count
        });
    }
);

/* ========================================================================== */
/* Authentication — Current User                                              */
/* ========================================================================== */

/**
 * Returns the authenticated user's public profile and current session details.
 *
 * Sensitive user fields and authentication tokens are excluded from the
 * response.
 *
 * @route GET /auth/me
 * @access Authenticated
 */
export const me = asyncHandler(
    async (req: any, res: Response) => {
        if (!req.user) {
            throw Unauthorized(ErrorCodes.UNAUTHENTICATED);
        }

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
    }
);

/* ========================================================================== */
/* Authentication — Refresh Access Token                                      */
/* ========================================================================== */

/**
 * Issues a new access token using a valid refresh token associated with
 * an active session.
 *
 * The session's access token and last activity timestamp are updated
 * before the new token is returned.
 *
 * @route POST /auth/refresh
 * @access Public
 */
export const refresh = asyncHandler(
    async (req: Request, res: Response) => {
        const refreshToken = req.cookies?.refresh_token as string | undefined;

        if (!refreshToken) {
            throw Unauthorized(ErrorCodes.NO_REFRESH_TOKEN);
        }

        let payload;

        try {
            payload = verifyToken(refreshToken);
        } catch {
            throw Unauthorized(ErrorCodes.INVALID_REFRESH_TOKEN);
        }

        if (payload.typ !== "refresh") {
            throw Unauthorized(ErrorCodes.WRONG_TOKEN_TYPE);
        }

        const session = await Session.findOne({
            sessionId: payload.sid,
            refreshToken,
            expiresAt: { $gt: new Date() }
        }).select("+refreshToken");

        if (!session) {
            throw Unauthorized(ErrorCodes.SESSION_NOT_FOUND);
        }

        if (session.expiresAt < new Date()) {
            throw Unauthorized(ErrorCodes.SESSION_EXPIRED);
        }

        const access = signAccessToken({
            sub: payload.sub,
            sid: payload.sid
        });

        session.token = access;
        session.lastActiveAt = new Date();

        await session.save();

        res.cookie("access_token", access, {
            ...cookieOpts,
            maxAge: 60 * 60 * 1000
        });

        res.json({
            ok: true,
            access
        });
    }
);

/* ========================================================================== */
/* Session Management — List Active Sessions                                  */
/* ========================================================================== */

/**
 * Returns all non-expired sessions belonging to the authenticated user.
 *
 * Sessions are ordered by most recent activity, with the current session
 * identified separately.
 *
 * @route GET /auth/sessions
 * @access Authenticated
 */
export const listSessions = asyncHandler(
    async (req: any, res: Response) => {
        if (!req.user) {
            throw Unauthorized(ErrorCodes.UNAUTHENTICATED);
        }

        const sessions = await Session.find({
            user: req.user._id,
            expiresAt: { $gt: new Date() }
        })
            .sort({ lastActiveAt: -1 })
            .lean();

        res.json({
            ok: true,
            current: req.session?._id ?? null,

            sessions: sessions.map((session) => ({
                id: session._id,
                loginAt: session.loginAt,
                lastActiveAt: session.lastActiveAt,
                expiresAt: session.expiresAt,
                device: session.device,
                location: {
                    ip: session.location.ip,
                    city: session.location.city,
                    country: session.location.country,
                    isp: session.location.isp
                }
            }))
        });
    }
);

/* ========================================================================== */
/* Session Management — Revoke Session                                        */
/* ========================================================================== */

/**
 * Permanently removes a specific session owned by the authenticated user.
 *
 * If the revoked session is the current session, authentication cookies
 * are also cleared.
 *
 * @route DELETE /auth/sessions/:id
 * @access Authenticated
 */
export const revokeSession = asyncHandler(
    async (req: any, res: Response) => {
        if (!req.user) {
            throw Unauthorized(ErrorCodes.UNAUTHENTICATED);
        }

        const session = await Session.findOne({
            _id: req.params.id,
            user: req.user._id
        });

        if (!session) {
            throw new AppError(404, ErrorCodes.SESSION_NOT_FOUND);
        }

        const isCurrent =
            req.session &&
            String(req.session._id) === String(session._id);

        // Permanently delete the selected session.
        await Session.deleteOne({
            _id: session._id
        });

        if (isCurrent) {
            clearAuthCookies(res);
        }

        res.json({
            ok: true,
            message: "The session has been terminated successfully."
        });
    }
);

/**
 * Copyright (c) 2026 Sobhan Rasoulzadeh Asl (Sobhan-SRZA / Mr. Sinre)
 *
 * Licensed under the BSD 3-Clause License.
 * See the LICENSE file in the project root for license information.
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */