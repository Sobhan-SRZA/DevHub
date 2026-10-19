import {
    hasRole,
    isAdmin as checkAdmin,
    isDeveloper as checkDev
} from "../services/roleService";
import type {
    Response,
    NextFunction
} from "express";
import { ErrorCodes } from "../utils/errorCodes";
import { AppError } from "../utils/AppError";

/* ==================================================================
   API Guards
   ================================================================== */
export function requireRole(minRole: "admin" | "developer") {
    return (req: any, _res: Response, next: NextFunction) => {
        if (!req.user) {
            return next(new AppError(401, ErrorCodes.UNAUTHENTICATED));
        }

        if (!hasRole(req.user, minRole)) {
            return next(
                new AppError(
                    403,
                    ErrorCodes.PROJECT_NOT_OWNED,
                    minRole === "developer"
                        ? "این بخش فقط برای developer است"
                        : "این بخش فقط برای ادمین است"
                )
            );
        }

        next();
    };
}

export const requireAdmin = requireRole("admin");
export const requireDeveloper = requireRole("developer");

/* ==================================================================
   Page Guards
   ================================================================== */
export function pageRoleGuard(minRole: "admin" | "developer") {
    return (req: any, res: Response, next: NextFunction) => {
        if (!hasRole(req.user, minRole)) {
            return res.redirect("/dashboard");
        }

        next();
    };
}

export const pageAdminGuard = pageRoleGuard("admin");
export const pageDeveloperGuard = pageRoleGuard("developer");

/* ==================================================================
   Helpers
   ================================================================== */
export const isAdmin = checkAdmin;
export const isDeveloper = checkDev;

/**
 * Copyright (c) 2026 Sobhan Rasoulzadeh Asl (Sobhan-SRZA / Mr. Sinre)
 *
 * Licensed under the BSD 3-Clause License.
 * See the LICENSE file in the project root for license information.
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */