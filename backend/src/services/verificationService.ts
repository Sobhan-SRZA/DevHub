
import {
    VerificationCode,
    type VerificationPurpose
} from "../models/VerificationCode";
import { sendOtpEmail } from "./mail";
import type { Request } from "express";
import type { Types } from "mongoose";
import { ErrorCodes } from "../utils/errorCodes";
import { AppError } from "../utils/AppError";
import { User } from "../models/User";

/* ==================================================================
   Configuration
   ================================================================== */

/** Default verification code lifetime in minutes. */
const TTL_MINUTES = 10;

/** Maximum number of verification attempts allowed per code. */
const MAX_ATTEMPTS = 5;

/** Minimum interval between consecutive code requests, in seconds. */
const RESEND_COOLDOWN_SEC = 60;

/* ==================================================================
   Create and Send Verification Code
   ================================================================== */

export interface CreateCodeOptions {
    /** ID of the user requesting verification. */
    userId: Types.ObjectId | string;

    /** Purpose associated with the verification code. */
    purpose: VerificationPurpose;

    /** Optional recipient email address. Falls back to the user's email. */
    targetEmail?: string;

    /** Optional display name used in the verification email. */
    userName?: string;

    /** Optional Express request used to capture client metadata. */
    req?: Request;

    /** Optional verification code lifetime in minutes. */
    ttlMinutes?: number;
}

/**
 * Generates a verification code, persists its hashed representation,
 * and delivers it to the recipient through the configured mail service.
 *
 * Enforces a resend cooldown and removes active codes that are no longer
 * needed before creating a new verification request.
 *
 * @param opts - Verification code creation options.
 * @returns The generated code, expiration timestamp, and recipient address.
 * @throws AppError If the resend cooldown is active or the recipient is invalid.
 */
export async function createVerificationCode(opts: CreateCodeOptions) {
    const {
        userId,
        purpose,
        targetEmail,
        userName,
        req,
        ttlMinutes = TTL_MINUTES
    } = opts;

    /* ---------- Enforce resend cooldown ---------- */

    const recent = await VerificationCode.findOne({
        user: userId,
        purpose,
        consumedAt: null,
        requestedAt: {
            $gt: new Date(Date.now() - RESEND_COOLDOWN_SEC * 1000)
        }
    }).sort({ createdAt: -1 });

    if (recent) {
        const elapsed =
            (Date.now() - new Date(recent.createdAt).getTime()) / 1000;

        const remaining = Math.max(
            1,
            Math.ceil(RESEND_COOLDOWN_SEC - elapsed)
        );

        throw new AppError(
            429,
            ErrorCodes.TOO_MANY_ATTEMPTS,
            `Please try again in ${remaining} seconds.`
        );
    }

    /* ---------- Resolve recipient ---------- */

    let toEmail = targetEmail?.toLowerCase().trim();
    let displayName = userName;

    if (!toEmail) {
        const user = await User.findById(userId)
            .select("email name")
            .lean();

        if (!user) {
            throw new AppError(
                404,
                ErrorCodes.UNAUTHENTICATED,
                "User not found."
            );
        }

        toEmail = user.email;
        displayName = displayName || user.name;
    }

    if (!toEmail) {
        throw new AppError(
            400,
            ErrorCodes.EMAIL_INVALID,
            "The recipient email address is missing."
        );
    }

    /* ---------- Remove previous active codes ---------- */

    await VerificationCode.deleteMany({
        user: userId,
        purpose,
        consumedAt: null
    });

    /* ---------- Generate and persist verification code ---------- */

    const { code, codeHash, salt } =
        (VerificationCode as any).generateCode();

    const expiresAt = new Date(
        Date.now() + ttlMinutes * 60 * 1000
    );

    await VerificationCode.create({
        user: userId,
        purpose,
        codeHash,
        salt,
        targetEmail: toEmail,
        expiresAt,
        maxAttempts: MAX_ATTEMPTS,
        requestedAt: new Date(),
        ip: req ? getClientIp(req) : undefined,
        userAgent: req?.headers["user-agent"] as string | undefined
    });

    /* ---------- Deliver verification email ---------- */

    try {
        await sendOtpEmail({
            to: toEmail,
            code,
            purpose,
            expiresInMinutes: ttlMinutes,
            userName: displayName,
            ip: req ? getClientIp(req) : undefined
        });
    } catch (err) {
        /**
         * Remove the newly created verification record if email delivery
         * fails, preventing an unusable active code from remaining stored.
         */
        await VerificationCode.deleteMany({
            user: userId,
            purpose,
            targetEmail: toEmail,
            consumedAt: null
        }).catch(() => { });

        throw err;
    }

    return {
        code,
        expiresAt,
        sentTo: toEmail
    };
}

/* ==================================================================
   Verify Verification Code
   ================================================================== */

export interface VerifyCodeOptions {
    /** ID of the user whose verification code is being validated. */
    userId: Types.ObjectId | string;

    /** Purpose associated with the verification code. */
    purpose: VerificationPurpose;

    /** Code submitted by the user. */
    code: string;

    /** Optional recipient email address used to scope the lookup. */
    targetEmail?: string;
}

/**
 * Validates a verification code and enforces the configured attempt limit.
 *
 * Invalid attempts are recorded, and the verification record is deleted
 * after the maximum number of attempts is reached.
 *
 * A successfully verified code is consumed and cannot be reused.
 *
 * @param opts - Verification options.
 * @returns `true` when the code is valid.
 * @throws AppError If the code is invalid, expired, or the attempt limit is exceeded.
 */
export async function verifyCode(
    opts: VerifyCodeOptions
): Promise<boolean> {
    const {
        userId,
        purpose,
        code,
        targetEmail
    } = opts;

    const record = await VerificationCode.findOne({
        user: userId,
        purpose,
        consumedAt: null,
        expiresAt: { $gt: new Date() },
        ...(targetEmail
            ? { targetEmail: targetEmail.toLowerCase().trim() }
            : {})
    }).sort({ createdAt: -1 });

    if (!record) {
        throw new AppError(
            400,
            ErrorCodes.INVALID_TOKEN,
            "The verification code is invalid or has expired."
        );
    }

    if (record.attempts >= record.maxAttempts) {
        await VerificationCode.deleteOne({ _id: record._id });

        throw new AppError(
            429,
            ErrorCodes.TOO_MANY_ATTEMPTS,
            "You have exceeded the maximum number of attempts. Please request a new code."
        );
    }

    const incomingHash = (VerificationCode as any).hashCode(
        code,
        record.salt
    );

    if (incomingHash !== record.codeHash) {
        record.attempts += 1;

        if (record.attempts >= record.maxAttempts) {
            await VerificationCode.deleteOne({ _id: record._id });

            throw new AppError(
                429,
                ErrorCodes.TOO_MANY_ATTEMPTS,
                "The maximum number of attempts has been reached. Please request a new code."
            );
        }

        await record.save();

        const remaining = record.maxAttempts - record.attempts;

        throw new AppError(
            400,
            ErrorCodes.INVALID_TOKEN,
            `The verification code is incorrect. ${remaining} attempt(s) remaining.`
        );
    }

    await VerificationCode.deleteOne({ _id: record._id });

    return true;
}

/* ==================================================================
   Client IP Address Helper
   ================================================================== */

/**
 * Extracts the client's IP address from the Express request.
 *
 * Uses the first address in the `X-Forwarded-For` header when available,
 * otherwise falls back to the underlying socket connection.
 *
 * Note: Only trust forwarded headers when they are set by a trusted proxy.
 *
 * @param req - Express request object.
 * @returns The client's IP address, or `0.0.0.0` if unavailable.
 */
function getClientIp(req: Request): string {
    const forwardedFor = req.headers["x-forwarded-for"];

    if (typeof forwardedFor === "string") {
        return forwardedFor.split(",")[0].trim();
    }

    if (Array.isArray(forwardedFor) && forwardedFor.length > 0) {
        return forwardedFor[0];
    }

    return (
        req.socket?.remoteAddress ||
        (req as any).connection?.remoteAddress ||
        "0.0.0.0"
    ).replace(/^::ffff:/, "");
}

/**
 * Copyright (c) 2026 Sobhan Rasoulzadeh Asl (Sobhan-SRZA / Mr. Sinre)
 *
 * Licensed under the BSD 3-Clause License.
 * See the LICENSE file in the project root for license information.
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */