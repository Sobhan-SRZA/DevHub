
import type {
    Request,
    Response,
    NextFunction,
    RequestHandler
} from "express";

/**
 * Wraps an asynchronous or synchronous Express controller with centralized
 * error handling.
 *
 * Features:
 * - Handles synchronous exceptions and asynchronous promise rejections.
 * - Forwards errors to Express error-handling middleware when possible.
 * - Avoids forwarding errors after response headers have been sent, preventing
 *   duplicate error handling and potential response-related exceptions.
 *
 * @typeParam T - The Express request type expected by the controller.
 * @param fn - The controller function to execute.
 * @returns An Express-compatible request handler.
 */
export const asyncHandler =
    <T extends Request = Request>(
        fn: (
            req: T,
            res: Response,
            next: NextFunction
        ) => Promise<unknown> | unknown
    ): RequestHandler =>
        (req, res, next) => {
            try {
                Promise.resolve(fn(req as T, res, next)).catch((err: unknown) => {
                    if (res.headersSent) {
                        // The response has already started; avoid forwarding
                        // the error through the normal Express error pipeline.
                        return;
                    }

                    next(err);
                });
            } catch (err: unknown) {
                // Handle exceptions thrown before the controller returns.
                if (!res.headersSent) {
                    next(err);
                }
            }
        };

/**
 * Copyright (c) 2026 Sobhan Rasoulzadeh Asl (Sobhan-SRZA / Mr. Sinre)
 *
 * Licensed under the BSD 3-Clause License.
 * See the LICENSE file in the project root for license information.
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */