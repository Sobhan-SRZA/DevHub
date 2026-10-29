/**
 * backend/src/validators/authValidator.ts
 * Server-side module — core application logic.
 */

import { z } from "zod";

/* -------------------------------------------------------------------------- */
/* Username Validation Rules                                                  */
/* -------------------------------------------------------------------------- */

// - Length: 3–20 characters.
// - Allowed characters: English letters (a-z, A-Z), digits, underscores, periods, and hyphens.
// - The @ symbol and whitespace are not allowed.
// - Non-ASCII letters, including Persian, Arabic, and Cyrillic characters, are not allowed.
// - Case-insensitive uniqueness is enforced through the usernameLower field.
const USERNAME_REGEX = /^[a-zA-Z0-9_.-]{3,20}$/;

/* -------------------------------------------------------------------------- */
/* Password Validation Rules                                                 */
/* -------------------------------------------------------------------------- */

// Requires at least six characters, including at least one letter and one digit.
const PASSWORD_REGEX = /^(?=.*[A-Za-z])(?=.*\d).{6,}$/;

/* -------------------------------------------------------------------------- */
/* Email Validation Rules                                                    */
/* -------------------------------------------------------------------------- */

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/* ========================================================================== */
/* Registration                                                               */
/* ========================================================================== */

export const registerSchema = z
    .object({
        name: z
            .string({ error: "Name is required." })
            .trim()
            .min(2, "Name must be at least 2 characters long.")
            .max(60, "Name must not exceed 60 characters."),

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
            ),

        email: z
            .string({ error: "Email is required." })
            .trim()
            .toLowerCase()
            .max(254, "Email must not exceed 254 characters.")
            .refine(
                (value) => EMAIL_REGEX.test(value),
                "Please enter a valid email address."
            ),

        password: z
            .string({ error: "Password is required." })
            .min(6, "Password must be at least 6 characters long.")
            .max(128, "Password must not exceed 128 characters.")
            .refine(
                (value) => PASSWORD_REGEX.test(value),
                "Password must contain at least one letter and one digit."
            ),

        confirmPassword: z.string({
            error: "Password confirmation is required."
        }),

        terms: z
            .union([
                z.boolean(),
                z.literal("on"),
                z.literal("true"),
                z.literal("1")
            ])
            .optional()
    })
    .refine((data) => data.password === data.confirmPassword, {
        message: "Password and confirmation do not match.",
        path: ["confirmPassword"]
    })
    .refine((data) => Boolean(data.terms), {
        message: "You must accept the terms and conditions.",
        path: ["terms"]
    });

/* ========================================================================== */
/* Login                                                                      */
/* ========================================================================== */

export const loginSchema = z.object({
    identifier: z
        .string({ error: "Email or username is required." })
        .trim()
        .min(1, "Email or username is required.")
        .max(254, "The provided identifier is too long."),

    password: z
        .string({ error: "Password is required." })
        .min(1, "Password is required."),

    remember: z
        .union([
            z.boolean(),
            z.literal("on"),
            z.literal("true"),
            z.literal("1")
        ])
        .optional()
});

/* ========================================================================== */
/* Email Verification                                                         */
/* ========================================================================== */

export const verifyEmailSchema = z.object({
    verifyToken: z
        .string({ error: "Email verification token is required." })
        .min(10),

    code: z
        .string({ error: "Verification code is required." })
        .trim()
        .regex(/^\d{6}$/, "Verification code must contain exactly 6 digits.")
});

/* ========================================================================== */
/* Resend Email Verification                                                  */
/* ========================================================================== */

export const resendVerifyEmailSchema = z.object({
    verifyToken: z
        .string()
        .min(1, "Email verification token is required.")
});

/* ========================================================================== */
/* Forgot Password — Step 1                                                  */
/* ========================================================================== */

export const forgotPasswordSchema = z.object({
    email: z
        .string({ error: "Email is required." })
        .trim()
        .toLowerCase()
        .email("Please enter a valid email address.")
        .max(254, "Email must not exceed 254 characters.")
});

/* ========================================================================== */
/* Reset Password — Step 2                                                   */
/* ========================================================================== */

// Requires at least eight characters, including a lowercase letter,
// an uppercase letter, and a digit.
const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

export const resetPasswordSchema = z
    .object({
        resetToken: z
            .string({ error: "Password reset token is required." })
            .min(10),

        code: z
            .string({ error: "Verification code is required." })
            .trim()
            .regex(/^\d{6}$/, "Verification code must contain exactly 6 digits."),

        newPassword: z
            .string({ error: "New password is required." })
            .min(8, "New password must be at least 8 characters long.")
            .max(128, "New password must not exceed 128 characters.")
            .regex(
                strongPasswordRegex,
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
/* Resend Password Reset                                                      */
/* ========================================================================== */

export const resendPasswordResetSchema = z.object({
    resetToken: z
        .string({ error: "Password reset token is required." })
        .min(10)
});

/* ========================================================================== */
/* Inferred Types                                                             */
/* ========================================================================== */

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

/**
 * Copyright (c) 2026 Sobhan Rasoulzadeh Asl (Sobhan-SRZA / Mr. Sinre)
 *
 * Licensed under the BSD 3-Clause License.
 * See the LICENSE file in the project root for license information.
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */