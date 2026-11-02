/**
 * Rate limiting tiered by API visibility. Public endpoints receive a
 * tighter budget than authenticated ones; admin and developer endpoints
 * are limited per user rather than per IP.
 */

import rateLimit, { ipKeyGenerator, type Options } from "express-rate-limit";
import type { Request, Response } from "express";
import type { ApiVisibility } from "../types/api";

/* -------------------- Tier Configuration -------------------- */

const TIERS: Record<ApiVisibility, { windowMs: number; max: number }> = {
    public: { windowMs: 60_000, max: 60 },
    authenticated: { windowMs: 60_000, max: 120 },
    admin: { windowMs: 60_000, max: 240 },
    developer: { windowMs: 60_000, max: 240 },
    internal: { windowMs: 60_000, max: 0 } // Never used — internal is server-only.
};

/* -------------------- Key Generator -------------------- */

/**
 * Uses the authenticated user ID when available, falling back to the
 * client IP. This prevents one admin from exhausting the quota of
 * another when they share an office network.
 */
function keyFor(visibility: ApiVisibility) {
    return (req: any) => {
        if (
            visibility === "authenticated" ||
            visibility === "admin" ||
            visibility === "developer"
        ) {
            if (req.user?._id) return `u:${req.user._id}`;
        }

        return ipKeyGenerator(req.ip);
    };
}

/* -------------------- Factory -------------------- */

/**
 * Builds a rate limiter for the given visibility tier.
 *
 * Because each endpoint receives its own limiter instance, quotas do not
 * bleed across endpoints. An explicit override may be passed for
 * endpoints requiring a stricter or looser budget.
 */
export function apiRateLimit(
    visibility: ApiVisibility,
    override?: { windowMs: number; max: number }
): ReturnType<typeof rateLimit> {
    const config = override || TIERS[visibility];

    const options: Partial<Options> = {
        windowMs: config.windowMs,
        max: config.max,
        standardHeaders: "draft-7",
        legacyHeaders: false,
        keyGenerator: keyFor(visibility),
        handler: (_req: Request, res: Response) => {
            res.status(429).json({
                ok: false,
                code: "TOO_MANY_ATTEMPTS",
                message: "Too many requests. Please slow down and try again shortly."
            });
        },
        // Skip entirely when the limit is zero (internal tier).
        skip: () => config.max === 0
    };

    return rateLimit(options as Options);
}

/**
 * Copyright (c) 2026 Sobhan Rasoulzadeh Asl (Sobhan-SRZA / Mr. Sinre)
 *
 * Licensed under the BSD 3-Clause License.
 * See the LICENSE file in the project root for license information.
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */