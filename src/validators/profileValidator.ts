import { z } from "zod";

/* ==================================================================
   Update basic profile (name, bio)
   ================================================================== */
export const updateProfileSchema = z.object({
    name: z.string().trim().min(2, "نام باید حداقل ۲ حرف باشد").max(60).optional(),
    bio: z.string().trim().max(2000, "توضیحات حداکثر ۲۰۰۰ کاراکتر").optional()
});

/* ==================================================================
   Request email change
   ================================================================== */
export const requestEmailChangeSchema = z.object({
    newEmail: z
        .string({ error: "ایمیل جدید الزامی است" })
        .trim()
        .toLowerCase()
        .email("ایمیل نامعتبر است")
        .max(254),
    password: z.string({ error: "رمز عبور فعلی الزامی است" }).min(1)
});

/* ==================================================================
   Verify email change (code from new email)
   ================================================================== */
export const verifyEmailChangeSchema = z.object({
    code: z
        .string({ error: "کد تایید الزامی است" })
        .trim()
        .regex(/^\d{6}$/, "کد باید ۶ رقم باشد")
});

/* ==================================================================
   Cancel pending email change
   ================================================================== */
// بدون body

/* ==================================================================
   Request password change
   ================================================================== */
const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

export const requestPasswordChangeSchema = z
    .object({
        currentPassword: z.string({ error: "رمز فعلی الزامی است" }).min(1),
        newPassword: z
            .string({ error: "رمز جدید الزامی است" })
            .min(8, "رمز جدید باید حداقل ۸ کاراکتر باشد")
            .max(128)
            .regex(
                passwordRegex,
                "رمز باید شامل حرف کوچک، حرف بزرگ و عدد باشد"
            ),
        confirmPassword: z.string({ error: "تکرار رمز الزامی است" })
    })
    .refine((d) => d.newPassword === d.confirmPassword, {
        message: "رمز جدید و تکرار آن یکسان نیستند",
        path: ["confirmPassword"]
    })
    .refine((d) => d.currentPassword !== d.newPassword, {
        message: "رمز جدید نباید با رمز فعلی یکسان باشد",
        path: ["newPassword"]
    });

/* ==================================================================
   Confirm password change (code from email)
   ================================================================== */
export const confirmPasswordChangeSchema = z
    .object({
        code: z
            .string({ error: "کد تایید الزامی است" })
            .trim()
            .regex(/^\d{6}$/, "کد باید ۶ رقم باشد"),
        newPassword: z
            .string()
            .min(8, "رمز جدید باید حداقل ۸ کاراکتر باشد")
            .max(128)
            .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/, "رمز باید شامل حرف کوچک، حرف بزرگ و عدد باشد"),
        confirmPassword: z.string()
    })
    .refine((d) => d.newPassword === d.confirmPassword, {
        message: "رمز جدید و تکرار آن یکسان نیستند",
        path: ["confirmPassword"]
    });

/* ==================================================================
   Change username
   ================================================================== */
const USERNAME_REGEX = /^[a-zA-Z0-9_.-]{3,20}$/;

export const changeUsernameSchema = z.object({
    username: z
        .string({ error: "نام کاربری الزامی است" })
        .trim()
        .min(3, "نام کاربری باید حداقل ۳ کاراکتر باشد")
        .max(20, "نام کاربری باید حداکثر ۲۰ کاراکتر باشد")
        .refine((v) => !v.includes("@"), "نام کاربری نمی‌تواند شامل @ باشد")
        .refine((v) => !/\s/.test(v), "نام کاربری نمی‌تواند شامل فاصله باشد")
        .refine(
            (v) => USERNAME_REGEX.test(v),
            "فقط حروف انگلیسی، عدد، _ ، . یا -"
        )
});

/**
 * Copyright (c) 2026 Sobhan Rasoulzadeh Asl (Sobhan-SRZA / Mr. Sinre)
 *
 * Licensed under the BSD 3-Clause License.
 * See the LICENSE file in the project root for license information.
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */