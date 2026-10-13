import {
    VerificationCode,
    type VerificationPurpose
} from "../models/VerificationCode";
import { ErrorCodes } from "../utils/errorCodes";
import type { Request } from "express";
import type { Types } from "mongoose";
import { AppError } from "../utils/AppError";

/* ==================================================================
   تنظیمات
   ================================================================== */
const TTL_MINUTES = 10;         // کد ۱۰ دقیقه اعتبار
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_SEC = 60;  // حداقل فاصله بین دو درخواست

/* ==================================================================
   ساخت و ذخیره کد جدید
   ================================================================== */
export interface CreateCodeOptions {
    userId: Types.ObjectId | string;
    purpose: VerificationPurpose;
    targetEmail?: string;
    req?: Request;
    ttlMinutes?: number;
}

export async function createVerificationCode(opts: CreateCodeOptions) {
    const { userId, purpose, targetEmail, req, ttlMinutes = TTL_MINUTES } = opts;

    /* ---------- جلوگیری از درخواست‌های پشت‌سرهم ---------- */
    const recent = await VerificationCode.findOne({
        user: userId,
        purpose,
        consumedAt: null,
        requestedAt: { $gt: new Date(Date.now() - RESEND_COOLDOWN_SEC * 1000) }
    }).sort({ createdAt: -1 });

    if (recent) {
        const elapsed = (Date.now() - new Date(recent.createdAt).getTime()) / 1000;
        const remaining = Math.ceil(RESEND_COOLDOWN_SEC - elapsed);
        throw new AppError(
            429,
            ErrorCodes.TOO_MANY_ATTEMPTS,
            `لطفاً ${remaining} ثانیه دیگر تلاش کنید`
        );
    }

    /* ---------- حذف کدهای قبلی همین purpose ---------- */
    await VerificationCode.deleteMany({
        user: userId,
        purpose,
        consumedAt: null
    });

    /* ---------- ساخت کد جدید ---------- */
    const { code, codeHash, salt } = (VerificationCode as any).generateCode();
    const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);

    await VerificationCode.create({
        user: userId,
        purpose,
        codeHash,
        salt,
        targetEmail: targetEmail?.toLowerCase() || null,
        expiresAt,
        maxAttempts: MAX_ATTEMPTS,
        ip: req ? getClientIp(req) : undefined,
        userAgent: req?.headers["user-agent"] as string | undefined
    });

    /* ==================================================================
       📧 TODO: ارسال ایمیل
       فعلاً فقط لاگ می‌کنیم
       ================================================================== */
    console.log("");
    console.log("═══════════════════════════════════════════════════════");
    console.log(`📧 [VERIFICATION CODE] purpose=${purpose}`);
    console.log(`   to        : ${targetEmail || "(user email)"}`);
    console.log(`   code      : \x1b[1;32m${code}\x1b[0m`);
    console.log(`   expires   : ${expiresAt.toLocaleString("fa-IR")}`);
    console.log(`   ttl       : ${ttlMinutes} دقیقه`);
    console.log("═══════════════════════════════════════════════════════");
    console.log("");

    return { code, expiresAt };
}

/* ==================================================================
   تایید کد
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

    /* ---------- چک تعداد تلاش ---------- */
    if (record.attempts >= record.maxAttempts) {
        await VerificationCode.deleteOne({ _id: record._id });
        throw new AppError(
            429,
            ErrorCodes.TOO_MANY_ATTEMPTS,
            "تعداد تلاش‌های شما بیش از حد مجاز است. کد جدید درخواست کنید"
        );
    }

    /* ---------- مقایسه hash ---------- */
    const incomingHash = (VerificationCode as any).hashCode(code, record.salt);

    if (incomingHash !== record.codeHash) {
        record.attempts += 1;
        await record.save();

        const remaining = record.maxAttempts - record.attempts;
        throw new AppError(
            400,
            ErrorCodes.INVALID_TOKEN,
            `کد اشتباه است. ${remaining} تلاش باقی‌مانده`
        );
    }

    /* ---------- موفق: mark as consumed ---------- */
    record.consumedAt = new Date();
    await record.save();

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