import {
    updateProfileSchema,
    requestEmailChangeSchema,
    verifyEmailChangeSchema,
    requestPasswordChangeSchema,
    confirmPasswordChangeSchema,
    changeUsernameSchema,
    verifyOldEmailForChangeSchema
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
import { signEmailVerifyToken } from "../utils/token";
import { assertNotSpam, checkSpam } from "../services/spamDetection";

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
    if (!user)
        throw new AppError(404, ErrorCodes.UNAUTHENTICATED);

    /* ---------------- Spam check for bio ---------------- */
    if (data.bio !== undefined && data.bio.trim().length > 0) {
        await assertNotSpam(data.bio, {
            minLength: 5,
            maxLinks: 40,
            checkHashDuplicate: true,
            userId: String(user._id),
            field: 'profile.bio',
            allowTables: true,
        });
    }


    if (data.name !== undefined)
        user.name = data.name;

    if (data.bio !== undefined)
        user.bio = data.bio;

    await user.save();

    const spamCheck = data.bio
        ? await checkSpam(data.bio, { minLength: 5, maxLinks: 5 })
        : null;

    res.json({
        ok: true,
        message: "پروفایل به‌روزرسانی شد",
        user: publicUser(user),
        ...(spamCheck?.warnings.length ? { warnings: spamCheck.warnings } : {}),
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
   REQUEST EMAIL CHANGE — Step 1: code to OLD email
   ================================================================== */
export const requestEmailChange = asyncHandler(async (req: any, res: Response) => {
    const data = validate(requestEmailChangeSchema, req.body);

    const user = await User.findById(req.user._id).select("+password");
    if (!user)
        throw new AppError(404, ErrorCodes.UNAUTHENTICATED);

    /* ---------- already in transition? ---------- */
    if (user.pendingEmail) {
        throw new AppError(
            400,
            ErrorCodes.VALIDATION_ERROR,
            user.pendingEmail.oldVerified
                ? "ایمیل شما در حال تغییر است. ابتدا ایمیل جدید را تایید یا لغو کنید"
                : "درخواست تغییر ایمیل قبلی در جریان است. ابتدا آن را تکمیل یا لغو کنید"
        );
    }

    /* ---------- password ---------- */
    const ok = await user.comparePassword(data.password);
    if (!ok) {
        throw new AppError(401, ErrorCodes.INVALID_CREDENTIALS, "رمز عبور اشتباه است", {
            field: "password",
        });
    }

    /* ---------- new email checks ---------- */
    if (data.newEmail === user.email.toLowerCase()) {
        throw new AppError(400, ErrorCodes.VALIDATION_ERROR, "ایمیل جدید با ایمیل فعلی یکسان است");
    }

    const existing = await User.findOne({
        email: data.newEmail,
        _id: { $ne: user._id }
    }).lean();

    if (existing) {
        throw Conflict(ErrorCodes.EMAIL_TAKEN, undefined, { field: "newEmail" });
    }

    /* ---------- send code to OLD email ---------- */
    await createVerificationCode({
        userId: user._id,
        purpose: "change_email_old",
        targetEmail: user.email,
        userName: user.name,
        req,
        ttlMinutes: 10
    });

    /* ---------- save pending ---------- */
    user.pendingEmail = {
        newEmail: data.newEmail,
        previousEmail: user.email,
        oldVerified: false,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        requestedAt: new Date()
    };

    await user.save();

    res.json({
        ok: true,
        step: "old_email_code",
        message: `کد تایید به ایمیل فعلی شما (${user.email}) ارسال شد`,
        currentEmail: user.email,
        newEmail: data.newEmail,
        expiresIn: 600
    });
});

/* ==================================================================
   VERIFY OLD EMAIL — Step 2: verify code from OLD email,
                                  change email, send code to NEW email
   ================================================================== */
export const verifyOldEmailForChange = asyncHandler(async (req: any, res: Response) => {
    const data = validate(verifyOldEmailForChangeSchema, req.body);

    const user = await User.findById(req.user._id);
    if (!user)
        throw new AppError(404, ErrorCodes.UNAUTHENTICATED);

    if (!user.pendingEmail) {
        throw new AppError(400, ErrorCodes.VALIDATION_ERROR, "درخواست تغییر ایمیل فعالی وجود ندارد");
    }

    if (user.pendingEmail.oldVerified) {
        throw new AppError(400, ErrorCodes.VALIDATION_ERROR, "ایمیل قبلی قبلاً تایید شده");
    }

    const oldEmail = user.pendingEmail.previousEmail;
    const newEmail = user.pendingEmail.newEmail;

    /* ---------- verify code with purpose change_email_old ---------- */
    await verifyCode({
        userId: user._id,
        purpose: "change_email_old",
        code: data.code,
        targetEmail: oldEmail
    });

    /* ---------- re-check newEmail uniqueness ---------- */
    const dup = await User.findOne({
        email: newEmail,
        _id: { $ne: user._id }
    }).lean();

    if (dup) {
        user.pendingEmail = null;
        await user.save();

        throw Conflict(ErrorCodes.EMAIL_TAKEN);
    }

    /* ============================================================
       ✅ تغییر ایمیل — ولی ایمیل جدید UNVERIFIED
       ============================================================ */
    user.email = newEmail;
    user.emailVerified = false;
    user.emailVerifiedAt = null;

    // pendingEmail رو نگه دار برای گزینه‌ی revert
    user.pendingEmail.oldVerified = true;
    user.pendingEmail.expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

    await user.save();

    /* ---------- send code to NEW email for verification ---------- */
    try {
        await createVerificationCode({
            userId: user._id,
            purpose: "verify_email",
            targetEmail: newEmail,
            userName: user.name,
            req,
            ttlMinutes: 10
        });
    }

    catch (err) {
        console.warn("[verifyOldEmailForChange] send verify failed:", (err as Error).message);
    }

    /* ---------- issue verifyToken for /verify-email page ---------- */
    const verifyToken = signEmailVerifyToken(user._id.toString(), newEmail);

    console.log(
        `🔄 [EMAIL CHANGED] user=${user._id} ${oldEmail} → ${newEmail} (unverified)`
    );

    res.json({
        ok: true,
        step: "new_email_verify",
        message: `ایمیل شما به ${newEmail} تغییر کرد. کد تایید به آن ارسال شد`,
        previousEmail: oldEmail,
        newEmail,
        verifyToken,
        expiresIn: 600
    });
});

/* ==================================================================
   DELETE /api/profile/email/pending — لغو درخواست
   CANCEL EMAIL CHANGE — با revert اگه transition
   ================================================================== */
export const cancelEmailChange = asyncHandler(async (req: any, res: Response) => {
    const user = await User.findById(req.user._id);
    if (!user)
        throw new AppError(404, ErrorCodes.UNAUTHENTICATED);

    if (!user.pendingEmail) {
        throw new AppError(400, ErrorCodes.VALIDATION_ERROR, "درخواست تغییر ایمیل فعالی وجود ندارد");
    }

    const wasInTransition = user.pendingEmail.oldVerified;
    const previousEmail = user.pendingEmail.previousEmail;

    /* ---------- revert اگر transition بود ---------- */
    if (wasInTransition) {
        user.email = previousEmail;
        user.emailVerified = true;
        user.emailVerifiedAt = new Date();
    }

    user.pendingEmail = null;
    await user.save();

    /* ---------- حذف همه کدهای در جریان ---------- */
    await VerificationCode.deleteMany({
        user: user._id,
        purpose: { $in: ["change_email_old", "verify_email"] },
        consumedAt: null
    });

    res.json({
        ok: true,
        message: wasInTransition
            ? `ایمیل شما به ${previousEmail} بازگشت`
            : "درخواست تغییر ایمیل لغو شد",

        reverted: wasInTransition,
        email: user.email
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
        userName: user.name,
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