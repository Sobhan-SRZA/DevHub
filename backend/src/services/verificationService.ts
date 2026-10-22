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
   تنظیمات
   ================================================================== */
const TTL_MINUTES = 10;
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_SEC = 60;

/* ==================================================================
   Create + Send
   ================================================================== */
export interface CreateCodeOptions {
    userId: Types.ObjectId | string;
    purpose: VerificationPurpose;
    targetEmail?: string;          
    userName?: string;
    req?: Request;
    ttlMinutes?: number;
}

export async function createVerificationCode(opts: CreateCodeOptions) {
    const {
        userId,
        purpose,
        targetEmail,
        userName,
        req,
        ttlMinutes = TTL_MINUTES
    } = opts;

    /* ---------- cooldown ---------- */
    const recent = await VerificationCode.findOne({
        user: userId,
        purpose,
        consumedAt: null,
        requestedAt: { $gt: new Date(Date.now() - RESEND_COOLDOWN_SEC * 1000) }
    }).sort({ createdAt: -1 });

    if (recent) {
        const elapsed = (Date.now() - new Date(recent.createdAt).getTime()) / 1000;
        const remaining = Math.max(1, Math.ceil(RESEND_COOLDOWN_SEC - elapsed));
        throw new AppError(
            429,
            ErrorCodes.TOO_MANY_ATTEMPTS,
            `لطفاً ${remaining} ثانیه دیگر تلاش کنید`
        );
    }

    /* ---------- resolve recipient ---------- */
    let toEmail = targetEmail?.toLowerCase().trim();
    let displayName = userName;

    if (!toEmail) {
        const user = await User.findById(userId).select("email name").lean();
        if (!user) {
            throw new AppError(404, ErrorCodes.UNAUTHENTICATED, "کاربر یافت نشد");
        }

        toEmail = user.email;
        displayName = displayName || user.name;
    }

    if (!toEmail) {
        throw new AppError(400, ErrorCodes.EMAIL_INVALID, "گیرنده ایمیل مشخص نیست");
    }

    /* ---------- delete old codes ---------- */
    await VerificationCode.deleteMany({
        user: userId,
        purpose,
        consumedAt: null
    });

    /* ---------- generate ---------- */
    const { code, codeHash, salt } = (VerificationCode as any).generateCode();
    const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);

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

    /* ---------- send via mailer ---------- */
    try {
        await sendOtpEmail({
            to: toEmail,
            code,
            purpose,
            expiresInMinutes: ttlMinutes,
            userName: displayName,
            ip: req ? getClientIp(req) : undefined
        });
    } 
    
    catch (err) {
        // اگه ارسال شکست خورد، کد رو پاک کن (نمی‌خوایم یتیم بمونه)
        await VerificationCode.deleteMany({
            user: userId,
            purpose,
            targetEmail: toEmail,
            consumedAt: null
        }).catch(() => { });

        throw err;
    }

    return { code, expiresAt, sentTo: toEmail };
}

/* ==================================================================
   Verify
   ================================================================== */
export interface VerifyCodeOptions {
    userId: Types.ObjectId | string;
    purpose: VerificationPurpose;
    code: string;
    targetEmail?: string;
}

export async function verifyCode(opts: VerifyCodeOptions): Promise<boolean> {
    const { userId, purpose, code, targetEmail } = opts;

    const record = await VerificationCode.findOne({
        user: userId,
        purpose,
        consumedAt: null,
        expiresAt: { $gt: new Date() },
        ...(targetEmail ? { targetEmail: targetEmail.toLowerCase() } : {})
    }).sort({ createdAt: -1 });

    if (!record) {
        throw new AppError(400, ErrorCodes.INVALID_TOKEN, "کد نامعتبر یا منقضی شده است");
    }

    if (record.attempts >= record.maxAttempts) {
        await VerificationCode.deleteOne({ _id: record._id });
        throw new AppError(
            429,
            ErrorCodes.TOO_MANY_ATTEMPTS,
            "تعداد تلاش‌های شما بیش از حد مجاز است. کد جدید درخواست کنید"
        );
    }

    const incomingHash = (VerificationCode as any).hashCode(code, record.salt);

    if (incomingHash !== record.codeHash) {
        record.attempts += 1;

        if (record.attempts >= record.maxAttempts) {
            await VerificationCode.deleteOne({ _id: record._id });
            throw new AppError(
                429,
                ErrorCodes.TOO_MANY_ATTEMPTS,
                "تعداد تلاش‌ها بیش از حد مجاز. کد جدید درخواست کنید"
            );
        }

        await record.save();
        const remaining = record.maxAttempts - record.attempts;

        throw new AppError(
            400,
            ErrorCodes.INVALID_TOKEN,
            `کد اشتباه است. ${remaining} تلاش باقی‌مانده`
        );
    }

    await VerificationCode.deleteOne({ _id: record._id });
    return true;
}

/* ==================================================================
   Helper — IP
   ================================================================== */
function getClientIp(req: Request): string {
    const fwd = req.headers["x-forwarded-for"];
    if (typeof fwd === "string") 
        return fwd.split(",")[0].trim();

    if (Array.isArray(fwd) && fwd.length)
         return fwd[0];
        
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