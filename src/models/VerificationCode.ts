import {
    Schema,
    model,
    Model,
    Types
} from "mongoose";
import crypto from "crypto";

export type VerificationPurpose =
    | "change_password"
    | "change_email_old"   // تایید روی ایمیل قدیم
    | "change_email_new"   // تایید روی ایمیل جدید
    | "login_2fa"
    | "reset_password";

export interface IVerificationCode {
    user: Types.ObjectId;
    purpose: VerificationPurpose;

    codeHash: string;         // sha256(code + salt)
    salt: string;

    // برای تغییر ایمیل
    targetEmail?: string | null;

    attempts: number;
    maxAttempts: number;
    expiresAt: Date;
    consumedAt: Date | null;

    ip?: string;
    userAgent?: string;

    createdAt: Date;
    updatedAt: Date;
}

type VerificationCodeModel = Model<IVerificationCode>;

const verificationCodeSchema = new Schema<IVerificationCode, VerificationCodeModel>(
    {
        user: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true
        },

        purpose: {
            type: String,
            enum: ["change_password", "change_email_old", "change_email_new", "login_2fa", "reset_password"],
            required: true,
            index: true
        },

        codeHash: { type: String, required: true },
        salt: { type: String, required: true },

        targetEmail: { type: String, default: null, lowercase: true, trim: true },

        attempts: { type: Number, default: 0, min: 0 },
        maxAttempts: { type: Number, default: 5, min: 1 },
        expiresAt: { type: Date, required: true, index: true },
        consumedAt: { type: Date, default: null },

        ip: String,
        userAgent: String
    },
    { timestamps: true }
);

/* ---------------- indexes ---------------- */
verificationCodeSchema.index({ user: 1, purpose: 1, consumedAt: 1 });
// TTL: خودکار پاک‌سازی کدهای منقضی
verificationCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 60 * 60 }); // ۱ ساعت بعد از انقضا

/* ---------------- statics ---------------- */
verificationCodeSchema.statics.generateCode = function () {
    // ۶ رقمی، با صفر اول
    const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
    const salt = crypto.randomBytes(16).toString("hex");
    const codeHash = crypto.createHash("sha256").update(code + salt).digest("hex");

    return { code, codeHash, salt };
};

verificationCodeSchema.statics.hashCode = function (code: string, salt: string) {
    return crypto.createHash("sha256").update(code + salt).digest("hex");
};

export const VerificationCode = model<IVerificationCode, VerificationCodeModel>(
    "VerificationCode",
    verificationCodeSchema
);

/**
 * Copyright (c) 2026 Sobhan Rasoulzadeh Asl (Sobhan-SRZA / Mr. Sinre)
 *
 * Licensed under the BSD 3-Clause License.
 * See the LICENSE file in the project root for license information.
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */