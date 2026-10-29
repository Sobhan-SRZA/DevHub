/**
 * Server-side validation schemas for user account and profile management.
 *
 * Defines input validation rules for updating profile information, changing
 * email addresses and passwords, verifying email change requests, and
 * updating usernames.
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
/* Update Basic Profile                                                       */
/* ========================================================================== */

/**
 * Validates profile updates, including the user's display name and biography.
 *
 * Both fields are optional, allowing clients to update either field
 * independently.
 */
export const updateProfileSchema = z.object({
    name: z
        .string()
        .trim()
        .min(2, "Name must be at least 2 characters long.")
        .max(60, "Name must not exceed 60 characters.")
        .optional(),

    bio: z.string().trim().optional()
});

/* ========================================================================== */
/* Request Email Change                                                       */
/* ========================================================================== */

/**
 * Validates an email change request.
 *
 * Normalizes the new email address and requires the user's current password
 * for authentication.
 */
export const requestEmailChangeSchema = z.object({
    newEmail: z
        .string({ error: "New email address is required." })
        .trim()
        .toLowerCase()
        .email("Please enter a valid email address.")
        .max(254, "Email address must not exceed 254 characters."),

    password: z
        .string({ error: "Current password is required." })
        .min(1, "Current password is required.")
});

/* ========================================================================== */
/* Verify Email Change                                                        */
/* ========================================================================== */

/**
 * Validates the six-digit verification code sent to the new email address.
 */
export const verifyEmailChangeSchema = z.object({
    code: z
        .string({ error: "Verification code is required." })
        .trim()
        .regex(/^\d{6}$/, "Verification code must contain exactly 6 digits.")
});

/* ========================================================================== */
/* Cancel Pending Email Change                                                */
/* ========================================================================== */

// This operation does not require a request body.

/* ========================================================================== */
/* Request Password Change                                                    */
/* ========================================================================== */

// Requires at least eight characters, including one lowercase letter,
// one uppercase letter, and one digit.
const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

/**
 * Validates a password change request.
 *
 * Requires the current password, enforces the new password's strength
 * requirements, verifies the password confirmation, and prevents users
 * from reusing their current password.
 */
export const requestPasswordChangeSchema = z
    .object({
        currentPassword: z
            .string({ error: "Current password is required." })
            .min(1, "Current password is required."),

        newPassword: z
            .string({ error: "New password is required." })
            .min(8, "New password must be at least 8 characters long.")
            .max(128, "New password must not exceed 128 characters.")
            .regex(
                passwordRegex,
                "Password must contain at least one lowercase letter, one uppercase letter, and one digit."
            ),

        confirmPassword: z.string({
            error: "Password confirmation is required."
        })
    })
    .refine((data) => data.newPassword === data.confirmPassword, {
        message: "New password and confirmation do not match.",
        path: ["confirmPassword"]
    })
    .refine((data) => data.currentPassword !== data.newPassword, {
        message: "New password must be different from the current password.",
        path: ["newPassword"]
    });

/* ========================================================================== */
/* Confirm Password Change                                                    */
/* ========================================================================== */

/**
 * Validates the verification code and new password when confirming a password
 * change request.
 */
export const confirmPasswordChangeSchema = z
    .object({
        code: z
            .string({ error: "Verification code is required." })
            .trim()
            .regex(/^\d{6}$/, "Verification code must contain exactly 6 digits."),

        newPassword: z
            .string({ error: "New password is required." })
            .min(8, "New password must be at least 8 characters long.")
            .max(128, "New password must not exceed 128 characters.")
            .regex(
                passwordRegex,
                "Password must contain at least one lowercase letter, one uppercase letter, and one digit."
            ),

        confirmPassword: z.string({
            error: "Password confirmation is required."
        })
    })
    .refine((data) => data.newPassword === data.confirmPassword, {
        message: "New password and confirmation do not match.",
        path: ["confirmPassword"]
    });

/* ========================================================================== */
/* Change Username                                                            */
/* ========================================================================== */

// Usernames must contain 3–20 characters and use only ASCII letters,
// digits, underscores, periods, and hyphens.
const USERNAME_REGEX = /^[a-zA-Z0-9_.-]{3,20}$/;

/**
 * Validates a username change request.
 *
 * Trims surrounding whitespace and rejects usernames containing the @ symbol,
 * whitespace, or unsupported characters.
 */
export const changeUsernameSchema = z.object({
    username: z
        .string({ error: "Username is required." })
        .trim()
        .min(3, "Username must be at least 3 characters long.")
        .max(20, "Username must not exceed 20 characters.")
        .refine(
            (value) => !value.includes("@"),
            "Username cannot contain the @ symbol."
        )
        .refine(
            (value) => !/\s/.test(value),
            "Username cannot contain whitespace."
        )
        .refine(
            (value) => USERNAME_REGEX.test(value),
            "Username may only contain English letters, digits, underscores, periods, and hyphens."
        )
});

/* ========================================================================== */
/* Verify Old Email                                                           */
/* ========================================================================== */

/**
 * Validates the verification code sent to the current email address as part
 * of the email change process.
 */
export const verifyOldEmailForChangeSchema = z.object({
    code: z
        .string({ error: "Verification code is required." })
        .trim()
        .regex(/^\d{6}$/, "Verification code must contain exactly 6 digits.")
});

/**
 * Copyright (c) 2026 Sobhan Rasoulzadeh Asl (Sobhan-SRZA / Mr. Sinre)
 *
 * Licensed under the BSD 3-Clause License.
 * See the LICENSE file in the project root for license information.
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */