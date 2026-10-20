import { z } from "zod";

const SLUG_RE = /^[a-z0-9-]{2,80}$/;
const OBJECT_ID_RE = /^[a-f\d]{24}$/i;

/* ---------------- Create ---------------- */
export const createProjectSchema = z.object({
    title: z.string().trim().min(2).max(120),
    slug: z.string().trim().toLowerCase().regex(SLUG_RE).optional(),

    githubUrl: z.string().trim().max(300).optional().nullable(),
    autoSync: z.boolean().optional(),

    shortDescription: z.string().trim().min(5).max(300),
    fullDescription: z.string().trim().min(20).max(20000),

    rating: z.number().min(0).max(5).optional(),
    satisfaction: z.number().min(0).max(100).optional(),
    downloads: z.number().int().min(0).optional(),

    tags: z
        .array(z.string().regex(OBJECT_ID_RE, "شناسه تگ نامعتبر است"))
        .max(20, "حداکثر ۲۰ تگ")
        .optional()
        .transform((arr) => (arr ? [...new Set(arr)] : undefined)),

    status: z.enum(["draft", "published", "archived"]).optional(),
    isPublic: z.boolean().optional(),
});

/* ---------------- Update ---------------- */
export const updateProjectSchema = createProjectSchema.partial();

/* ---------------- List query ---------------- */
export const projectListQuerySchema = z.object({
    search: z.string().trim().max(80).optional(),
    tag: z.string().regex(OBJECT_ID_RE).optional(),
    tagType: z.string().regex(OBJECT_ID_RE).optional(),
    status: z.enum(["draft", "published", "archived"]).optional(),
    mine: z.coerce.boolean().optional(),
    sort: z.enum(["recent", "rating", "downloads", "stars"]).optional().default("recent"),
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(50).optional().default(12),
});

export const exploreQuerySchema = z.object({
    sort: z.enum(["trending", "hot", "top", "new", "top-rated", "top-downloaded"])
        .optional()
        .default("trending"),
    window: z.enum(["24h", "7d", "30d", "all"]).optional(),
    tag: z.string().regex(OBJECT_ID_RE).optional(),
    tagType: z.string().regex(OBJECT_ID_RE).optional(),
    search: z.string().trim().max(80).optional(),
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(50).optional().default(20),
});

/**
 * Copyright (c) 2026 Sobhan Rasoulzadeh Asl (Sobhan-SRZA / Mr. Sinre)
 *
 * Licensed under the BSD 3-Clause License.
 * See the LICENSE file in the project root for license information.
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */