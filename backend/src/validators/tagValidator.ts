import { z } from "zod";

const SLUG_RE = /^[a-z0-9-]{2,40}$/;
const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;
const OBJECT_ID_RE = /^[a-f\d]{24}$/i;

/* ==================================================================
   TagType
   ================================================================== */
export const createTagTypeSchema = z.object({
    name: z.string().trim().min(2, "نام باید حداقل ۲ کاراکتر باشد").max(50),
    slug: z.string().trim().toLowerCase().regex(SLUG_RE).optional(),
    description: z.string().trim().max(300).optional(),
    color: z.string().regex(HEX_COLOR_RE).optional(),
    icon: z.string().trim().max(8).optional(),
    order: z.number().int().min(0).max(9999).optional(),
    allowUserTags: z.boolean().optional()
});

export const updateTagTypeSchema = createTagTypeSchema.partial();

/* ==================================================================
   Tag
   ================================================================== */
export const createTagSchema = z.object({
    name: z.string().trim().min(1, 'نام تگ الزامی است').max(40),
    slug: z.string().trim().toLowerCase().regex(SLUG_RE).optional(),
    type: z
        .preprocess(
            (v) => (v === '' || v === null ? undefined : v),
            z.string().regex(OBJECT_ID_RE, 'شناسه کتگوری نامعتبر است').optional()
        ),
    color: z.string().regex(HEX_COLOR_RE).optional(),
    description: z.string().trim().max(200).optional()
});

export const updateTagSchema = createTagSchema
    .partial()
    .omit({ type: true });

/* ==================================================================
   find-or-create — picker
   ================================================================== */
export const findOrCreateTagSchema = z.object({
    name: z.string().trim().min(1, 'نام تگ الزامی است').max(40),
    type: z
        .preprocess(
            // "" یا null → undefined (یعنی «عمومی»)
            (v) => (v === '' || v === null ? undefined : v),
            z.string().regex(OBJECT_ID_RE, 'شناسه کتگوری نامعتبر است').optional()
        ),
});

/* ==================================================================
   suggest
   ================================================================== */
export const suggestTagsSchema = z.object({
    q: z.string().trim().max(40).optional().default(""),
    type: z.string().regex(OBJECT_ID_RE).optional(),
    limit: z.coerce.number().int().min(1).max(50).optional().default(20)
});

/* ==================================================================
   List query
   ================================================================== */
export const listQuerySchema = z.object({
    type: z.string().regex(OBJECT_ID_RE).optional(),
    search: z.string().trim().max(60).optional(),
    sort: z.enum(["name", "usage", "recent"]).optional().default("usage"),
    approved: z.coerce.boolean().optional().default(true),
    mine: z.coerce.boolean().optional().default(false),
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(50)
});

/* ==================================================================
   Request tag type (کاربر عادی — pending)
   ================================================================== */
export const requestTagTypeSchema = z.object({
    name: z.string().trim().min(2, "نام باید حداقل ۲ کاراکتر باشد").max(50),
    description: z.string().trim().max(300).optional(),
    color: z.string().regex(HEX_COLOR_RE).optional(),
    icon: z.string().trim().max(8).optional(),
    reason: z.string().trim().max(500).optional()
});

/**
 * Copyright (c) 2026 Sobhan Rasoulzadeh Asl (Sobhan-SRZA / Mr. Sinre)
 *
 * Licensed under the BSD 3-Clause License.
 * See the LICENSE file in the project root for license information.
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */