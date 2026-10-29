/**
 * Server-side validation schemas for project reviews.
 *
 * Defines validation rules for creating and updating reviews, including
 * rating scores, satisfaction levels, optional review content, sorting,
 * and pagination parameters.
 *
 * Copyright (c) 2026 Sobhan Rasoulzadeh Asl (Sobhan-SRZA / Mr. Sinre)
 *
 * Licensed under the BSD 3-Clause License.
 * See the LICENSE file in the project root for license information.
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import { z } from "zod";

/* ========================================================================== */
/* Create Review                                                              */
/* ========================================================================== */

/**
 * Validates the payload required to create a project review.
 *
 * Requires a rating between 0 and 5 and a satisfaction score between 0 and
 * 100. The review title and body are optional and are trimmed before
 * validation.
 */
export const createReviewSchema = z.object({
    rating: z
        .number({ error: "Rating is required." })
        .min(0, "Rating must be between 0 and 5.")
        .max(5, "Rating must be between 0 and 5."),

    satisfaction: z
        .number({ error: "Satisfaction level is required." })
        .min(0, "Satisfaction must be between 0 and 100.")
        .max(100, "Satisfaction must be between 0 and 100."),

    title: z
        .string()
        .trim()
        .max(100, "Review title must not exceed 100 characters.")
        .optional(),

    body: z
        .string()
        .trim()
        .max(3000, "Review body must not exceed 3,000 characters.")
        .optional()
});

/* ========================================================================== */
/* Update Review                                                              */
/* ========================================================================== */

/**
 * Validates partial updates to an existing review.
 *
 * Reuses the review creation schema while making every field optional.
 */
export const updateReviewSchema = createReviewSchema.partial();

/* ========================================================================== */
/* Review List Query                                                          */
/* ========================================================================== */

/**
 * Validates and normalizes query parameters for retrieving project reviews.
 *
 * Supports sorting by recency, creation order, rating, or helpfulness,
 * along with pagination.
 */
export const reviewListQuerySchema = z.object({
    sort: z
        .enum(["recent", "oldest", "highest", "lowest", "helpful"])
        .optional()
        .default("recent"),

    page: z.coerce
        .number()
        .int()
        .min(1, "Page must be at least 1.")
        .optional()
        .default(1),

    limit: z.coerce
        .number()
        .int()
        .min(1, "Limit must be at least 1.")
        .max(50, "Limit must not exceed 50.")
        .optional()
        .default(10)
});

/**
 * Copyright (c) 2026 Sobhan Rasoulzadeh Asl (Sobhan-SRZA / Mr. Sinre)
 *
 * Licensed under the BSD 3-Clause License.
 * See the LICENSE file in the project root for license information.
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */