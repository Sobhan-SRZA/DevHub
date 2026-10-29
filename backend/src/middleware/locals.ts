import type {
    Response,
    NextFunction
} from "express";
import { User } from "../models/User";

/**
 * Retrieves the authenticated user's complete profile from the database
 * and attaches it to res.locals for use in server-rendered templates.
 *
 * EJS templates access the user profile through locals.currentUser.
 * This middleware runs on all HTML routes.
 */
export async function attachUserLocals(req: any, res: Response, next: NextFunction) {
    try {
        // Reuse the user ID already available from requireAuth or optionalAuth.
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
        console.warn("[attachUserLocals] Failed to attach user locals:", (err as Error).message);
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