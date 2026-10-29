
import type { Response } from "express";
import { z } from "zod";

import { User } from "../models/User";
import { changeUserRole } from "../services/roleService";
import { AppError } from "../utils/AppError";
import { asyncHandler } from "../utils/asyncHandler";
import { ErrorCodes } from "../utils/errorCodes";
import { validate } from "../utils/validate";

/* ========================================================================== */
/* Validation Schemas                                                         */
/* ========================================================================== */

/**
 * Validates user role update requests.
 *
 * The optional reason field is trimmed and limited to 300 characters.
 */
const changeRoleSchema = z.object({
    role: z.enum(["user", "admin", "developer"]),
    reason: z.string().trim().max(300).optional()
});

/* ========================================================================== */
/* User Management — List Users                                               */
/* ========================================================================== */

/**
 * Retrieves a paginated list of users with optional search and role filters.
 *
 * Supports searching by name, username, or email address.
 * Results are sorted by creation date in descending order.
 *
 * @route GET /users
 * @access Admin
 */
export const listUsers = asyncHandler(async (req: any, res: Response) => {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Number(req.query.limit) || 20);
    const search = String(req.query.search || "").trim();
    const role = String(req.query.role || "").trim();

    const filter: Record<string, any> = {};

    if (search) {
        filter.$or = [
            { name: { $regex: search, $options: "i" } },
            { username: { $regex: search, $options: "i" } },
            { email: { $regex: search, $options: "i" } }
        ];
    }

    if (["user", "admin", "developer"].includes(role)) {
        filter.role = role;
    }

    const [users, total] = await Promise.all([
        User.find(filter)
            .select("name username email role avatar createdAt isBanned")
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .lean(),

        User.countDocuments(filter)
    ]);

    res.json({
        ok: true,
        users,
        pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit)
        }
    });
});

/* ========================================================================== */
/* User Management — Change Role                                             */
/* ========================================================================== */

/**
 * Updates a user's role through the centralized role management service.
 *
 * The service is responsible for applying role-change rules and any
 * associated business logic.
 *
 * @route PATCH /users/:id/role
 * @access Admin, Developer
 */
export const changeRole = asyncHandler(async (req: any, res: Response) => {
    const data = validate(changeRoleSchema, req.body);

    const result = await changeUserRole({
        targetUserId: req.params.id,
        newRole: data.role,
        changedBy: req.user._id,
        reason: data.reason
    });

    res.json({
        ok: true,
        message: `User role successfully changed to "${data.role}".`,
        ...result
    });
});

/* ========================================================================== */
/* User Management — Ban / Unban                                              */
/* ========================================================================== */

/**
 * Toggles a user's ban status.
 *
 * Users cannot ban themselves. Only developers are permitted to ban
 * accounts that have the developer role.
 *
 * @route PATCH /users/:id/ban
 * @access Admin, Developer
 */
export const toggleBan = asyncHandler(async (req: any, res: Response) => {
    const user = await User.findById(req.params.id);

    if (!user) {
        throw new AppError(404, ErrorCodes.UNAUTHENTICATED);
    }

    // Prevent users from banning their own accounts.
    if (String(user._id) === String(req.user._id)) {
        throw new AppError(
            403,
            ErrorCodes.PROJECT_NOT_OWNED,
            "You cannot ban your own account."
        );
    }

    // Only developers can ban accounts with the developer role.
    if (user.role === "developer" && req.user.role !== "developer") {
        throw new AppError(
            403,
            ErrorCodes.PROJECT_NOT_OWNED,
            "Only developers can ban accounts with the developer role."
        );
    }

    user.isBanned = !user.isBanned;
    await user.save();

    res.json({
        ok: true,
        isBanned: user.isBanned,
        message: user.isBanned
            ? "User has been banned successfully."
            : "User has been unbanned successfully."
    });
});

/**
 * Copyright (c) 2026 Sobhan Rasoulzadeh Asl (Sobhan-SRZA / Mr. Sinre)
 *
 * Licensed under the BSD 3-Clause License.
 * See the LICENSE file in the project root for license information.
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */