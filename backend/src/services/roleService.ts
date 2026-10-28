import {
    User,
    type UserRole
} from "../models/User";
import { ErrorCodes } from "../utils/errorCodes";
import { AppError } from "../utils/AppError";
import { Types } from "mongoose";

/* ==================================================================
   Helpers — سلسله‌مراتب
   ================================================================== */
const ROLE_RANK: Record<UserRole, number> = {
    user: 1,
    admin: 2,
    developer: 3
};

export function hasRole(user: any, minRole: UserRole): boolean {
    if (!user?.role)
        return false;

    return (ROLE_RANK[user.role as UserRole] || 0) >= (ROLE_RANK[minRole] || 0);
}

export function isAdmin(user: any): boolean {
    return hasRole(user, "admin");
}

export function isDeveloper(user: any): boolean {
    return user?.role === "developer";
}

/* ==================================================================
   Promote / Demote
   ================================================================== */
export interface ChangeRoleOptions {
    targetUserId: Types.ObjectId | string;
    newRole: UserRole;
    changedBy: Types.ObjectId | string;
    reason?: string;
}

export async function changeUserRole(opts: ChangeRoleOptions) {
    const { targetUserId, newRole, changedBy, reason } = opts;

    /* ---------- پیدا کردن کاربر هدف ---------- */
    const target = await User.findById(targetUserId);
    if (!target) {
        throw new AppError(404, ErrorCodes.UNAUTHENTICATED, "کاربر یافت نشد");
    }

    if (target.role === newRole) {
        throw new AppError(
            400,
            ErrorCodes.VALIDATION_ERROR,
            "نقش فعلی کاربر همین است"
        );
    }

    /* ---------- چک مجوز دهنده ---------- */
    const actor = await User.findById(changedBy);
    if (!actor) {
        throw new AppError(401, ErrorCodes.UNAUTHENTICATED);
    }

    // کاربر نمی‌تونه نقش خودش رو تغییر بده (جلوگیری از خود-ارتقایی)
    if (String(actor._id) === String(target._id)) {
        throw new AppError(
            403,
            ErrorCodes.PROJECT_NOT_OWNED,
            "نمی‌توانید نقش خودتان را تغییر دهید"
        );
    }

    // فقط developer می‌تونه developer بده
    if (newRole === "developer" && actor.role !== "developer") {
        throw new AppError(
            403,
            ErrorCodes.PROJECT_NOT_OWNED,
            "فقط developer می‌تواند نقش developer بدهد"
        );
    }

    // admin می‌تونه فقط user ↔ admin
    if (actor.role === "admin") {
        if (target.role === "developer" || newRole === "developer") {
            throw new AppError(
                403,
                ErrorCodes.PROJECT_NOT_OWNED,
                "ادمین نمی‌تواند نقشی در سطح developer را تغییر دهد"
            );
        }
    }

    // developer نمی‌تونه از خودش پایین‌تر بگیره (جلوگیری از قفل شدن سیستم)
    // ↑ این رو خودش رعایت می‌کنه چون خودش رو تغییر نمی‌ده

    /* ---------- اعمال تغییر ---------- */
    const previousRole = target.role;

    target.role = newRole;
    target.roleChangedBy = actor._id as any;
    target.roleChangedAt = new Date();
    target.roleChangeReason = reason || null;

    await target.save();

    /* ---------- Audit log ---------- */
    console.log(
        `🔐 [ROLE CHANGE] ${previousRole} → ${newRole}` +
        ` | target=${target._id} | by=${actor._id}` +
        (reason ? ` | reason: ${reason}` : "")
    );

    return {
        userId: target._id,
        previousRole,
        newRole
    };
}

/* ==================================================================
   Bootstrap — اطمینان از وجود حداقل یک developer
   ================================================================== */
export async function ensureDeveloperExists(): Promise<void> {
    const devCount = await User.countDocuments({ role: "developer" });

    if (devCount > 0)
        return;

    // 1) از ENV بخون
    const envEmail = process.env.DEVELOPER_EMAIL?.toLowerCase().trim();

    if (envEmail) {
        const user = await User.findOne({ email: envEmail });
        if (user) {
            user.role = "developer";
            user.roleChangedAt = new Date();
            user.roleChangeReason = "Bootstrap from DEVELOPER_EMAIL env";
            await user.save();
            console.log(`✅ Promoted ${envEmail} to developer (from ENV)`);

            return;
        }

        else {
            console.warn(
                `⚠️  DEVELOPER_EMAIL=${envEmail} set but user not found`
            );
        }
    }

    // 2) هیچ developer نداریم → قدیمی‌ترین کاربر رو developer کن
    const firstUser = await User.findOne({}).sort({ createdAt: 1 });

    if (firstUser) {
        firstUser.role = "developer";
        firstUser.roleChangedAt = new Date();
        firstUser.roleChangeReason = "Bootstrap: first registered user";
        await firstUser.save();
        
        console.log(
            `✅ Promoted first user (${firstUser.email}) to developer`
        );
    }

    else {
        console.warn(
            "⚠️  No users yet — first registered user will become developer"
        );
    }
}

/* ==================================================================
   First user hook — کاربر اول خودکار developer
   ================================================================== */
export async function shouldBecomeDeveloper(): Promise<boolean> {
    const devCount = await User.countDocuments({ role: "developer" });

    return devCount === 0;
}

/**
 * Copyright (c) 2026 Sobhan Rasoulzadeh Asl (Sobhan-SRZA / Mr. Sinre)
 *
 * Licensed under the BSD 3-Clause License.
 * See the LICENSE file in the project root for license information.
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */