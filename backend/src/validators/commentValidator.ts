import { z } from "zod";

export const createCommentSchema = z.object({
    body: z.string().trim().min(1, "متن نظر الزامی است").max(2000),
    parent: z.string().regex(/^[a-f\d]{24}$/i).optional().nullable()
});

export const updateCommentSchema = z.object({
    body: z.string().trim().min(1).max(2000)
});

export const commentListQuerySchema = z.object({
    sort: z.enum(["recent", "oldest", "top"]).optional().default("recent"),
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(20),
    parentId: z.string().regex(/^[a-f\d]{24}$/i).optional()  // برای لیست پاسخ‌ها
});


/**
 * Copyright (c) 2026 Sobhan Rasoulzadeh Asl (Sobhan-SRZA / Mr. Sinre)
 *
 * Licensed under the BSD 3-Clause License.
 * See the LICENSE file in the project root for license information.
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */