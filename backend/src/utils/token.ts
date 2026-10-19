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

/**
 * Copyright (c) 2026 Sobhan Rasoulzadeh Asl (Sobhan-SRZA / Mr. Sinre)
 *
 * Licensed under the BSD 3-Clause License.
 * See the LICENSE file in the project root for license information.
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */