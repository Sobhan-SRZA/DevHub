
import jwt, { type SignOptions } from "jsonwebtoken";
import { config } from "../config/env";
import crypto from "crypto";

/**
 * Defines the payload structure shared by access and refresh tokens.
 *
 * - `sub`: Unique identifier of the authenticated user.
 * - `sid`: Identifier of the associated session.
 * - `typ`: Token type used to distinguish access tokens from refresh tokens.
 */
export interface JwtPayload {
    sub: string;
    sid: string;
    typ: "access" | "refresh";
}

/**
 * Signs a short-lived access token.
 *
 * The token contains the user ID, session ID, and access token type.
 * Its expiration is determined by the application configuration.
 *
 * @param payload - User and session identifiers.
 * @returns A signed JWT access token.
 */
export function signAccessToken(
    payload: Omit<JwtPayload, "typ">
): string {
    return jwt.sign(
        { ...payload, typ: "access" },
        config.jwtSecret,
        {
            expiresIn: config.jwtExpiresIn
        } as SignOptions
    );
}

/**
 * Signs a refresh token with a fixed 30-day expiration.
 *
 * Refresh tokens should be validated against the associated session
 * and any server-side revocation state before being used to issue
 * new access tokens.
 *
 * @param payload - User and session identifiers.
 * @returns A signed JWT refresh token.
 */
export function signRefreshToken(
    payload: Omit<JwtPayload, "typ">
): string {
    return jwt.sign(
        { ...payload, typ: "refresh" },
        config.jwtSecret,
        {
            expiresIn: "30d"
        } as SignOptions
    );
}

/**
 * Verifies a JWT's signature and expiration.
 *
 * This function does not validate the expected token type or confirm
 * that the associated user or session remains active. Callers must
 * perform those checks when required.
 *
 * @param token - JWT to verify.
 * @returns The decoded token payload.
 * @throws JsonWebTokenError If the token is invalid.
 * @throws TokenExpiredError If the token has expired.
 */
export function verifyToken(token: string): JwtPayload {
    return jwt.verify(token, config.jwtSecret) as JwtPayload;
}

/**
 * Generates a cryptographically secure random hexadecimal token.
 *
 * This is suitable for creating opaque refresh tokens or other
 * high-entropy secrets that are stored and validated server-side.
 *
 * @param bytes - Number of random bytes to generate. Defaults to 48.
 * @returns A hexadecimal string containing twice the specified byte count.
 */
export function randomToken(bytes = 48): string {
    return crypto.randomBytes(bytes).toString("hex");
}

/* ==================================================================
   Email Verification Token
   Short-lived JWT used during email verification.
   ================================================================== */

/**
 * Defines the payload for an email verification token.
 *
 * - `sub`: Unique identifier of the user.
 * - `email`: Email address being verified.
 * - `typ`: Fixed token type identifying email verification tokens.
 */
export interface EmailVerifyPayload {
    sub: string;
    email: string;
    typ: "email_verify";
}

/**
 * Signs an email verification token with a one-hour expiration.
 *
 * @param userId - Unique identifier of the user.
 * @param email - Email address to verify.
 * @returns A signed JWT email verification token.
 */
export function signEmailVerifyToken(
    userId: string,
    email: string
): string {
    return jwt.sign(
        {
            sub: userId,
            email,
            typ: "email_verify"
        },
        config.jwtSecret,
        {
            expiresIn: "1h"
        } as SignOptions
    );
}

/**
 * Verifies an email verification token and validates its token type.
 *
 * @param token - JWT to verify.
 * @returns The validated email verification payload.
 * @throws Error If verification fails or the token type is incorrect.
 */
export function verifyEmailVerifyToken(
    token: string
): EmailVerifyPayload {
    const payload = jwt.verify(
        token,
        config.jwtSecret
    ) as EmailVerifyPayload;

    if (payload.typ !== "email_verify") {
        throw new Error("Invalid token type.");
    }

    return payload;
}

/* ==================================================================
   Password Reset Token
   Short-lived JWT used for password reset operations.
   ================================================================== */

/**
 * Defines the payload for a password reset token.
 *
 * - `sub`: Unique identifier of the user.
 * - `email`: Email address associated with the account.
 * - `typ`: Fixed token type identifying password reset tokens.
 */
export interface PasswordResetPayload {
    sub: string;
    email: string;
    typ: "password_reset";
}

/**
 * Signs a password reset token with a 15-minute expiration.
 *
 * @param userId - Unique identifier of the user.
 * @param email - Email address associated with the account.
 * @returns A signed JWT password reset token.
 */
export function signPasswordResetToken(
    userId: string,
    email: string
): string {
    return jwt.sign(
        {
            sub: userId,
            email,
            typ: "password_reset"
        },
        config.jwtSecret,
        {
            expiresIn: "15m"
        } as SignOptions
    );
}

/**
 * Verifies a password reset token and validates its token type.
 *
 * @param token - JWT to verify.
 * @returns The validated password reset payload.
 * @throws Error If verification fails or the token type is incorrect.
 */
export function verifyPasswordResetToken(
    token: string
): PasswordResetPayload {
    const payload = jwt.verify(
        token,
        config.jwtSecret
    ) as PasswordResetPayload;

    if (payload.typ !== "password_reset") {
        throw new Error("Invalid token type.");
    }

    return payload;
}

/**
 * Copyright (c) 2026 Sobhan Rasoulzadeh Asl (Sobhan-SRZA / Mr. Sinre)
 *
 * Licensed under the BSD 3-Clause License.
 * See the LICENSE file in the project root for license information.
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */