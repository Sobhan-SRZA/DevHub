import type {
    Response,
    NextFunction
} from "express";
import { ErrorCodes } from "../utils/errorCodes";
import { AppError } from "../utils/AppError";

/**
 * چک می‌کنه کاربر فعلی ادمین یا دولوپر باشه.
 * برای API routes.
 */
export function requireAdmin(req: any, _res: Response, next: NextFunction) {
    const role = req.user?.role;
    if (role !== "admin" && role !== "developer") {
        return next(
            new AppError(
                403,
                ErrorCodes.PROJECT_NOT_OWNED,
                "این بخش فقط برای ادمین است"
            )
        );
    }

    next();
}

/**
 * برای صفحه‌های HTML — اگه کاربر ادمین نبود، ریدایرکت.
 */
export function pageAdminGuard(req: any, res: Response, next: NextFunction) {
    const role = req.user?.role;
    if (role !== "admin" && role !== "developer") {
        return res.redirect("/dashboard");
    }

    next();
}

/** helper */
export function isAdmin(user: any): boolean {
    return user?.role === "admin" || user?.role === "developer";
}

/**
 * Copyright (c) 2026 Sobhan Rasoulzadeh Asl (Sobhan-SRZA / Mr. Sinre)
 *
 * Licensed under the BSD 3-Clause License.
 * See the LICENSE file in the project root for license information.
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */