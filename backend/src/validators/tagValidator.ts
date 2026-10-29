/**
 * Server-side validation schemas for tag and tag type management.
 *
 * Defines validation rules for creating and updating tag types and tags,
 * finding or creating tags, suggesting tags, querying tag listings, and
 * submitting tag type requests for administrative review.
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

// Slugs must contain 2–40 lowercase letters, digits, or hyphens.
const SLUG_RE = /^[a-z0-9-]{2,40}$/;

// Validates six-digit hexadecimal color codes in the #RRGGBB format.
const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

// Validates 24-character hexadecimal MongoDB ObjectIds.
const OBJECT_ID_RE = /^[a-f\d]{24}$/i;

/* ========================================================================== */
/* Tag Type                                                                   */
/* ========================================================================== */

/**
 * Validates the payload required to create a tag type.
 *
 * Supports names, optional slugs, descriptions, colors, icons, display order,
 * and configuration for allowing user-created tags.
 */
export const createTagTypeSchema = z.object({
    name: z
        .string()
        .trim()
        .min(2, "Name must be at least 2 characters long.")
        .max(50, "Name must not exceed 50 characters."),

    slug: z
        .string()
        .trim()
        .toLowerCase()
        .regex(SLUG_RE, "Slug must contain 2–40 lowercase letters, digits, or hyphens.")
        .optional(),

    description: z
        .string()
        .trim()
        .max(300, "Description must not exceed 300 characters.")
        .optional(),

    color: z
        .string()
        .regex(HEX_COLOR_RE, "Color must be a valid hexadecimal color in #RRGGBB format.")
        .optional(),

    icon: z
        .string()
        .trim()
        .max(8, "Icon must not exceed 8 characters.")
        .optional(),

    order: z
        .number()
        .int("Order must be an integer.")
        .min(0, "Order cannot be negative.")
        .max(9999, "Order must not exceed 9999.")
        .optional(),

    allowUserTags: z.boolean().optional()
});

/**
 * Validates partial updates to an existing tag type.
 *
 * Reuses the tag type creation schema while making every field optional.
 */
export const updateTagTypeSchema = createTagTypeSchema.partial();

/* ========================================================================== */
/* Tag                                                                        */
/* ========================================================================== */

/**
 * Validates the payload required to create a tag.
 *
 * Normalizes the tag name and optional slug, validates its optional category
 * reference and visual properties, and accepts an optional description.
 * Empty or null category values are treated as an omitted category.
 */
export const createTagSchema = z.object({
    name: z
        .string()
        .trim()
        .min(1, "Tag name is required.")
        .max(40, "Tag name must not exceed 40 characters."),

    slug: z
        .string()
        .trim()
        .toLowerCase()
        .regex(SLUG_RE, "Slug must contain 2–40 lowercase letters, digits, or hyphens.")
        .optional(),

    type: z.preprocess(
        (value) => (value === "" || value === null ? undefined : value),
        z
            .string()
            .regex(OBJECT_ID_RE, "Invalid tag type ID.")
            .optional()
    ),

    color: z
        .string()
        .regex(HEX_COLOR_RE, "Color must be a valid hexadecimal color in #RRGGBB format.")
        .optional(),

    description: z
        .string()
        .trim()
        .max(200, "Description must not exceed 200 characters.")
        .optional()
});

/**
 * Validates partial updates to an existing tag.
 *
 * Excludes the tag type field to prevent changing a tag's category through
 * this update operation.
 */
export const updateTagSchema = createTagSchema
    .partial()
    .omit({ type: true });

/* ========================================================================== */
/* Find or Create Tag — Picker                                                */
/* ========================================================================== */

/**
 * Validates input for the tag picker operation that finds an existing tag
 * or creates a new one when necessary.
 *
 * An omitted or empty tag type indicates a general-purpose tag.
 */
export const findOrCreateTagSchema = z.object({
    name: z
        .string()
        .trim()
        .min(1, "Tag name is required.")
        .max(40, "Tag name must not exceed 40 characters."),

    type: z.preprocess(
        // Treat empty or null values as an omitted tag type.
        (value) => (value === "" || value === null ? undefined : value),
        z
            .string()
            .regex(OBJECT_ID_RE, "Invalid tag type ID.")
            .optional()
    )
});

/* ========================================================================== */
/* Suggest Tags                                                               */
/* ========================================================================== */

/**
 * Validates query parameters for tag suggestions.
 *
 * Supports text-based suggestions, optional filtering by tag type,
 * and a configurable result limit.
 */
export const suggestTagsSchema = z.object({
    q: z
        .string()
        .trim()
        .max(40, "Search query must not exceed 40 characters.")
        .optional()
        .default(""),

    type: z
        .string()
        .regex(OBJECT_ID_RE, "Invalid tag type ID.")
        .optional(),

    limit: z.coerce
        .number()
        .int()
        .min(1, "Limit must be at least 1.")
        .max(50, "Limit must not exceed 50.")
        .optional()
        .default(20)
});

/* ========================================================================== */
/* Tag List Query                                                             */
/* ========================================================================== */

/**
 * Validates and normalizes query parameters for retrieving tags.
 *
 * Supports filtering by tag type, text search, sorting, approval status,
 * ownership, and pagination.
 */
export const listQuerySchema = z.object({
    type: z
        .string()
        .regex(OBJECT_ID_RE, "Invalid tag type ID.")
        .optional(),

    search: z
        .string()
        .trim()
        .max(60, "Search query must not exceed 60 characters.")
        .optional(),

    sort: z
        .enum(["name", "usage", "recent"])
        .optional()
        .default("usage"),

    approved: z.coerce.boolean().optional().default(true),

    mine: z.coerce.boolean().optional().default(false),

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
        .default(50)
});

/* ========================================================================== */
/* Request Tag Type                                                           */
/* ========================================================================== */

/**
 * Validates a user-submitted request to create a new tag type.
 *
 * Requests may include a name, description, visual properties, and an
 * optional justification for administrative review.
 */
export const requestTagTypeSchema = z.object({
    name: z
        .string()
        .trim()
        .min(2, "Name must be at least 2 characters long.")
        .max(50, "Name must not exceed 50 characters."),

    description: z
        .string()
        .trim()
        .max(300, "Description must not exceed 300 characters.")
        .optional(),

    color: z
        .string()
        .regex(HEX_COLOR_RE, "Color must be a valid hexadecimal color in #RRGGBB format.")
        .optional(),

    icon: z
        .string()
        .trim()
        .max(8, "Icon must not exceed 8 characters.")
        .optional(),

    reason: z
        .string()
        .trim()
        .max(500, "Reason must not exceed 500 characters.")
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