import {
    updateProfileSchema,
    requestEmailChangeSchema,
    verifyEmailChangeSchema,
    requestPasswordChangeSchema,
    confirmPasswordChangeSchema,
    changeUsernameSchema,
    verifyOldEmailForChangeSchema,
} from "../validators/profileValidator";
import {
    createVerificationCode,
    verifyCode,
} from "../services/verificationService";
import {
    toPublicUrl,
    deleteFile,
} from "../services/fileService";
import {
    AppError,
    Conflict,
} from "../utils/AppError";
import {
    assertNotSpam,
    checkSpam,
} from "../services/spamDetection";
import { signEmailVerifyToken } from "../utils/token";
import { VerificationCode } from "../models/VerificationCode";
import type { Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { ErrorCodes } from "../utils/errorCodes";
import { publicUser } from "./authController";
import { validate } from "../utils/validate";
import { Session } from "../models/Session";
import { User } from "../models/User";

/**
 * GET /api/profile/me
 * Retrieve the authenticated user's profile.
 */
export const getMe = asyncHandler(async (req: any, res: Response) => {
    const user = await User.findById(req.user._id).lean();

    if (!user) {
        throw new AppError(404, ErrorCodes.UNAUTHENTICATED);
    }

    res.json({
        ok: true,
        user: publicUser(user),
    });

    /*
     * Aggregate project and review statistics.
     *
     * Uncomment this block when the Project and Review models
     * are imported and the statistics endpoint is required.
     *
     * const [projectStats, reviewStats] = await Promise.all([
     *     Project.aggregate([
     *         { $match: { owner: user._id } },
     *         {
     *             $group: {
     *                 _id: null,
     *                 projects: { $sum: 1 },
     *                 downloads: { $sum: "$downloads" },
     *             },
     *         },
     *     ]),
     *     Review.aggregate([
     *         {
     *             $lookup: {
     *                 from: "projects",
     *                 localField: "project",
     *                 foreignField: "_id",
     *                 as: "project",
     *             },
     *         },
     *         { $unwind: "$project" },
     *         { $match: { "project.owner": user._id } },
     *         {
     *             $group: {
     *                 _id: null,
     *                 reviews: { $sum: 1 },
     *                 rating: { $avg: "$rating" },
     *             },
     *         },
     *     ]),
     * ]);
     *
     * res.json({
     *     ok: true,
     *     user: publicUser(user),
     *     stats: {
     *         projects: projectStats[0]?.projects ?? 0,
     *         downloads: projectStats[0]?.downloads ?? 0,
     *         reviews: reviewStats[0]?.reviews ?? 0,
     *         rating: reviewStats[0]?.rating ?? null,
     *     },
     * });
     */
});

/**
 * PATCH /api/profile/me
 * Update the authenticated user's name and biography.
 */
export const updateProfile = asyncHandler(async (req: any, res: Response) => {
    const data = validate(updateProfileSchema, req.body);

    const user = await User.findById(req.user._id);

    if (!user) {
        throw new AppError(404, ErrorCodes.UNAUTHENTICATED);
    }

    // Validate the biography to prevent spam and duplicate content.
    if (data.bio !== undefined && data.bio.trim().length > 0) {
        await assertNotSpam(data.bio, {
            minLength: 5,
            maxLinks: 40,
            checkHashDuplicate: true,
            userId: String(user._id),
            field: "profile.bio",
            allowTables: true,
        });
    }

    if (data.name !== undefined) {
        user.name = data.name;
    }

    if (data.bio !== undefined) {
        user.bio = data.bio;
    }

    await user.save();

    // Collect non-blocking spam warnings for the updated biography.
    const spamCheck = data.bio
        ? await checkSpam(data.bio, { minLength: 5, maxLinks: 5 })
        : null;

    res.json({
        ok: true,
        message: "Profile updated successfully.",
        user: publicUser(user),
        ...(spamCheck?.warnings.length
            ? { warnings: spamCheck.warnings }
            : {}),
    });
});

/**
 * PATCH /api/profile/username
 * Update the authenticated user's username.
 */
export const changeUsername = asyncHandler(async (req: any, res: Response) => {
    const data = validate(changeUsernameSchema, req.body);
    const usernameLower = data.username.toLowerCase();

    // Ensure the username is unique, regardless of letter casing.
    const existing = await User.findOne({
        usernameLower,
        _id: { $ne: req.user._id },
    }).lean();

    if (existing) {
        throw Conflict(ErrorCodes.USERNAME_TAKEN, undefined, {
            field: "username",
        });
    }

    const user = await User.findById(req.user._id);

    if (!user) {
        throw new AppError(404, ErrorCodes.UNAUTHENTICATED);
    }

    user.username = data.username;
    user.usernameLower = usernameLower;

    await user.save();

    res.json({
        ok: true,
        message: "Username updated successfully.",
        user: publicUser(user),
    });
});

/**
 * POST /api/profile/avatar
 * Upload and assign a new profile picture.
 */
export const uploadAvatar = asyncHandler(async (req: any, res: Response) => {
    const file = req.file as Express.Multer.File | undefined;

    if (!file) {
        throw new AppError(400, ErrorCodes.NO_FILE_PROVIDED);
    }

    const user = await User.findById(req.user._id);

    if (!user) {
        throw new AppError(404, ErrorCodes.UNAUTHENTICATED);
    }

    // Remove the existing profile picture before assigning the new one.
    if (user.avatar?.url) {
        await deleteFile(user.avatar.url);
    }

    user.avatar = {
        url: toPublicUrl(file.path),
        filename: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        uploadedAt: new Date(),
    };

    await user.save();

    res.json({
        ok: true,
        message: "Profile picture updated successfully.",
        avatar: user.avatar,
    });
});

/**
 * DELETE /api/profile/avatar
 * Remove the authenticated user's profile picture.
 */
export const deleteAvatar = asyncHandler(async (req: any, res: Response) => {
    const user = await User.findById(req.user._id);

    if (!user) {
        throw new AppError(404, ErrorCodes.UNAUTHENTICATED);
    }

    if (user.avatar?.url) {
        await deleteFile(user.avatar.url);
    }

    user.avatar = null;
    await user.save();

    res.json({
        ok: true,
        message: "Profile picture deleted successfully.",
    });
});

/**
 * POST /api/profile/email/request
 * Initiate an email address change by sending a verification code
 * to the user's current email address.
 */
export const requestEmailChange = asyncHandler(async (req: any, res: Response) => {
    const data = validate(requestEmailChangeSchema, req.body);

    const user = await User.findById(req.user._id).select("+password");

    if (!user) {
        throw new AppError(404, ErrorCodes.UNAUTHENTICATED);
    }

    // Prevent multiple concurrent email change requests.
    if (user.pendingEmail) {
        throw new AppError(
            400,
            ErrorCodes.VALIDATION_ERROR,
            user.pendingEmail.oldVerified
                ? "Your email address is being changed. Verify the new address or cancel the request before proceeding."
                : "An email change request is already in progress. Complete or cancel the existing request before proceeding."
        );
    }

    // Verify the user's password before initiating the change.
    const isPasswordValid = await user.comparePassword(data.password);

    if (!isPasswordValid) {
        throw new AppError(
            401,
            ErrorCodes.INVALID_CREDENTIALS,
            "The password is incorrect.",
            {
                field: "password",
            }
        );
    }

    // Ensure the new email address differs from the current one.
    if (data.newEmail === user.email.toLowerCase()) {
        throw new AppError(
            400,
            ErrorCodes.VALIDATION_ERROR,
            "The new email address must differ from the current email address."
        );
    }

    // Check whether the requested email address is already in use.
    const existing = await User.findOne({
        email: data.newEmail,
        _id: { $ne: user._id },
    }).lean();

    if (existing) {
        throw Conflict(ErrorCodes.EMAIL_TAKEN, undefined, {
            field: "newEmail",
        });
    }

    // Send a verification code to the current email address.
    await createVerificationCode({
        userId: user._id,
        purpose: "change_email_old",
        targetEmail: user.email,
        userName: user.name,
        req,
        ttlMinutes: 10,
    });

    // Store the pending email change and its expiration time.
    user.pendingEmail = {
        newEmail: data.newEmail,
        previousEmail: user.email,
        oldVerified: false,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        requestedAt: new Date(),
    };

    await user.save();

    res.json({
        ok: true,
        step: "old_email_code",
        message: `A verification code has been sent to your current email address (${user.email}).`,
        currentEmail: user.email,
        newEmail: data.newEmail,
        expiresIn: 600,
    });
});

/**
 * POST /api/profile/email/verify-old
 * Verify ownership of the current email address, apply the email change,
 * and initiate verification of the new address.
 */
export const verifyOldEmailForChange = asyncHandler(
    async (req: any, res: Response) => {
        const data = validate(verifyOldEmailForChangeSchema, req.body);

        const user = await User.findById(req.user._id);

        if (!user) {
            throw new AppError(404, ErrorCodes.UNAUTHENTICATED);
        }

        if (!user.pendingEmail) {
            throw new AppError(
                400,
                ErrorCodes.VALIDATION_ERROR,
                "No active email change request was found."
            );
        }

        if (user.pendingEmail.oldVerified) {
            throw new AppError(
                400,
                ErrorCodes.VALIDATION_ERROR,
                "The current email address has already been verified."
            );
        }

        const oldEmail = user.pendingEmail.previousEmail;
        const newEmail = user.pendingEmail.newEmail;

        // Verify the code sent to the current email address.
        await verifyCode({
            userId: user._id,
            purpose: "change_email_old",
            code: data.code,
            targetEmail: oldEmail,
        });

        // Recheck email availability to prevent conflicts during the process.
        const existing = await User.findOne({
            email: newEmail,
            _id: { $ne: user._id },
        }).lean();

        if (existing) {
            user.pendingEmail = null;
            await user.save();

            throw Conflict(ErrorCodes.EMAIL_TAKEN);
        }

        // Apply the new address without marking it as verified.
        user.email = newEmail;
        user.emailVerified = false;
        user.emailVerifiedAt = null;

        // Retain the pending request to support reverting the email change.
        user.pendingEmail.oldVerified = true;
        user.pendingEmail.expiresAt = new Date(
            Date.now() + 24 * 60 * 60 * 1000
        );

        await user.save();

        // Send a verification code to the new email address.
        try {
            await createVerificationCode({
                userId: user._id,
                purpose: "verify_email",
                targetEmail: newEmail,
                userName: user.name,
                req,
                ttlMinutes: 10,
            });
        } catch (err) {
            console.warn(
                "[verifyOldEmailForChange] Failed to send the verification code:",
                (err as Error).message
            );
        }

        // Generate a token for the email verification page.
        const verifyToken = signEmailVerifyToken(
            user._id.toString(),
            newEmail
        );

        console.log(
            `[EMAIL CHANGED] user=${user._id} ${oldEmail} -> ${newEmail} (unverified)`
        );

        res.json({
            ok: true,
            step: "new_email_verify",
            message: `Your email address has been changed to ${newEmail}. A verification code has been sent to the new address.`,
            previousEmail: oldEmail,
            newEmail,
            verifyToken,
            expiresIn: 600,
        });
    }
);

/**
 * DELETE /api/profile/email/pending
 * Cancel an active email change request and restore the previous address
 * if the change has already been applied.
 */
export const cancelEmailChange = asyncHandler(async (req: any, res: Response) => {
    const user = await User.findById(req.user._id);

    if (!user) {
        throw new AppError(404, ErrorCodes.UNAUTHENTICATED);
    }

    if (!user.pendingEmail) {
        throw new AppError(
            400,
            ErrorCodes.VALIDATION_ERROR,
            "No active email change request was found."
        );
    }

    const wasInTransition = user.pendingEmail.oldVerified;
    const previousEmail = user.pendingEmail.previousEmail;

    // Restore the previous email address if the new address was already applied.
    if (wasInTransition) {
        user.email = previousEmail;
        user.emailVerified = true;
        user.emailVerifiedAt = new Date();
    }

    user.pendingEmail = null;

    await user.save();

    // Remove unused verification codes associated with the canceled request.
    await VerificationCode.deleteMany({
        user: user._id,
        purpose: { $in: ["change_email_old", "verify_email"] },
        consumedAt: null,
    });

    res.json({
        ok: true,
        message: wasInTransition
            ? `Your email address has been reverted to ${previousEmail}.`
            : "The email change request has been canceled.",
        reverted: wasInTransition,
        email: user.email,
    });
});

/**
 * POST /api/profile/email/verify
 * Verify the new email address and finalize the email change.
 */
export const verifyEmailChange = asyncHandler(async (req: any, res: Response) => {
    const data = validate(verifyEmailChangeSchema, req.body);

    const user = await User.findById(req.user._id);

    if (!user) {
        throw new AppError(404, ErrorCodes.UNAUTHENTICATED);
    }

    if (!user.pendingEmail) {
        throw new AppError(
            400,
            ErrorCodes.VALIDATION_ERROR,
            "No active email change request was found."
        );
    }

    const newEmail = user.pendingEmail.newEmail;

    // Verify the submitted code for the new email address.
    await verifyCode({
        userId: user._id,
        purpose: "change_email_new",
        code: data.code,
        targetEmail: newEmail,
    });

    // Recheck email uniqueness before finalizing the change.
    const existing = await User.findOne({
        email: newEmail,
        _id: { $ne: user._id },
    }).lean();

    if (existing) {
        user.pendingEmail = null;
        await user.save();

        throw Conflict(ErrorCodes.EMAIL_TAKEN);
    }

    // Finalize the email change and mark the new address as verified.
    const oldEmail = user.email;

    user.email = newEmail;
    user.emailVerified = true;
    user.pendingEmail = null;

    await user.save();

    // TODO: Notify the previous email address that the change was completed.
    console.log(`[EMAIL CHANGED] ${oldEmail} -> ${newEmail}`);

    res.json({
        ok: true,
        message: "Your email address has been updated successfully.",
        user: publicUser(user),
    });
});

/**
 * POST /api/profile/password/request
 * Verify the current password and send a verification code
 * to the user's registered email address.
 */
export const requestPasswordChange = asyncHandler(
    async (req: any, res: Response) => {
        const data = validate(requestPasswordChangeSchema, req.body);

        const user = await User.findById(req.user._id).select("+password");

        if (!user) {
            throw new AppError(404, ErrorCodes.UNAUTHENTICATED);
        }

        const isPasswordValid = await user.comparePassword(
            data.currentPassword
        );

        if (!isPasswordValid) {
            throw new AppError(
                401,
                ErrorCodes.INVALID_CREDENTIALS,
                "The current password is incorrect.",
                {
                    field: "currentPassword",
                }
            );
        }

        // Send a verification code to the user's registered email address.
        await createVerificationCode({
            userId: user._id,
            purpose: "change_password",
            targetEmail: user.email,
            userName: user.name,
            req,
        });

        res.json({
            ok: true,
            message: `A verification code has been sent to ${user.email}.`,
            email: user.email,
            expiresIn: 600,
        });
    }
);

/**
 * POST /api/profile/password/confirm
 * Verify the confirmation code, update the password, and revoke
 * all other active sessions for the authenticated user.
 */
export const confirmPasswordChange = asyncHandler(
    async (req: any, res: Response) => {
        const data = validate(confirmPasswordChangeSchema, req.body);

        const user = await User.findById(req.user._id);

        if (!user) {
            throw new AppError(404, ErrorCodes.UNAUTHENTICATED);
        }

        // Verify the submitted password change code.
        await verifyCode({
            userId: user._id,
            purpose: "change_password",
            code: data.code,
        });

        // Update the password; the pre-save hook handles password hashing.
        user.password = data.newPassword;

        await user.save();

        // Revoke all active sessions except the current session.
        const currentSessionId = req.session?.sessionId;

        const result = await Session.deleteMany({
            user: user._id,
            ...(currentSessionId
                ? { sessionId: { $ne: currentSessionId } }
                : {}),
        });

        console.log(
            `[PASSWORD CHANGED] user=${user._id} — revoked ${result.deletedCount} sessions`
        );

        res.json({
            ok: true,
            message: "Your password has been changed successfully. You have been signed out of all other devices.",
            revokedSessions: result.deletedCount || 0,
        });
    }
);

/**
 * Copyright (c) 2026 Sobhan Rasoulzadeh Asl (Sobhan-SRZA / Mr. Sinre)
 *
 * Licensed under the BSD 3-Clause License.
 * Refer to the LICENSE file in the project root for license information.
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */