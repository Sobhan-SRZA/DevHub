import { z } from "zod";

const SLUG_RE = /^[a-z0-9-]{2,40}$/;
const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

/* ---------------- TagType ---------------- */
export const createTagTypeSchema = z.object({
    name: z.string().trim().min(2).max(50),
    slug: z.string().trim().toLowerCase().regex(SLUG_RE),
    description: z.string().trim().max(300).optional(),
    color: z.string().regex(HEX_COLOR_RE).optional(),
    icon: z.string().trim().max(8).optional(),
    order: z.number().int().min(0).max(9999).optional(),
});

export const updateTagTypeSchema = createTagTypeSchema.partial();

/* ---------------- Tag ---------------- */
export const createTagSchema = z.object({
    name: z.string().trim().min(1).max(40),
    slug: z.string().trim().toLowerCase().regex(SLUG_RE).optional(), // اگه نده از name می‌سازیم
    type: z.string().regex(/^[a-f\d]{24}$/i, "شناسه نوع تگ نامعتبر است"),
    color: z.string().regex(HEX_COLOR_RE).optional(),
    description: z.string().trim().max(200).optional()
});

export const updateTagSchema = createTagSchema.partial().omit({ type: true });

/* ---------------- List query ---------------- */
export const listQuerySchema = z.object({
    type: z.string().regex(/^[a-f\d]{24}$/i).optional(),
    search: z.string().trim().max(60).optional(),
    sort: z.enum(["name", "usage", "recent"]).optional().default("usage"),
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(30)
});

/**
 * Copyright (c) 2026 Sobhan Rasoulzadeh Asl (Sobhan-SRZA / Mr. Sinre)
 *
 * Licensed under the BSD 3-Clause License.
 * See the LICENSE file in the project root for license information.
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */