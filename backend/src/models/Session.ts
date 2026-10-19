import {
    Schema,
    model,
    Model,
    Types
} from "mongoose";

/* ---------------- sub-documents ---------------- */
export interface IDeviceInfo {
    userAgent: string;
    deviceType: "desktop" | "mobile" | "tablet" | "bot" | "unknown";
    deviceVendor?: string;
    deviceModel?: string;
    os?: string;
    osVersion?: string;
    browser?: string;
    browserVersion?: string;
    engine?: string;
    isBot?: boolean;
}

export interface ILocationInfo {
    ip: string;
    ipVersion?: 4 | 6;
    country?: string;
    countryCode?: string;
    region?: string;
    city?: string;
    latitude?: number;
    longitude?: number;
    timezone?: string;
    isp?: string;
}

export interface IClientIdentifiers {
    macAddress?: string | null;
    fingerprint?: string;
    deviceId?: string;
}

/* ---------------- main ---------------- */
export interface ISession {
    user: Types.ObjectId;
    sessionId: string;       // random id, in JWT as `sid`
    deviceHash: string;      // sha256(userAgent + fingerprint) — for dedup
    token: string;           // access token
    refreshToken?: string;

    device: IDeviceInfo;
    location: ILocationInfo;
    client: IClientIdentifiers;

    loginAt: Date;
    lastActiveAt: Date;
    expiresAt: Date;

    createdAt: Date;
    updatedAt: Date;
}

export interface ISessionMethods {
    isExpired(): boolean;
}

type SessionModel = Model<ISession, {}, ISessionMethods>;

/* ---------------- sub-schemas ---------------- */
const deviceSchema = new Schema<IDeviceInfo>(
    {
        userAgent: { type: String, required: true },
        deviceType: {
            type: String,
            enum: ["desktop", "mobile", "tablet", "bot", "unknown"],
            default: "unknown"
        },
        deviceVendor: String,
        deviceModel: String,
        os: String,
        osVersion: String,
        browser: String,
        browserVersion: String,
        engine: String,
        isBot: { type: Boolean, default: false }
    },
    { _id: false }
);

const locationSchema = new Schema<ILocationInfo>(
    {
        ip: { type: String, required: true },
        ipVersion: { type: Number, enum: [4, 6] },
        country: String,
        countryCode: String,
        region: String,
        city: String,
        latitude: Number,
        longitude: Number,
        timezone: String,
        isp: String,
    },
    { _id: false }
);

const clientSchema = new Schema<IClientIdentifiers>(
    {
        macAddress: { type: String, default: null },
        fingerprint: String,
        deviceId: String
    },
    { _id: false }
);

/* ---------------- session schema ---------------- */
const sessionSchema = new Schema<ISession, SessionModel, ISessionMethods>(
    {
        user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },

        sessionId: {
            type: String,
            required: true,
            unique: true,
            index: true
        },

        deviceHash: {
            type: String,
            required: true,
            index: true
        },

        token: { type: String, required: true, unique: true, index: true },
        refreshToken: { type: String, select: false },

        device: { type: deviceSchema, required: true },
        location: { type: locationSchema, required: true },
        client: { type: clientSchema, default: () => ({}) },

        loginAt: { type: Date, default: () => new Date() },
        lastActiveAt: { type: Date, default: () => new Date() },
        expiresAt: { type: Date, required: true }
    },
    { timestamps: true }
);

/* ---------------- indexes ---------------- */
// برای پیدا کردن سریع سشن فعلی کاربر روی یه دستگاه
sessionSchema.index({ user: 1, deviceHash: 1, expiresAt: 1 });

// TTL: پاک‌سازی خودکار سشن‌های منقضی
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

/* ---------------- methods ---------------- */
sessionSchema.method("isExpired", function () {
    return this.expiresAt <= new Date();
});

export const Session = model<ISession, SessionModel>("Session", sessionSchema);

/**
 * Copyright (c) 2026 Sobhan Rasoulzadeh Asl (Sobhan-SRZA / Mr. Sinre)
 *
 * Licensed under the BSD 3-Clause License.
 * See the LICENSE file in the project root for license information.
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */