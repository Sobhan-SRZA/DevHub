/**
 * Server-side validation schemas for project management and discovery.
 *
 * Defines validation rules for creating and updating projects, querying
 * project listings, and retrieving projects through the exploration interface.
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
/* Shared Validation Rules                                                    */
/* -------------------------------------------------------------------------- */

// Project slugs must contain 2–80 lowercase letters, digits, or hyphens.
const SLUG_RE = /^[a-z0-9-]{2,80}$/;

// Validates 24-character hexadecimal MongoDB ObjectIds.
const OBJECT_ID_RE = /^[a-f\d]{24}$/i;

/* ========================================================================== */
/* Create Project                                                             */
/* ========================================================================== */

/**
 * Validates the payload required to create a project.
 *
 * Normalizes the project title, slug, descriptions, and GitHub URL.
 * Validates optional metadata, project visibility, publication status,
 * and associated tags. Duplicate tag IDs are removed automatically.
 */
export const createProjectSchema = z.object({
    title: z
        .string()
        .trim()
        .min(2, "Project title must be at least 2 characters long.")
        .max(120, "Project title must not exceed 120 characters."),

    slug: z
        .string()
        .trim()
        .toLowerCase()
        .regex(SLUG_RE, "Slug must contain 2–80 lowercase letters, digits, or hyphens.")
        .optional(),

    githubUrl: z
        .string()
        .trim()
        .max(300, "GitHub URL must not exceed 300 characters.")
        .optional()
        .nullable(),

    autoSync: z.boolean().optional(),

    shortDescription: z
        .string()
        .trim()
        .min(5, "Short description must be at least 5 characters long.")
        .max(500, "Short description must not exceed 500 characters."),

    fullDescription: z
        .string()
        .trim()
        .min(20, "Full description must be at least 20 characters long."),

    rating: z
        .number()
        .min(0, "Rating cannot be less than 0.")
        .max(5, "Rating cannot exceed 5.")
        .optional(),

    satisfaction: z
        .number()
        .min(0, "Satisfaction cannot be less than 0.")
        .max(100, "Satisfaction cannot exceed 100.")
        .optional(),

    downloads: z
        .number()
        .int("Download count must be an integer.")
        .min(0, "Download count cannot be negative.")
        .optional(),

    tags: z
        .array(
            z.string().regex(OBJECT_ID_RE, "Invalid tag ID.")
        )
        .max(20, "A maximum of 20 tags is allowed.")
        .optional()
        .transform((tags) => (tags ? [...new Set(tags)] : undefined)),

    status: z.enum(["draft", "published", "archived"]).optional(),

    isPublic: z.boolean().optional()
});

/* ========================================================================== */
/* Update Project                                                             */
/* ========================================================================== */

/**
 * Validates partial project updates.
 *
 * Reuses the project creation schema while making every field optional.
 */
export const updateProjectSchema = createProjectSchema.partial();

/* ========================================================================== */
/* Project List Query                                                        */
/* ========================================================================== */

/**
 * Validates and normalizes query parameters for retrieving project listings.
 *
 * Supports text search, tag and tag-type filtering, publication status,
 * ownership filtering, sorting, and pagination.
 */
export const projectListQuerySchema = z.object({
    search: z
        .string()
        .trim()
        .max(80, "Search query must not exceed 80 characters.")
        .optional(),

    tag: z
        .string()
        .regex(OBJECT_ID_RE, "Invalid tag ID.")
        .optional(),

    tagType: z
        .string()
        .regex(OBJECT_ID_RE, "Invalid tag type ID.")
        .optional(),

    status: z.enum(["draft", "published", "archived"]).optional(),

    mine: z.coerce.boolean().optional(),

    sort: z
        .enum(["recent", "rating", "downloads", "stars"])
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
        .default(12)
});

/* ========================================================================== */
/* Explore Query                                                              */
/* ========================================================================== */

/**
 * Validates and normalizes query parameters for the project exploration feed.
 *
 * Supports discovery sorting modes, optional time windows, tag filtering,
 * text search, and pagination.
 */
export const exploreQuerySchema = z.object({
    sort: z
        .enum([
            "trending",
            "hot",
            "top",
            "new",
            "top-rated",
            "top-downloaded"
        ])
        .optional()
        .default("trending"),

    window: z.enum(["24h", "7d", "30d", "all"]).optional(),

    tag: z
        .string()
        .regex(OBJECT_ID_RE, "Invalid tag ID.")
        .optional(),

    tagType: z
        .string()
        .regex(OBJECT_ID_RE, "Invalid tag type ID.")
        .optional(),

    search: z
        .string()
        .trim()
        .max(80, "Search query must not exceed 80 characters.")
        .optional(),

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
        .default(20)
});

/**
 * Copyright (c) 2026 Sobhan Rasoulzadeh Asl (Sobhan-SRZA / Mr. Sinre)
 *
 * Licensed under the BSD 3-Clause License.
 * See the LICENSE file in the project root for license information.
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */