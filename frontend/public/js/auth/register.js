/* ============================================================
   Register page
   ============================================================ */

document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("registerForm");
    if (!form)
        return;

    /* ---------------- regex هم‌راستا با سرور ---------------- */
    const RE = {
        name: /^.{2,60}$/,
        username: /^[a-zA-Z0-9_.-]{3,20}$/,
        email: /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/,
        password: /^(?=.*[A-Za-z])(?=.*\d).{6,}$/
    };

    /* ---------------- کلید ذخیره‌سازی state تایید ایمیل ---------------- */
    const VERIFY_STORAGE_KEY = "email_verify_state";

    function saveVerifyState(data, email) {
        try {
            if (!data?.verifyToken || !email) return false;
            sessionStorage.setItem(
                VERIFY_STORAGE_KEY,
                JSON.stringify({
                    verifyToken: data.verifyToken,
                    email: data.email || email,
                    expiresAt: Date.now() + (data.expiresIn || 900) * 1000,
                })
            );
            return true;
        } catch {
            return false;
        }
    }

    FormKit.attach(form, {
        /* ---------------- اعتبارسنجی سمت کلاینت ---------------- */
        validate(v) {
            const errors = {};

            // name
            if (!v.name) {
                errors.name = "نام الزامی است";
            }
            else if (v.name.length < 2) {
                errors.name = "نام باید حداقل ۲ حرف باشد";
            }
            else if (v.name.length > 60) {
                errors.name = "نام بیش از حد طولانی است";
            }

            // username
            if (!v.username) {
                errors.username = "نام کاربری الزامی است";
            }
            else if (v.username.includes("@")) {
                errors.username = "نام کاربری نمی‌تواند شامل @ باشد";
            }
            else if (/\s/.test(v.username)) {
                errors.username = "نام کاربری نمی‌تواند شامل فاصله باشد";
            }
            else if (v.username.length < 3) {
                errors.username = "نام کاربری باید حداقل ۳ کاراکتر باشد";
            }
            else if (v.username.length > 20) {
                errors.username = "نام کاربری باید حداکثر ۲۰ کاراکتر باشد";
            }
            else if (!RE.username.test(v.username)) {
                errors.username = "نام کاربری فقط می‌تواند شامل حروف انگلیسی، عدد، _ ، . یا - باشد";
            }

            // email
            if (!v.email) {
                errors.email = "ایمیل الزامی است";
            }
            else if (!RE.email.test(v.email)) {
                errors.email = "ایمیل نامعتبر است";
            }

            // password
            if (!v.password) {
                errors.password = "رمز عبور الزامی است";
            }
            else if (v.password.length < 6) {
                errors.password = "رمز عبور باید حداقل ۶ کاراکتر باشد";
            }
            else if (!RE.password.test(v.password)) {
                errors.password = "رمز عبور باید شامل حرف و عدد باشد";
            }

            // confirm
            if (!v.confirmPassword) {
                errors.confirmPassword = "تکرار رمز عبور الزامی است";
            }
            else if (v.password !== v.confirmPassword) {
                errors.confirmPassword = "رمز عبور و تکرار آن یکسان نیستند";
            }

            // terms
            if (!v.terms) {
                errors.terms = "پذیرش قوانین الزامی است";
            }

            return errors;
        },

        /* ---------------- ارسال ---------------- */
        submit(v) {
            return FormKit.postJSON("/api/auth/register", {
                name: v.name,
                username: v.username,
                email: v.email,
                password: v.password,
                confirmPassword: v.confirmPassword,
                terms: !!v.terms
            });
        },

        /* ---------------- success ---------------- */
        onSuccess(data) {
            // اگر سرور verifyToken برگرداند → برو صفحه تایید ایمیل
            const email =
                data?.email ||
                form.querySelector('[name="email"]')?.value?.trim()?.toLowerCase();

            if (saveVerifyState(data, email)) {
                toast(
                    data?.message || "حساب شما ساخته شد. کد تایید را وارد کنید",
                    "success"
                );
                setTimeout(() => {
                    location.href = "/auth/verify-email";
                }, 800);
                return;
            }

            // fallback: اگر verifyToken نبود، رفتار قبلی
            toast("حساب شما با موفقیت ساخته شد 🎉", "success");
            setTimeout(() => (location.href = "/"), 700);
        },

        /* ---------------- extra: log payload برای دیباگ ---------------- */
        onError(payload) {
            if (location.hostname === "localhost") {
                console.debug("[register error]", payload);
            }
        }
    });
});

/**
 * Copyright (c) 2026 Sobhan Rasoulzadeh Asl (Sobhan-SRZA / Mr. Sinre)
 *
 * Licensed under the BSD 3-Clause License.
 * See the LICENSE file in the project root for license information.
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */