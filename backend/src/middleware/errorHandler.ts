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
 * خطاها رو به JSON تبدیل می‌کنه.
 * - اگه هدر پاسخ قبلاً ارسال شده باشه: فقط لاگ و delegate به Express
 * - در غیر این صورت: همیشه JSON برمی‌گردونه
 * - هیچوقت پروسه رو نمی‌کُشه
 */
export function errorHandler(
    err: unknown,
    req: Request,
    res: Response,
    next: NextFunction
) {
    /* ---------- اگه پاسخ قبلاً ارسال شده ---------- */
    if (res.headersSent) {
        // Express default handler رو صدا بزن (اتصال رو می‌بنده)
        return next(err);
    }

    /* ---------- AppError ---------- */
    if (err instanceof AppError) {
        return res.status(err.statusCode).json(err.toJSON());
    }

    /* ---------- ZodError ---------- */
    if (err instanceof ZodError) {
        return res.status(400).json({
            ok: false,
            code: ErrorCodes.VALIDATION_ERROR,
            message: ErrorMessages[ErrorCodes.VALIDATION_ERROR],
            details: err.flatten().fieldErrors,
        });
    }

    /* ---------- Mongoose duplicate key ---------- */
    if (isObject(err) && (err as any).code === 11000) {
        const pattern = (err as any).keyPattern || {};
        const dupField = Object.keys(pattern)[0] || "";

        if (dupField === "usernameLower" || dupField === "username") {
            return res.status(409).json({
                ok: false,
                code: ErrorCodes.USERNAME_TAKEN,
                message: ErrorMessages[ErrorCodes.USERNAME_TAKEN],
                field: "username",
            });
        }
        if (dupField === "email") {
            return res.status(409).json({
                ok: false,
                code: ErrorCodes.EMAIL_TAKEN,
                message: ErrorMessages[ErrorCodes.EMAIL_TAKEN],
                field: "email",
            });
        }
        return res.status(409).json({
            ok: false,
            code: ErrorCodes.VALIDATION_ERROR,
            message: "این مقدار تکراری است",
            field: dupField,
        });
    }

    /* ---------- Mongoose validation ---------- */
    if (isObject(err) && (err as any).name === "ValidationError") {
        const rawErrors = (err as any).errors as Record<string, any>;
        const details: Record<string, string[]> = {};
        for (const [key, val] of Object.entries(rawErrors)) {
            details[key] = [val.message];
        }
        return res.status(400).json({
            ok: false,
            code: ErrorCodes.VALIDATION_ERROR,
            message: ErrorMessages[ErrorCodes.VALIDATION_ERROR],
            details,
        });
    }

    /* ---------- Mongoose cast ---------- */
    if (isObject(err) && (err as any).name === "CastError") {
        return res.status(400).json({
            ok: false,
            code: ErrorCodes.VALIDATION_ERROR,
            message: "شناسه نامعتبر است",
            field: (err as any).path,
        });
    }

    /* ---------- JWT ---------- */
    if (isObject(err) && (err as any).name === "JsonWebTokenError") {
        return res.status(401).json({
            ok: false,
            code: ErrorCodes.INVALID_TOKEN,
            message: ErrorMessages[ErrorCodes.INVALID_TOKEN],
        });
    }
    if (isObject(err) && (err as any).name === "TokenExpiredError") {
        return res.status(401).json({
            ok: false,
            code: ErrorCodes.SESSION_EXPIRED,
            message: ErrorMessages[ErrorCodes.SESSION_EXPIRED],
        });
    }

    /* ---------- خطای شبکه (fetch داخل کنترلر) ---------- */
    if (isObject(err) && ((err as any).code === "ECONNREFUSED" || (err as any).code === "ETIMEDOUT")) {
        return res.status(503).json({
            ok: false,
            code: ErrorCodes.NETWORK_ERROR,
            message: "سرویس جانبی در دسترس نیست",
        });
    }

    /* ---------- ناشناخته ---------- */
    const isProd = process.env.NODE_ENV === "production";
    console.error("🔴 [UNHANDLED ERROR]", {
        method: req.method,
        url: req.originalUrl,
        name: (err as any)?.name,
        message: (err as any)?.message,
        stack: isProd ? undefined : (err as any)?.stack,
    });

    return res.status(500).json({
        ok: false,
        code: ErrorCodes.INTERNAL_ERROR,
        message: isProd
            ? ErrorMessages[ErrorCodes.INTERNAL_ERROR]
            : (err as Error)?.message || "Internal Server Error",
    });
}

function isObject(v: unknown): v is Record<string, unknown> {
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