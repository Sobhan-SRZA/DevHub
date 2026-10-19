import type {
    Request,
    Response,
    NextFunction,
    RequestHandler
} from "express";

/**
 * هر async controller رو wrap می‌کنه.
 * - خطاهای sync و async رو یکسان مدیریت می‌کنه
 * - اگه هدر پاسخ قبلاً ارسال شده باشه، next(err) رو صدا نمی‌زنه (جلوگیری از خطای دوگانه)
 */
export const asyncHandler =
    <T extends Request = Request>(
        fn: (req: T, res: Response, next: NextFunction) => Promise<unknown> | unknown
    ): RequestHandler =>
        (req, res, next) => {
            try {
                Promise.resolve(fn(req as T, res, next)).catch((err) => {
                    if (res.headersSent)
                        return; // خطا رو به Express واگذار نکن

                    next(err);
                });
            }

            catch (err) {
                if (!res.headersSent)
                    next(err);
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