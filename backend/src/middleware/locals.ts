import type {
    Response,
    NextFunction
} from "express";
import { User } from "../models/User";

/**
 * کاربر رو با فیلدهای کامل از DB می‌خونه و تو res.locals می‌ذاره.
 * EJS از locals.currentUser استفاده می‌کنه.
 *
 * روی همه‌ی روت‌های HTML اجرا می‌شه.
 */
export async function attachUserLocals(req: any, res: Response, next: NextFunction) {
    try {
        // اگه req.user از قبل هست (توسط requireAuth/optionalAuth)، از همون id استفاده کن
        const userId = req.user?._id || req.user?.id;

        if (userId) {
            const user = await User.findById(userId)
                .select("name username email emailVerified emailVerifiedAt avatar bio role createdAt pendingEmail")
                .lean();

            if (user) {
                res.locals.currentUser = user;
                res.locals.userRole = user.role || "user";
                res.locals.isAdmin = ["admin", "developer"].includes(user.role);
                res.locals.isDeveloper = user.role === "developer";
            }
        }
    } catch (err) {
        console.warn("[attachUserLocals]", (err as Error).message);
    }
    next();
}

/**
 * Copyright (c) 2026 Sobhan Rasoulzadeh Asl (Sobhan-SRZA / Mr. Sinre)
 *
 * Licensed under the BSD 3-Clause License.
 * See the LICENSE file in the project root for license information.
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */