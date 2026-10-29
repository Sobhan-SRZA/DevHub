import type {
    Request,
    Response,
    NextFunction
} from "express";
import {
    ErrorCodes,
    ErrorMessages
} from "../utils/errorCodes";
import { AppError } from "../utils/AppError";
import { ZodError } from "zod";

/**
 * Converts application and runtime errors into standardized JSON responses.
 *
 * - Delegates to Express's default error handler if response headers have already been sent.
 * - Returns JSON responses for all errors that can be handled by this middleware.
 * - Prevents unhandled errors from terminating the process.
 */
export function errorHandler(
    err: unknown,
    req: Request,
    res: Response,
    next: NextFunction
) {
    /* ---------- Response headers already sent ---------- */

    if (res.headersSent) {
        // Delegate to Express's default error handler to terminate the response.
        return next(err);
    }

    /* ---------- Application errors ---------- */

    if (err instanceof AppError) {
        return res.status(err.statusCode).json(err.toJSON());
    }

    /* ---------- Zod validation errors ---------- */

    if (err instanceof ZodError) {
        return res.status(400).json({
            ok: false,
            code: ErrorCodes.VALIDATION_ERROR,
            message: ErrorMessages[ErrorCodes.VALIDATION_ERROR],
            details: err.flatten().fieldErrors
        });
    }

    /* ---------- Mongoose duplicate key errors ---------- */

    if (isObject(err) && err.code === 11000) {
        const pattern = (err as any).keyPattern || {};
        const dupField = Object.keys(pattern)[0] || "";

        if (dupField === "usernameLower" || dupField === "username") {
            return res.status(409).json({
                ok: false,
                code: ErrorCodes.USERNAME_TAKEN,
                message: ErrorMessages[ErrorCodes.USERNAME_TAKEN],
                field: "username"
            });
        }

        if (dupField === "email") {
            return res.status(409).json({
                ok: false,
                code: ErrorCodes.EMAIL_TAKEN,
                message: ErrorMessages[ErrorCodes.EMAIL_TAKEN],
                field: "email"
            });
        }

        return res.status(409).json({
            ok: false,
            code: ErrorCodes.VALIDATION_ERROR,
            message: "This value already exists",
            field: dupField
        });
    }

    /* ---------- Mongoose validation errors ---------- */

    if (isObject(err) && err.name === "ValidationError") {
        const rawErrors = (err as any).errors as Record<string, any>;
        const details: Record<string, string[]> = {};

        for (const [key, val] of Object.entries(rawErrors)) {
            details[key] = [val.message];
        }

        return res.status(400).json({
            ok: false,
            code: ErrorCodes.VALIDATION_ERROR,
            message: ErrorMessages[ErrorCodes.VALIDATION_ERROR],
            details
        });
    }

    /* ---------- Mongoose cast errors ---------- */

    if (isObject(err) && err.name === "CastError") {
        return res.status(400).json({
            ok: false,
            code: ErrorCodes.VALIDATION_ERROR,
            message: "Invalid identifier",
            field: (err as any).path
        });
    }

    /* ---------- JSON Web Token errors ---------- */

    if (isObject(err) && err.name === "JsonWebTokenError") {
        return res.status(401).json({
            ok: false,
            code: ErrorCodes.INVALID_TOKEN,
            message: ErrorMessages[ErrorCodes.INVALID_TOKEN]
        });
    }

    if (isObject(err) && err.name === "TokenExpiredError") {
        return res.status(401).json({
            ok: false,
            code: ErrorCodes.SESSION_EXPIRED,
            message: ErrorMessages[ErrorCodes.SESSION_EXPIRED]
        });
    }

    /* ---------- Network errors from external requests ---------- */

    if (
        isObject(err) &&
        (err.code === "ECONNREFUSED" || err.code === "ETIMEDOUT")
    ) {
        return res.status(503).json({
            ok: false,
            code: ErrorCodes.NETWORK_ERROR,
            message: "An external service is currently unavailable"
        });
    }

    /* ---------- Unhandled errors ---------- */

    const isProd = process.env.NODE_ENV === "production";

    console.error("[UNHANDLED ERROR]", {
        method: req.method,
        url: req.originalUrl,
        name: (err as any)?.name,
        message: (err as any)?.message,
        stack: isProd ? undefined : (err as any)?.stack
    });

    return res.status(500).json({
        ok: false,
        code: ErrorCodes.INTERNAL_ERROR,
        message: isProd
            ? ErrorMessages[ErrorCodes.INTERNAL_ERROR]
            : (err as Error)?.message || "Internal Server Error"
    });
}

function isObject(v: unknown): v is Record<string, any> {
    return typeof v === "object" && v !== null;
}

/**
 * Copyright (c) 2026 Sobhan Rasoulzadeh Asl (Sobhan-SRZA / Mr. Sinre)
 *
 * Licensed under the BSD 3-Clause License.
 * See the LICENSE file in the project root for license information.
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */