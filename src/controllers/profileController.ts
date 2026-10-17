import {
    updateProfileSchema,
    requestEmailChangeSchema,
    verifyEmailChangeSchema,
    requestPasswordChangeSchema,
    confirmPasswordChangeSchema,
    changeUsernameSchema
} from "../validators/profileValidator";
import {
    createVerificationCode,
    verifyCode
} from "../services/verificationService";
import {
    toPublicUrl,
    deleteFile
} from "../services/fileService";
import {
    AppError,
    Conflict
} from "../utils/AppError";
import { VerificationCode } from "../models/VerificationCode";
import type { Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { ErrorCodes } from "../utils/errorCodes";
import { publicUser } from "./authController";
import { validate } from "../utils/validate";
import { Session } from "../models/Session";
import { User } from "../models/User";

/* ==================================================================
   GET /api/profile/me — اطلاعات کامل کاربر
   ================================================================== */
export const getMe = asyncHandler(async (req: any, res: Response) => {
    const user = await User.findById(req.user._id).lean();
    if (!user) throw new AppError(404, ErrorCodes.UNAUTHENTICATED);

    res.json({
        ok: true,
        user: publicUser(user)
    });
});

/* ==================================================================
   PATCH /api/profile/me — ویرایش نام و بیو
   ================================================================== */
export const updateProfile = asyncHandler(async (req: any, res: Response) => {
    const data = validate(updateProfileSchema, req.body);

    const user = await User.findById(req.user._id);
    if (!user) throw new AppError(404, ErrorCodes.UNAUTHENTICATED);

    if (data.name !== undefined)
        user.name = data.name;

    if (data.bio !== undefined)
        user.bio = data.bio;

    await user.save();

    res.json({
        ok: true,
        message: "پروفایل به‌روزرسانی شد",
        user: publicUser(user)
    });
});

/* ==================================================================
   PATCH /api/profile/username — تغییر نام کاربری
   ================================================================== */
export const changeUsername = asyncHandler(async (req: any, res: Response) => {
    const data = validate(changeUsernameSchema, req.body);

    const usernameLower = data.username.toLowerCase();

    // چک تکراری (case-insensitive)
    const existing = await User.findOne({
        usernameLower,
        _id: { $ne: req.user._id }
    }).lean();

    if (existing) {
        throw Conflict(ErrorCodes.USERNAME_TAKEN, undefined, { field: "username" });
    }

    const user = await User.findById(req.user._id);
    if (!user)
        throw new AppError(404, ErrorCodes.UNAUTHENTICATED);

    user.username = data.username;
    user.usernameLower = usernameLower;
    await user.save();

    res.json({
        ok: true,
        message: "نام کاربری تغییر کرد",
        user: publicUser(user)
    });
});

/* ==================================================================
   POST /api/profile/avatar — آپلود عکس پروفایل
   ================================================================== */
export const uploadAvatar = asyncHandler(async (req: any, res: Response) => {
    const file = req.file as Express.Multer.File | undefined;
    if (!file)
        throw new AppError(400, ErrorCodes.NO_FILE_PROVIDED);

    const user = await User.findById(req.user._id);
    if (!user)
        throw new AppError(404, ErrorCodes.UNAUTHENTICATED);

    // پاک کردن آواتار قبلی
    if (user.avatar?.url) {
        await deleteFile(user.avatar.url);
    }

    user.avatar = {
        url: toPublicUrl(file.path),
        filename: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        uploadedAt: new Date()
    };

    await user.save();

    res.json({
        ok: true,
        message: "عکس پروفایل به‌روزرسانی شد",
        avatar: user.avatar
    });
});

/* ==================================================================
   DELETE /api/profile/avatar
   ================================================================== */
export const deleteAvatar = asyncHandler(async (req: any, res: Response) => {
    const user = await User.findById(req.user._id);
    if (!user)
        throw new AppError(404, ErrorCodes.UNAUTHENTICATED);

    if (user.avatar?.url) {
        await deleteFile(user.avatar.url);
    }

    user.avatar = null;
    await user.save();

    res.json({ ok: true, message: "عکس پروفایل حذف شد" });
});

/* ==================================================================
   POST /api/profile/email/request — درخواست تغییر ایمیل
   ================================================================== */
export const requestEmailChange = asyncHandler(async (req: any, res: Response) => {
    const data = validate(requestEmailChangeSchema, req.body);

    const user = await User.findById(req.user._id).select("+password");
    if (!user)
        throw new AppError(404, ErrorCodes.UNAUTHENTICATED);

    /* ---------- تایید رمز فعلی ---------- */
    const ok = await user.comparePassword(data.password);
    if (!ok) {
        throw new AppError(401, ErrorCodes.INVALID_CREDENTIALS, "رمز عبور اشتباه است", {
            field: "password"
        });
    }

    /* ---------- چک ایمیل جدید ---------- */
    if (data.newEmail === user.email.toLowerCase()) {
        throw new AppError(400, ErrorCodes.VALIDATION_ERROR, "ایمیل جدید با ایمیل فعلی یکسان است");
    }

    const existing = await User.findOne({
        email: data.newEmail,
        _id: { $ne: user._id },
    }).lean();

    if (existing) {
        throw Conflict(ErrorCodes.EMAIL_TAKEN, undefined, { field: "newEmail" });
    }

    /* ---------- ساخت کد ---------- */
    await createVerificationCode({
        userId: user._id,
        purpose: "change_email_new",
        targetEmail: data.newEmail,
        req
    });

    /* ---------- ذخیره pendingEmail روی کاربر ---------- */
    user.pendingEmail = {
        newEmail: data.newEmail,
        codeHash: "", // hash داخل VerificationCode نگه داشته می‌شه
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        attempts: 0,
        requestedAt: new Date()
    };
    await user.save();

    res.json({
        ok: true,
        message: `کد تایید به ${data.newEmail} ارسال شد`,
        pendingEmail: data.newEmail,
        expiresIn: 600 // seconds
    });
});

/* ==================================================================
   POST /api/profile/email/verify — تایید کد
   ================================================================== */
export const verifyEmailChange = asyncHandler(async (req: any, res: Response) => {
    const data = validate(verifyEmailChangeSchema, req.body);

    const user = await User.findById(req.user._id);
    if (!user)
        throw new AppError(404, ErrorCodes.UNAUTHENTICATED);

    if (!user.pendingEmail) {
        throw new AppError(400, ErrorCodes.VALIDATION_ERROR, "درخواست تغییر ایمیل فعالی وجود ندارد");
    }

    const newEmail = user.pendingEmail.newEmail;

    /* ---------- تایید کد ---------- */
    await verifyCode({
        userId: user._id,
        purpose: "change_email_new",
        code: data.code,
        targetEmail: newEmail
    });

    /* ---------- چک مجدد یکتایی (شاید تو این فاصله کسی دیگه گرفت) ---------- */
    const dup = await User.findOne({
        email: newEmail,
        _id: { $ne: user._id }
    }).lean();

    if (dup) {
        user.pendingEmail = null;
        await user.save();
        throw Conflict(ErrorCodes.EMAIL_TAKEN);
    }

    /* ---------- اعمال تغییر ---------- */
    const oldEmail = user.email;
    user.email = newEmail;
    user.emailVerified = true;
    user.pendingEmail = null;
    await user.save();

    /* ---------- اطلاع به ایمیل قدیم (TODO: ایمیل بفرست) ---------- */
    console.log(`📧 [EMAIL CHANGED] ${oldEmail} → ${newEmail}`);

    res.json({
        ok: true,
        message: "ایمیل با موفقیت تغییر کرد",
        user: publicUser(user),
    });
});

/* ==================================================================
   DELETE /api/profile/email/pending — لغو درخواست
   ================================================================== */
export const cancelEmailChange = asyncHandler(async (req: any, res: Response) => {
    const user = await User.findById(req.user._id);
    if (!user)
        throw new AppError(404, ErrorCodes.UNAUTHENTICATED);

    user.pendingEmail = null;
    await user.save();

    // حذف کدهای مربوطه
    await VerificationCode.deleteMany({
        user: user._id,
        purpose: "change_email_new",
        consumedAt: null
    });

    res.json({ ok: true, message: "درخواست تغییر ایمیل لغو شد" });
});

/* ==================================================================
   POST /api/profile/password/request — درخواست تغییر رمز
   ================================================================== */
export const requestPasswordChange = asyncHandler(async (req: any, res: Response) => {
    const data = validate(requestPasswordChangeSchema, req.body);

    const user = await User.findById(req.user._id).select("+password");
    if (!user)
        throw new AppError(404, ErrorCodes.UNAUTHENTICATED);

    const ok = await user.comparePassword(data.currentPassword);
    if (!ok) {
        throw new AppError(401, ErrorCodes.INVALID_CREDENTIALS, "رمز عبور فعلی اشتباه است", {
            field: "currentPassword"
        });
    }

    // ارسال کد به ایمیل کاربر
    await createVerificationCode({
        userId: user._id,
        purpose: "change_password",
        targetEmail: user.email,
        req
    });

    res.json({
        ok: true,
        message: `کد تایید به ایمیل ${user.email} ارسال شد`,
        email: user.email,
        expiresIn: 600
    });
});

/* ==================================================================
   POST /api/profile/password/confirm — تایید و تغییر نهایی
   ================================================================== */
export const confirmPasswordChange = asyncHandler(async (req: any, res: Response) => {
    const data = validate(confirmPasswordChangeSchema, req.body);

    const user = await User.findById(req.user._id);
    if (!user)
        throw new AppError(404, ErrorCodes.UNAUTHENTICATED);

    // تایید کد
    await verifyCode({
        userId: user._id,
        purpose: "change_password",
        code: data.code
    });

    // اعمال رمز جدید (hash توسط pre-save)
    user.password = data.newPassword;
    await user.save();

    // خروج از همه سشن‌های دیگه
    const currentSessionId = req.session?.sessionId;
    const result = await Session.deleteMany({
        user: user._id,
        ...(currentSessionId ? { sessionId: { $ne: currentSessionId } } : {})
    });

    console.log(`🔒 [PASSWORD CHANGED] user=${user._id} — revoked ${result.deletedCount} sessions`);

    res.json({
        ok: true,
        message: "رمز عبور با تغییر کرد. از سایر دستگاه‌ها خارج شدید",
        revokedSessions: result.deletedCount || 0
    });
});

/**
 * Copyright (c) 2026 Sobhan Rasoulzadeh Asl (Sobhan-SRZA / Mr. Sinre)
 *
 * Licensed under the BSD 3-Clause License.
 * See the LICENSE file in the project root for license information.
 *F
 * SPDX-License-Identifier: BSD-3-Clause
 */