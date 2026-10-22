import jwt, { type SignOptions } from "jsonwebtoken";
import { config } from "../config/env";
import crypto from "crypto";

export interface JwtPayload {
    sub: string;      // user id
    sid: string;      // session id
    typ: "access" | "refresh";
}

export function signAccessToken(payload: Omit<JwtPayload, "typ">): string {
    return jwt.sign({ ...payload, typ: "access" }, config.jwtSecret, {
        expiresIn: config.jwtExpiresIn,
    } as SignOptions);
}

export function signRefreshToken(payload: Omit<JwtPayload, "typ">): string {
    return jwt.sign({ ...payload, typ: "refresh" }, config.jwtSecret, {
        expiresIn: "30d",
    } as SignOptions);
}

export function verifyToken(token: string): JwtPayload {
    return jwt.verify(token, config.jwtSecret) as JwtPayload;
}

/** random hex string for refresh tokens stored in DB */
export function randomToken(bytes = 48): string {
    return crypto.randomBytes(bytes).toString("hex");
}

/* ==================================================================
   Email Verify Token — JWT کوتاه‌عمر برای مرحله تایید ایمیل
   ================================================================== */
export interface EmailVerifyPayload {
    sub: string;        // userId
    email: string;
    typ: "email_verify";
}

export function signEmailVerifyToken(userId: string, email: string): string {
    return jwt.sign(
        { sub: userId, email, typ: "email_verify" },
        config.jwtSecret,
        { expiresIn: "1h" } as SignOptions
    );
}

export function verifyEmailVerifyToken(token: string): EmailVerifyPayload {
    const payload = jwt.verify(token, config.jwtSecret) as any;
    if (payload.typ !== "email_verify") {
        throw new Error("wrong token type");
    }

    return payload as EmailVerifyPayload;
}

/**
 * Copyright (c) 2026 Sobhan Rasoulzadeh Asl (Sobhan-SRZA / Mr. Sinre)
 *
 * Licensed under the BSD 3-Clause License.
 * See the LICENSE file in the project root for license information.
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */