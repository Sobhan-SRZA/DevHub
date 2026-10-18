import {
    Session,
    type IDeviceInfo,
    type ILocationInfo
} from "../models/Session";
import {
    randomToken,
    signAccessToken,
    signRefreshToken
} from "../utils/token";
import {
    lookupIp,
    getClientIp
} from "../utils/geoip";
import { parseUserAgent } from "../utils/parseUserAgent";
import type { Request } from "express";
import { Types } from "mongoose";
import crypto from "crypto";

/* ==================================================================
   Device fingerprint (deterministic hash)
   ================================================================== */
export function computeDeviceHash(
    userAgent: string,
    fingerprint?: string,
    deviceId?: string
): string {
    const fp = fingerprint || deviceId || "";

    return crypto
        .createHash("sha256")
        .update(`${userAgent}|${fp}`)
        .digest("hex");
}

/* ==================================================================
   Build device + location metadata
   ================================================================== */
async function buildMetadata(
    req: Request,
    fingerprint?: string,
    deviceId?: string,
    macAddress?: string | null
) {
    const userAgent = (req.headers["user-agent"] as string) || "unknown";
    const ip = getClientIp(req);

    const [deviceResult, locationResult] = await Promise.allSettled([
        Promise.resolve(parseUserAgent(userAgent)),
        lookupIp(ip),
    ]);

    const device: IDeviceInfo =
        deviceResult.status === "fulfilled"
            ? deviceResult.value
            : { userAgent, deviceType: "unknown" as const };

    const location: ILocationInfo =
        locationResult.status === "fulfilled"
            ? locationResult.value
            : { ip };

    return {
        userAgent,
        ip,
        device,
        location,
        client: {
            deviceId,
            fingerprint,
            macAddress: macAddress ?? null
        }
    };
}

/* ==================================================================
   startSession — create OR reuse
   ==================================================================
   رفتار:
     - اگه کاربر روی همون دستگاه سشن فعال داشته باشه → آپدیت می‌شه
       (توکن جدید، expiry جدید، metadata جدید)
     - اگه نداشته باشه → سشن جدید ساخته می‌شه
   ================================================================== */
export interface StartSessionOptions {
    fingerprint?: string;
    deviceId?: string;
    macAddress?: string | null;
    ttlDays?: number;
}

export async function startSession(
    userId: Types.ObjectId | string,
    req: Request,
    opts: StartSessionOptions = {}
) {
    const {
        fingerprint,
        deviceId,
        macAddress,
        ttlDays = 7,
    } = opts;

    const meta = await buildMetadata(req, fingerprint, deviceId, macAddress);
    const deviceHash = computeDeviceHash(meta.userAgent, fingerprint, deviceId);

    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlDays * 24 * 60 * 60 * 1000);

    /* -------- تلاش برای پیدا کردن سشن فعال موجود -------- */
    let session = await Session.findOne({
        user: userId,
        deviceHash,
        expiresAt: { $gt: now }
    });

    let reused = false;

    if (session) {
        // سشن موجود رو آپدیت کن — sessionId عوض نمی‌شه
        session.device = meta.device;
        session.location = meta.location;
        session.client = meta.client;
        session.lastActiveAt = now;
        session.loginAt = now;
        session.expiresAt = expiresAt;
        reused = true;
    } 
    
    else {
        // سشن جدید
        session = new Session({
            user: userId,
            sessionId: randomToken(16),
            deviceHash,
            device: meta.device,
            location: meta.location,
            client: meta.client,
            loginAt: now,
            lastActiveAt: now,
            expiresAt
        });
    }

    // توکن‌ها رو با sessionId فعلی امضا کن
    // (اگه سشن قبلی بود، همون sessionId حفظ می‌شه)
    const access = signAccessToken({
        sub: userId.toString(),
        sid: session.sessionId
    });

    const refresh = signRefreshToken({
        sub: userId.toString(),
        sid: session.sessionId
    });

    session.token = access;
    session.refreshToken = refresh;
    await session.save();

    return { session, access, refresh, reused };
}

/* ==================================================================
   endSession — delete a single session
   ================================================================== */
export async function endSession(
    sessionId: string,
    userId?: Types.ObjectId | string
): Promise<boolean> {
    const filter: Record<string, unknown> = { sessionId };
    if (userId) 
        filter.user = userId;

    const result = await Session.deleteOne(filter);
    
    return (result.deletedCount ?? 0) > 0;
}

/* ==================================================================
   endAllSessions — delete all sessions for a user
   ================================================================== */
export async function endAllSessions(
    userId: Types.ObjectId | string
): Promise<number> {
    const result = await Session.deleteMany({ user: userId });

    return result.deletedCount ?? 0;
}

/* ==================================================================
   touchSession — update lastActiveAt (fire-and-forget)
   ================================================================== */
export async function touchSession(sessionId: string): Promise<void> {
    await Session.updateOne(
        { sessionId },
        { lastActiveAt: new Date() }
    );
}

/**
 * Copyright (c) 2026 Sobhan Rasoulzadeh Asl (Sobhan-SRZA / Mr. Sinre)
 *
 * Licensed under the BSD 3-Clause License.
 * See the LICENSE file in the project root for license information.
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */