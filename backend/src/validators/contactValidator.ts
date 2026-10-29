/**
 * Validation schemas for the contact form and ticket management.
 */

import { z } from "zod";

const OBJECT_ID_RE = /^[a-f\d]{24}$/i;

export const createTicketSchema = z.object({
    name: z
        .string({ error: "Name is required." })
        .trim()
        .min(2, "Name must be at least 2 characters long.")
        .max(80, "Name must not exceed 80 characters."),

    email: z
        .string({ error: "Email is required." })
        .trim()
        .toLowerCase()
        .email("Please enter a valid email address.")
        .max(254, "Email must not exceed 254 characters."),

    subject: z
        .string({ error: "Subject is required." })
        .trim()
        .min(3, "Subject must be at least 3 characters long.")
        .max(120, "Subject must not exceed 120 characters."),

    category: z
        .enum(["general", "bug", "feature", "collaboration", "security", "other"])
        .default("general"),

    message: z
        .string({ error: "Message is required." })
        .trim()
        .min(20, "Message must be at least 20 characters long.")
        .max(5000, "Message must not exceed 5000 characters.")
});

export const ticketReplySchema = z.object({
    body: z
        .string({ error: "Reply is required." })
        .trim()
        .min(1, "Reply cannot be empty.")
        .max(5000, "Reply must not exceed 5000 characters.")
});

export const ticketUpdateSchema = z.object({
    status: z.enum(["open", "pending", "resolved", "closed"]).optional(),
    priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
    assignedTo: z
        .string()
        .regex(OBJECT_ID_RE, "Invalid user id.")
        .nullable()
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