/**
 * backend/src/validators/authValidator.ts
 *
 * Server-side validation schemas for authentication-related operations.
 * Defines input validation rules for registration, login, email verification,
 * password recovery, and password reset.
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
/* Username Validation Rules                                                  */
/* -------------------------------------------------------------------------- */

// Usernames must:
// - Contain between 3 and 20 characters.
// - Use only ASCII letters, digits, underscores, periods, and hyphens.
// - Exclude the @ symbol and all whitespace.
// - Exclude non-ASCII letters, including Persian, Arabic, and Cyrillic characters.
// - Be unique regardless of letter casing, enforced through the usernameLower field.
const USERNAME_REGEX = /^[a-zA-Z0-9_.-]{3,20}$/;

/* -------------------------------------------------------------------------- */
/* Password Validation Rules                                                 */
/* -------------------------------------------------------------------------- */

// Requires at least six characters, including at least one letter and one digit.
const PASSWORD_REGEX = /^(?=.*[A-Za-z])(?=.*\d).{6,}$/;

/* -------------------------------------------------------------------------- */
/* Email Validation Rules                                                    */
/* -------------------------------------------------------------------------- */

// Validates a basic email address format with a domain suffix of at least two characters.
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/* ========================================================================== */
/* Registration                                                               */
/* ========================================================================== */

/**
 * Validates user registration input.
 *
 * Normalizes the name and username by trimming surrounding whitespace,
 * converts the email address to lowercase, enforces password requirements,
 * verifies password confirmation, and requires acceptance of the terms.
 */
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

/**
 * Validates login credentials and the optional remember-me setting.
 */
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

/**
 * Validates the email verification token and six-digit verification code.
 */
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

/**
 * Validates the token required to resend an email verification code.
 */
export const resendVerifyEmailSchema = z.object({
    verifyToken: z
        .string()
        .min(1, "Email verification token is required.")
});

/* ========================================================================== */
/* Forgot Password — Step 1                                                   */
/* ========================================================================== */

/**
 * Validates and normalizes the email address used to initiate password recovery.
 */
export const forgotPasswordSchema = z.object({
    email: z
        .string({ error: "Email is required." })
        .trim()
        .toLowerCase()
        .email("Please enter a valid email address.")
        .max(254, "Email must not exceed 254 characters.")
});

/* ========================================================================== */
/* Reset Password — Step 2                                                    */
/* ========================================================================== */

// Requires at least eight characters, including at least one lowercase letter,
// one uppercase letter, and one digit.
const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

/**
 * Validates password reset credentials, the verification code, and the new
 * password. Ensures the new password meets strength requirements and matches
 * its confirmation.
 */
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

/**
 * Validates the token required to resend a password reset verification code.
 */
export const resendPasswordResetSchema = z.object({
    resetToken: z
        .string({ error: "Password reset token is required." })
        .min(10)
});

/* ========================================================================== */
/* Inferred Types                                                             */
/* ========================================================================== */

/** The validated input type inferred from the registration schema. */
export type RegisterInput = z.infer<typeof registerSchema>;

/** The validated input type inferred from the login schema. */
export type LoginInput = z.infer<typeof loginSchema>;

/**
 * Copyright (c) 2026 Sobhan Rasoulzadeh Asl (Sobhan-SRZA / Mr. Sinre)
 *
 * Licensed under the BSD 3-Clause License.
 * See the LICENSE file in the project root for license information.
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */