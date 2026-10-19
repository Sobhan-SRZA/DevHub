import { ErrorCodes } from './errorCodes';
import { ZodSchema } from 'zod';
import { AppError } from './AppError';

export function validate<T>(schema: ZodSchema<T>, data: unknown): T {
    const result = schema.safeParse(data);

    if (!result.success) {
        const flat = result.error.flatten();

        // ساخت map: { fieldName: [messages] }
        const details: Record<string, string[]> = {};

        for (const [key, messages] of Object.entries(flat.fieldErrors)) {
            if (messages && (messages as string[]).length)
                details[key] = (messages as string[]);
        }

        // خطاهای سطح فرم (مثل refine روی confirmPassword)
        if (flat.formErrors.length) {
            details._form = flat.formErrors;
        }

        if (process.env.NODE_ENV !== 'production') {
            console.warn('❌ [VALIDATION FAILED]', data, details);
        }

        throw new AppError(
            400,
            ErrorCodes.VALIDATION_ERROR,
            'داده‌های ورودی نامعتبر است',
            { details }
        );
    }

    return result.data;
}

/**
 * Copyright (c) 2026 Sobhan Rasoulzadeh Asl (Sobhan-SRZA / Mr. Sinre)
 *
 * Licensed under the BSD 3-Clause License.
 * See the LICENSE file in the project root for license information.
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */