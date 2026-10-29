
import {
    User,
    type UserRole,
} from "../models/User";
import { ErrorCodes } from "../utils/errorCodes";
import { AppError } from "../utils/AppError";
import { Types } from "mongoose";

/* ==================================================================
   Role Hierarchy
   ================================================================== */

/**
 * Defines the privilege level associated with each user role.
 * Higher values represent greater privileges.
 */
const ROLE_RANK: Record<UserRole, number> = {
    user: 1,
    admin: 2,
    developer: 3,
};

/**
 * Determines whether a user has at least the specified role level.
 */
export function hasRole(user: any, minRole: UserRole): boolean {
    if (!user?.role) {
        return false;
    }

    return (
        (ROLE_RANK[user.role as UserRole] || 0) >=
        (ROLE_RANK[minRole] || 0)
    );
}

/**
 * Checks whether a user has administrator-level privileges or higher.
 */
export function isAdmin(user: any): boolean {
    return hasRole(user, "admin");
}

/**
 * Checks whether a user has the developer role.
 */
export function isDeveloper(user: any): boolean {
    return user?.role === "developer";
}

/* ==================================================================
   Role Management
   ================================================================== */

export interface ChangeRoleOptions {
    targetUserId: Types.ObjectId | string;
    newRole: UserRole;
    changedBy: Types.ObjectId | string;
    reason?: string;
}

/**
 * Changes a user's role after validating the requesting user's permissions.
 *
 * Authorization rules:
 * - Users cannot change their own roles.
 * - Only developers can assign the developer role.
 * - Administrators cannot modify developer accounts or assign developer roles.
 *
 * The change is persisted with audit metadata, including the previous role,
 * the requesting user, the timestamp, and the optional reason.
 */
export async function changeUserRole(opts: ChangeRoleOptions) {
    const { targetUserId, newRole, changedBy, reason } = opts;

    // Retrieve the target user.
    const target = await User.findById(targetUserId);

    if (!target) {
        throw new AppError(
            404,
            ErrorCodes.UNAUTHENTICATED,
            "User not found."
        );
    }

    if (target.role === newRole) {
        throw new AppError(
            400,
            ErrorCodes.VALIDATION_ERROR,
            "The user already has this role."
        );
    }

    // Retrieve the user requesting the role change.
    const actor = await User.findById(changedBy);

    if (!actor) {
        throw new AppError(
            401,
            ErrorCodes.UNAUTHENTICATED
        );
    }

    // Prevent self-promotion and self-demotion.
    if (String(actor._id) === String(target._id)) {
        throw new AppError(
            403,
            ErrorCodes.PROJECT_NOT_OWNED,
            "You cannot change your own role."
        );
    }

    // Only developers may assign the developer role.
    if (newRole === "developer" && actor.role !== "developer") {
        throw new AppError(
            403,
            ErrorCodes.PROJECT_NOT_OWNED,
            "Only developers can assign the developer role."
        );
    }

    // Administrators may manage users and other administrators,
    // but cannot modify developer accounts or assign developer roles.
    if (actor.role === "admin") {
        if (target.role === "developer" || newRole === "developer") {
            throw new AppError(
                403,
                ErrorCodes.PROJECT_NOT_OWNED,
                "Administrators cannot modify developer-level roles."
            );
        }
    }

    // Record the previous role before applying the change.
    const previousRole = target.role;

    target.role = newRole;
    target.roleChangedBy = actor._id as any;
    target.roleChangedAt = new Date();
    target.roleChangeReason = reason || null;

    await target.save();

    // Record the role change for operational auditing.
    console.log(
        `[ROLE CHANGE] ${previousRole} -> ${newRole}` +
        ` | target=${target._id} | changedBy=${actor._id}` +
        (reason ? ` | reason=${reason}` : "")
    );

    return {
        userId: target._id,
        previousRole,
        newRole,
    };
}

/* ==================================================================
   Developer Account Bootstrap
   ================================================================== */

/**
 * Ensures that at least one developer account exists.
 *
 * Initialization order:
 * 1. Preserve existing developer accounts.
 * 2. Promote the account specified by DEVELOPER_EMAIL, if available.
 * 3. Otherwise, promote the earliest registered user.
 *
 * If no users exist, the first registered user can be assigned the
 * developer role through the registration workflow.
 */
export async function ensureDeveloperExists(): Promise<void> {
    const developerCount = await User.countDocuments({
        role: "developer",
    });

    if (developerCount > 0) {
        return;
    }

    // Prefer the developer account configured through the environment.
    const envEmail = process.env.DEVELOPER_EMAIL
        ?.toLowerCase()
        .trim();

    if (envEmail) {
        const user = await User.findOne({
            email: envEmail,
        });

        if (user) {
            user.role = "developer";
            user.roleChangedAt = new Date();
            user.roleChangeReason =
                "Bootstrap from DEVELOPER_EMAIL environment variable";

            await user.save();

            console.log(
                `Promoted ${envEmail} to developer using environment configuration.`
            );

            return;
        }

        console.warn(
            `DEVELOPER_EMAIL is configured as "${envEmail}", but no matching user was found.`
        );
    }

    // Fall back to the earliest registered account.
    const firstUser = await User.findOne({}).sort({
        createdAt: 1,
    });

    if (firstUser) {
        firstUser.role = "developer";
        firstUser.roleChangedAt = new Date();
        firstUser.roleChangeReason =
            "Bootstrap: earliest registered user";

        await firstUser.save();

        console.log(
            `Promoted the earliest registered user (${firstUser.email}) to developer.`
        );
    } else {
        console.warn(
            "No registered users exist. The first registered user will be eligible for developer assignment."
        );
    }
}

/* ==================================================================
   First User Role Assignment
   ================================================================== */

/**
 * Determines whether a newly registered user should receive the developer
 * role because no developer account currently exists.
 */
export async function shouldBecomeDeveloper(): Promise<boolean> {
    const developerCount = await User.countDocuments({
        role: "developer",
    });

    return developerCount === 0;
}

/**
 * Copyright (c) 2026 Sobhan Rasoulzadeh Asl (Sobhan-SRZA / Mr. Sinre)
 *
 * Licensed under the BSD 3-Clause License.
 * See the LICENSE file in the project root for license information.
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */