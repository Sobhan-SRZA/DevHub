import { changeUserRole } from "../services/roleService";
import type { Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { ErrorCodes } from "../utils/errorCodes";
import { AppError } from "../utils/AppError";
import { validate } from "../utils/validate";
import { User } from "../models/User";
import { z } from "zod";

/* ==================================================================
   Schema
   ================================================================== */
const changeRoleSchema = z.object({
    role: z.enum(["user", "admin", "developer"]),
    reason: z.string().trim().max(300).optional()
});

/* ==================================================================
   LIST USERS — ادمین
   ================================================================== */
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
    if (role && ["user", "admin", "developer"].includes(role)) {
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

/* ==================================================================
   CHANGE ROLE — ادمین/دولوپر
   ================================================================== */
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
        message: `نقش کاربر به ${data.role} تغییر کرد`,
        ...result
    });
});

/* ==================================================================
   BAN / UNBAN — ادمین
   ================================================================== */
export const toggleBan = asyncHandler(async (req: any, res: Response) => {
    const user = await User.findById(req.params.id);
    if (!user) throw new AppError(404, ErrorCodes.UNAUTHENTICATED);

    // نمی‌تونی خودت رو بن کنی
    if (String(user._id) === String(req.user._id)) {
        throw new AppError(403, ErrorCodes.PROJECT_NOT_OWNED, "نمی‌توانید خودتان را بن کنید");
    }

    // ادمین نمی‌تونه دولوپر رو بن کنه
    if (user.role === "developer" && req.user.role !== "developer") {
        throw new AppError(403, ErrorCodes.PROJECT_NOT_OWNED, "فقط developer می‌تواند developer را بن کند");
    }

    user.isBanned = !user.isBanned;
    await user.save();

    res.json({
        ok: true,
        isBanned: user.isBanned,
        message: user.isBanned ? "کاربر بن شد" : "کاربر آنبن شد"
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