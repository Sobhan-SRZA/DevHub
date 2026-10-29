/**
 * Copyright (c) 2026 Sobhan Rasoulzadeh Asl (Sobhan-SRZA / Mr. Sinre)
 *
 * Licensed under the BSD 3-Clause License.
 * See the LICENSE file in the project root for license information.
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import { ErrorCodes } from "./errorCodes";
import { ZodType } from "zod";
import { AppError } from "./AppError";

/**
 * Validates input data against a Zod schema.
 *
 * If validation fails, the function collects field-level and form-level
 * validation errors and throws an `AppError` with an HTTP 400 status code.
 * In non-production environments, validation failures are also logged
 * to the console for debugging purposes.
 *
 * @template T - The expected type of the validated data.
 * @param schema - The Zod schema used to validate the input.
 * @param data - The input data to validate.
 * @returns The validated and type-safe data.
 * @throws {AppError} If the input fails schema validation.
 */
export function validate<T>(schema: ZodType<T>, data: unknown): T {
    const result = schema.safeParse(data);

    if (!result.success) {
        const flat = result.error.flatten();

        const details: Record<string, string[]> = {};

        // Explicit type assertion for compatibility with Zod v3 and v4,
        // where field errors may contain undefined values.
        const fieldErrors = flat.fieldErrors as Record<
            string,
            string[] | undefined
        >;

        for (const [key, messages] of Object.entries(fieldErrors)) {
            if (Array.isArray(messages) && messages.length > 0) {
                details[key] = messages;
            }
        }

        const formErrors = (flat.formErrors ?? []) as string[];

        if (formErrors.length > 0) {
            details._form = formErrors;
        }

        // Log validation details only outside production environments.
        if (process.env.NODE_ENV !== "production") {
            console.warn("[VALIDATION FAILED]", data, details);
        }

        throw new AppError(
            400,
            ErrorCodes.VALIDATION_ERROR,
            "The provided input data is invalid.",
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