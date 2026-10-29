
import {
    ErrorCodes,
    ErrorMessages,
    type ErrorCode
} from "./errorCodes";

/**
 * Represents an operational application error with a predictable structure
 * that can be safely handled by the frontend.
 *
 * The optional `details` property supports additional error context, including:
 * - `{ field: "username" }` — identifies the field associated with the error.
 * - `{ field: "username", value: "ali" }` — includes the relevant field value.
 * - `{ username: ["Username is required"] }` — provides field-specific validation messages.
 *
 * The serialized response includes the error code, message, and any available
 * field-level metadata, allowing clients to handle errors consistently.
 */
export class AppError extends Error {
    public readonly statusCode: number;
    public readonly code: ErrorCode;
    public readonly field?: string;
    public readonly details?: Record<string, unknown>;

    /**
     * Creates a structured application error.
     *
     * @param statusCode - HTTP status code associated with the error.
     * @param code - Application-specific error code.
     * @param message - Optional custom error message. Falls back to the
     * configured message for the specified error code.
     * @param opts - Optional field identifier and additional error details.
     */
    constructor(
        statusCode: number,
        code: ErrorCode,
        message?: string,
        opts: {
            field?: string;
            details?: Record<string, unknown>;
        } = {}
    ) {
        super(
            message ||
            ErrorMessages[code] ||
            "An unexpected error occurred."
        );

        this.name = "AppError";
        this.statusCode = statusCode;
        this.code = code;
        this.field = opts.field;
        this.details = opts.details;

        // Preserve the correct prototype chain when extending the built-in Error class.
        Object.setPrototypeOf(this, new.target.prototype);

        // Capture a clean stack trace when the runtime supports this API.
        Error.captureStackTrace?.(this, this.constructor);
    }

    /**
     * Serializes the error into a frontend-friendly response object.
     *
     * Internal properties such as the stack trace and HTTP status code
     * are intentionally excluded from the serialized payload.
     *
     * @returns A normalized error response.
     */
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

/* ==================================================================
   HTTP Error Factory Helpers
   ================================================================== */

/**
 * Creates an HTTP 400 Bad Request error.
 *
 * @param code - Application-specific error code.
 * @param message - Optional custom error message.
 * @param opts - Optional field metadata and additional error details.
 */
export const BadRequest = (
    code: ErrorCode,
    message?: string,
    opts?: ConstructorParameters<typeof AppError>[3]
) => new AppError(400, code, message, opts);

/**
 * Creates an HTTP 401 Unauthorized error.
 *
 * @param code - Application-specific error code.
 * @param message - Optional custom error message.
 * @param opts - Optional field metadata and additional error details.
 */
export const Unauthorized = (
    code: ErrorCode,
    message?: string,
    opts?: ConstructorParameters<typeof AppError>[3]
) => new AppError(401, code, message, opts);

/**
 * Creates an HTTP 403 Forbidden error.
 *
 * @param code - Application-specific error code.
 * @param message - Optional custom error message.
 * @param opts - Optional field metadata and additional error details.
 */
export const Forbidden = (
    code: ErrorCode,
    message?: string,
    opts?: ConstructorParameters<typeof AppError>[3]
) => new AppError(403, code, message, opts);

/**
 * Creates an HTTP 404 Not Found error.
 *
 * @param code - Application-specific error code.
 * @param message - Optional custom error message.
 * @param opts - Optional field metadata and additional error details.
 */
export const NotFound = (
    code: ErrorCode,
    message?: string,
    opts?: ConstructorParameters<typeof AppError>[3]
) => new AppError(404, code, message, opts);

/**
 * Creates an HTTP 409 Conflict error.
 *
 * @param code - Application-specific error code.
 * @param message - Optional custom error message.
 * @param opts - Optional field metadata and additional error details.
 */
export const Conflict = (
    code: ErrorCode,
    message?: string,
    opts?: ConstructorParameters<typeof AppError>[3]
) => new AppError(409, code, message, opts);

/**
 * Creates an HTTP 429 Too Many Requests error.
 *
 * @param code - Application-specific error code.
 * @param message - Optional custom error message.
 * @param opts - Optional field metadata and additional error details.
 */
export const TooManyRequests = (
    code: ErrorCode,
    message?: string,
    opts?: ConstructorParameters<typeof AppError>[3]
) => new AppError(429, code, message, opts);

/**
 * Copyright (c) 2026 Sobhan Rasoulzadeh Asl (Sobhan-SRZA / Mr. Sinre)
 *
 * Licensed under the BSD 3-Clause License.
 * See the LICENSE file in the project root for license information.
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */