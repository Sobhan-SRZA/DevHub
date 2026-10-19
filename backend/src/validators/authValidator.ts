import { z } from 'zod';

/* ----------------------------------------------------------------
   Username rules:
   - 3 تا 20 کاراکتر
   - فقط حروف انگلیسی (a-zA-Z)، عدد، _ ، . ، -
   - @ ممنوع
   - فاصله ممنوع
   - حروف غیرانگلیسی (فارسی، عربی، سیریلیک...) ممنوع
   - حساس به case نیست (چک یکتایی توسط usernameLower)
---------------------------------------------------------------- */
const USERNAME_REGEX = /^[a-zA-Z0-9_.-]{3,20}$/;

/* ----------------------------------------------------------------
   Password rules:
   - حداقل ۶ کاراکتر
   - حداقل یک حرف و یک عدد
---------------------------------------------------------------- */
const PASSWORD_REGEX = /^(?=.*[A-Za-z])(?=.*\d).{6,}$/;

/* ----------------------------------------------------------------
   Email
---------------------------------------------------------------- */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/* ==================================================================
   REGISTER
   ================================================================== */
export const registerSchema = z
    .object({
        name: z
            .string({ error: 'نام الزامی است' })
            .trim()
            .min(2, 'نام باید حداقل ۲ حرف باشد')
            .max(60, 'نام بیش از حد طولانی است'),

        username: z
            .string({ error: 'نام کاربری الزامی است' })
            .trim()
            .min(3, 'نام کاربری باید حداقل ۳ کاراکتر باشد')
            .max(20, 'نام کاربری باید حداکثر ۲۰ کاراکتر باشد')
            .refine((v) => !v.includes('@'), 'نام کاربری نمی‌تواند شامل @ باشد')
            .refine((v) => !/\s/.test(v), 'نام کاربری نمی‌تواند شامل فاصله باشد')
            .refine(
                (v) => USERNAME_REGEX.test(v),
                'نام کاربری فقط می‌تواند شامل حروف انگلیسی، عدد، _ ، . یا - باشد'
            ),

        email: z
            .string({ error: 'ایمیل الزامی است' })
            .trim()
            .toLowerCase()
            .max(254, 'ایمیل بیش از حد طولانی است')
            .refine((v) => EMAIL_REGEX.test(v), 'ایمیل نامعتبر است'),

        password: z
            .string({ error: 'رمز عبور الزامی است' })
            .min(6, 'رمز عبور باید حداقل ۶ کاراکتر باشد')
            .max(128, 'رمز عبور بیش از حد طولانی است')
            .refine(
                (v) => PASSWORD_REGEX.test(v),
                'رمز عبور باید شامل حرف و عدد باشد'
            ),

        confirmPassword: z.string({ error: 'تکرار رمز عبور الزامی است' }),

        terms: z
            .union([z.boolean(), z.literal('on'), z.literal('true'), z.literal('1')])
            .optional()
    })
    .refine((d) => d.password === d.confirmPassword, {
        message: 'رمز عبور و تکرار آن یکسان نیستند',
        path: ['confirmPassword']
    })
    .refine((d) => !!d.terms, {
        message: 'پذیرش قوانین الزامی است',
        path: ['terms']
    });

/* ==================================================================
   LOGIN
   ================================================================== */
export const loginSchema = z.object({
    identifier: z
        .string({ error: 'ایمیل یا نام کاربری الزامی است' })
        .trim()
        .min(1, 'ایمیل یا نام کاربری الزامی است')
        .max(254, 'مقدار وارد شده خیلی طولانی است'),

    password: z
        .string({ error: 'رمز عبور الزامی است' })
        .min(1, 'رمز عبور الزامی است'),

    remember: z
        .union([z.boolean(), z.literal('on'), z.literal('true'), z.literal('1')])
        .optional()
});

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