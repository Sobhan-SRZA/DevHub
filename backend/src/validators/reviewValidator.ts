import { z } from "zod";

export const createReviewSchema = z.object({
    rating: z
        .number({ error: "امتیاز الزامی است" })
        .min(0, "امتیاز باید بین 0 تا 5 باشد")
        .max(5, "امتیاز باید بین 0 تا 5 باشد"),
    satisfaction: z
        .number({ error: "میزان رضایت الزامی است" })
        .min(0)
        .max(100),
    title: z.string().trim().max(100).optional(),
    body: z.string().trim().max(3000).optional()
});

export const updateReviewSchema = createReviewSchema.partial();

export const reviewListQuerySchema = z.object({
    sort: z.enum(["recent", "oldest", "highest", "lowest", "helpful"]).optional().default("recent"),
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(50).optional().default(10)
});

/**
 * Copyright (c) 2026 Sobhan Rasoulzadeh Asl (Sobhan-SRZA / Mr. Sinre)
 *
 * Licensed under the BSD 3-Clause License.
 * See the LICENSE file in the project root for license information.
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */