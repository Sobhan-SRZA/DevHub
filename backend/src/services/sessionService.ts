
import {
    Session,
    type IDeviceInfo,
    type ILocationInfo,
} from "../models/Session";
import {
    randomToken,
    signAccessToken,
    signRefreshToken,
} from "../utils/token";
import {
    lookupIp,
    getClientIp,
} from "../utils/geoip";
import { parseUserAgent } from "../utils/parseUserAgent";
import type { Request } from "express";
import { Types } from "mongoose";
import crypto from "crypto";

/* ==================================================================
   Device Fingerprinting
   ================================================================== */

/**
 * Generates a deterministic SHA-256 hash from the user agent and
 * an optional client-provided fingerprint or device identifier.
 *
 * This hash is used to identify sessions associated with the same device.
 */
export function computeDeviceHash(
    userAgent: string,
    fingerprint?: string,
    deviceId?: string
): string {
    const deviceFingerprint = fingerprint || deviceId || "";

    return crypto
        .createHash("sha256")
        .update(`${userAgent}|${deviceFingerprint}`)
        .digest("hex");
}

/* ==================================================================
   Device and Location Metadata
   ================================================================== */

/**
 * Collects device, network, and location metadata from an HTTP request.
 *
 * Device parsing and IP geolocation are handled independently so that
 * a failure in either operation does not prevent session creation.
 */
async function buildMetadata(
    req: Request,
    fingerprint?: string,
    deviceId?: string,
    macAddress?: string | null
) {
    const userAgent =
        (req.headers["user-agent"] as string) || "unknown";

    const ip = getClientIp(req);

    const [deviceResult, locationResult] = await Promise.allSettled([
        Promise.resolve(parseUserAgent(userAgent)),
        lookupIp(ip),
    ]);

    const device: IDeviceInfo =
        deviceResult.status === "fulfilled"
            ? deviceResult.value
            : {
                userAgent,
                deviceType: "unknown",
            };

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
            macAddress: macAddress ?? null,
        },
    };
}

/* ==================================================================
   Session Creation and Reuse
   ================================================================== */

/**
 * Options for creating or reusing an authenticated session.
 */
export interface StartSessionOptions {
    fingerprint?: string;
    deviceId?: string;
    macAddress?: string | null;
    ttlDays?: number;
}

/**
 * Creates a new session or refreshes an existing active session
 * associated with the same user and device.
 *
 * When an active session is reused, its session ID remains unchanged,
 * while its tokens, expiration time, activity timestamp, and metadata
 * are refreshed.
 *
 * @returns The persisted session, access token, refresh token,
 * and a flag indicating whether the session was reused.
 */
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

    const metadata = await buildMetadata(
        req,
        fingerprint,
        deviceId,
        macAddress
    );

    const deviceHash = computeDeviceHash(
        metadata.userAgent,
        fingerprint,
        deviceId
    );

    const now = new Date();
    const expiresAt = new Date(
        now.getTime() + ttlDays * 24 * 60 * 60 * 1000
    );

    // Reuse an unexpired session belonging to the same user and device.
    let session = await Session.findOne({
        user: userId,
        deviceHash,
        expiresAt: { $gt: now },
    });

    let reused = false;

    if (session) {
        // Preserve the existing session ID while refreshing session data.
        session.device = metadata.device;
        session.location = metadata.location;
        session.client = metadata.client;
        session.lastActiveAt = now;
        session.loginAt = now;
        session.expiresAt = expiresAt;

        reused = true;
    } else {
        // Create a new session with a unique session identifier.
        session = new Session({
            user: userId,
            sessionId: randomToken(16),
            deviceHash,
            device: metadata.device,
            location: metadata.location,
            client: metadata.client,
            loginAt: now,
            lastActiveAt: now,
            expiresAt,
        });
    }

    // Sign new tokens using the session ID, preserving it when reusing
    // an existing session.
    const access = signAccessToken({
        sub: userId.toString(),
        sid: session.sessionId,
    });

    const refresh = signRefreshToken({
        sub: userId.toString(),
        sid: session.sessionId,
    });

    session.token = access;
    session.refreshToken = refresh;

    await session.save();

    return {
        session,
        access,
        refresh,
        reused,
    };
}

/* ==================================================================
   Single Session Termination
   ================================================================== */

/**
 * Deletes a session by its session ID.
 *
 * When a user ID is provided, deletion is restricted to that user.
 *
 * @returns `true` if a session was deleted; otherwise, `false`.
 */
export async function endSession(
    sessionId: string,
    userId?: Types.ObjectId | string
): Promise<boolean> {
    const filter: Record<string, unknown> = { sessionId };

    if (userId) {
        filter.user = userId;
    }

    const result = await Session.deleteOne(filter);

    return (result.deletedCount ?? 0) > 0;
}

/* ==================================================================
   Terminate All User Sessions
   ================================================================== */

/**
 * Deletes all sessions associated with the specified user.
 *
 * @returns The number of sessions deleted.
 */
export async function endAllSessions(
    userId: Types.ObjectId | string
): Promise<number> {
    const result = await Session.deleteMany({
        user: userId,
    });

    return result.deletedCount ?? 0;
}

/* ==================================================================
   Session Activity Tracking
   ================================================================== */

/**
 * Updates the last activity timestamp for the specified session.
 *
 * This operation can be invoked asynchronously by the authentication
 * middleware to track session activity.
 */
export async function touchSession(
    sessionId: string
): Promise<void> {
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