/**
 * Server-side validation schemas for comment operations.
 *
 * Defines input validation rules for creating comments, updating existing
 * comments, and querying paginated comment lists.
 *
 * Copyright (c) 2026 Sobhan Rasoulzadeh Asl (Sobhan-SRZA / Mr. Sinre)
 *
 * Licensed under the BSD 3-Clause License.
 * See the LICENSE file in the project root for license information.
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import { z } from "zod";

/* -------------------------------------------------------------------------- */
/* Create Comment                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Validates the payload required to create a comment.
 *
 * The comment body must contain between 1 and 2,000 characters after trimming.
 * An optional parent comment ID can be provided to create a reply.
 */
export const createCommentSchema = z.object({
    body: z
        .string()
        .trim()
        .min(1, "Comment text is required.")
        .max(2000, "Comment text must not exceed 2,000 characters."),

    parent: z
        .string()
        .regex(/^[a-f\d]{24}$/i, "Parent comment ID must be a valid ObjectId.")
        .optional()
        .nullable()
});

/* -------------------------------------------------------------------------- */
/* Update Comment                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Validates the payload required to update an existing comment.
 */
export const updateCommentSchema = z.object({
    body: z
        .string()
        .trim()
        .min(1, "Comment text is required.")
        .max(2000, "Comment text must not exceed 2,000 characters.")
});

/* -------------------------------------------------------------------------- */
/* Comment List Query                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Validates and normalizes query parameters for retrieving comments.
 *
 * Supports sorting, pagination, and filtering replies by their parent comment.
 * Numeric query parameters are coerced into numbers before validation.
 */
export const commentListQuerySchema = z.object({
    sort: z
        .enum(["recent", "oldest", "top"])
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
        .max(100, "Limit must not exceed 100.")
        .optional()
        .default(20),

    // Filters the results to replies associated with the specified parent comment.
    parentId: z
        .string()
        .regex(/^[a-f\d]{24}$/i, "Parent comment ID must be a valid ObjectId.")
        .optional()
});

/**
 * Copyright (c) 2026 Sobhan Rasoulzadeh Asl (Sobhan-SRZA / Mr. Sinre)
 *
 * Licensed under the BSD 3-Clause License.
 * See the LICENSE file in the project root for license information.
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */