import {
    Schema,
    model,
    Model,
    Types
} from "mongoose";
import crypto from "crypto";

/* -------------------- Verification Purposes -------------------- */

export type VerificationPurpose =
    | "verify_email"
    | "change_password"
    | "change_email_old" // Verification sent to the current email address.
    | "change_email_new" // Verification sent to the new email address.
    | "login_2fa"
    | "reset_password";

/* -------------------- Verification Code Interface -------------------- */

export interface IVerificationCode {
    user: Types.ObjectId;
    purpose: VerificationPurpose;

    codeHash: string; // SHA-256 hash of the verification code combined with a salt.
    salt: string;

    targetEmail?: string | null; // Target email address for email change verification.

    attempts: number;
    maxAttempts: number;
    expiresAt: Date;
    consumedAt: Date | null;
    requestedAt: Date;

    ip?: string;
    userAgent?: string;

    createdAt: Date;
    updatedAt: Date;
}

interface VerificationCodeModel extends Model<IVerificationCode> {
    generateCode(): {   
        code: string;
        codeHash: string;
        salt: string;
    };
    hashCode(code: string, salt: string): string;
}

/* -------------------- Verification Code Schema -------------------- */

const verificationCodeSchema = new Schema<
    IVerificationCode,
    VerificationCodeModel
>(
    {
        user: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true
        },

        purpose: {
            type: String,
            enum: [
                "verify_email",
                "change_password",
                "change_email_old",
                "change_email_new",
                "login_2fa",
                "reset_password"
            ],
            required: true,
            index: true
        },

        codeHash: {
            type: String,
            required: true
        },
        salt: {
            type: String,
            required: true
        },

        targetEmail: {
            type: String,
            default: null,
            lowercase: true,
            trim: true
        },

        attempts: {
            type: Number,
            default: 0,
            min: 0
        },
        maxAttempts: {
            type: Number,
            default: 5,
            min: 1
        },
        expiresAt: {
            type: Date,
            required: true
        },
        consumedAt: {
            type: Date,
            default: null
        },
        requestedAt: {
            type: Date,
            default: () => new Date()
        },

        ip: String,
        userAgent: String
    },
    { timestamps: true }
);

/* -------------------- Indexes -------------------- */

verificationCodeSchema.index({ user: 1, purpose: 1, consumedAt: 1 });

// Automatically removes expired verification codes.
// MongoDB checks TTL indexes periodically, typically every 60 seconds.
// Consequently, expired documents may remain in the database briefly after expiration.
verificationCodeSchema.index(
    { expiresAt: 1 },
    { expireAfterSeconds: 0 }
);

/* -------------------- Static Methods -------------------- */

verificationCodeSchema.statics.generateCode = function () {
    // Generates a six-digit verification code, preserving leading zeros.
    const code = String(
        crypto.randomInt(0, 1_000_000)
    ).padStart(6, "0");

    const salt = crypto.randomBytes(16).toString("hex");
    const codeHash = crypto
        .createHash("sha256")
        .update(code + salt)
        .digest("hex");

    return { code, codeHash, salt };
};

verificationCodeSchema.statics.hashCode = function (
    code: string,
    salt: string
) {
    return crypto
        .createHash("sha256")
        .update(code + salt)
        .digest("hex");
};

export const VerificationCode = model<
    IVerificationCode,
    VerificationCodeModel
>("VerificationCode", verificationCodeSchema);

/**
 * Copyright (c) 2026 Sobhan Rasoulzadeh Asl (Sobhan-SRZA / Mr. Sinre)
 *
 * Licensed under the BSD 3-Clause License.
 * See the LICENSE file in the project root for license information.
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */