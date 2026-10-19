import { ErrorCodes, ErrorMessages, type ErrorCode } from './errorCodes';

/**
 * خطای عملیاتی که فرانت می‌تونه روش حساب کنه.
 *
 * details می‌تونه:
 *   - { field: "username" }                                  (برای مشخص کردن فیلد)
 *   - { field: "username", value: "ali" }
 *   - { [fieldName]: [messages] }                            (validation)
 */
export class AppError extends Error {
    public readonly statusCode: number;
    public readonly code: ErrorCode;
    public readonly field?: string;
    public readonly details?: Record<string, unknown>;

    constructor(
        statusCode: number,
        code: ErrorCode,
        message?: string,
        opts: { field?: string; details?: Record<string, unknown> } = {}
    ) {
        super(message || ErrorMessages[code] || 'خطای نامشخص');
        this.statusCode = statusCode;
        this.code = code;
        this.field = opts.field;
        this.details = opts.details;

        Object.setPrototypeOf(this, AppError.prototype);
        Error.captureStackTrace(this, this.constructor);
    }

    toJSON() {
        return {
            ok: false,
            code: this.code,
            message: this.message,
            ...(this.field ? { field: this.field } : {}),
            ...(this.details ? { details: this.details } : {})
        };
    }
}

/* ---------- Factory helpers (خوش‌دست‌تر برای کنترلر) ---------- */

export const BadRequest = (code: ErrorCode, message?: string, opts?: any) =>
    new AppError(400, code, message, opts);

export const Unauthorized = (code: ErrorCode, message?: string, opts?: any) =>
    new AppError(401, code, message, opts);

export const Forbidden = (code: ErrorCode, message?: string, opts?: any) =>
    new AppError(403, code, message, opts);

export const NotFound = (code: ErrorCode, message?: string, opts?: any) =>
    new AppError(404, code, message, opts);

export const Conflict = (code: ErrorCode, message?: string, opts?: any) =>
    new AppError(409, code, message, opts);

export const TooManyRequests = (code: ErrorCode, message?: string, opts?: any) =>
    new AppError(429, code, message, opts);

/**
 * Copyright (c) 2026 Sobhan Rasoulzadeh Asl (Sobhan-SRZA / Mr. Sinre)
 *
 * Licensed under the BSD 3-Clause License.
 * See the LICENSE file in the project root for license information.
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */