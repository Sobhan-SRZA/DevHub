/* ============================================================
   Login page
   ============================================================ */

document.addEventListener("DOMContentLoaded", () => {
    /* fingerprint.js — یه fingerprint ساده و سبک (بدون کتابخانه) */
    function getClientFingerprint() {
        const parts = [
            navigator.userAgent,
            navigator.language,
            navigator.languages?.join(',') || '',
            screen.colorDepth,
            screen.width + 'x' + screen.height,
            new Date().getTimezoneOffset(),
            navigator.hardwareConcurrency || '',
            navigator.platform || ''
        ];

        // hash ساده (FNV-1a)
        let hash = 0x811c9dc5;
        const str = parts.join('|');
        for (let i = 0; i < str.length; i++) {
            hash ^= str.charCodeAt(i);
            hash = (hash * 0x01000193) >>> 0;
        }

        return hash.toString(16);
    }

    // ذخیره در localStorage برای پایداری بین سشن‌ها
    function getOrCreateDeviceId() {
        let id = localStorage.getItem('deviceId');
        if (!id) {
            id = crypto.randomUUID
                ? crypto.randomUUID()
                : 'dev-' + Math.random().toString(36).slice(2) + Date.now().toString(36);

            localStorage.setItem('deviceId', id);
        }

        return id;
    }

    const form = document.getElementById("loginForm");
    if (!form)
        return;

    FormKit.attach(form, {
        /* ---------------- اعتبارسنجی سمت کلاینت ---------------- */
        validate(v) {
            const errors = {};

            if (!v.identifier) {
                errors.identifier = "ایمیل یا نام کاربری الزامی است";
            }
            else if (v.identifier.length < 3) {
                errors.identifier = "حداقل ۳ کاراکتر وارد کنید";
            }
            else if (v.identifier.length > 254) {
                errors.identifier = "مقدار وارد شده خیلی طولانی است";
            }

            if (!v.password) {
                errors.password = "رمز عبور الزامی است";
            }
            else if (v.password.length < 6) {
                errors.password = "رمز عبور باید حداقل ۶ کاراکتر باشد";
            }

            return errors;
        },

        /* ---------------- ارسال ---------------- */
        submit(v) {
            return FormKit.postJSON("/api/auth/login", {
                identifier: v.identifier,
                password: v.password,
                remember: !!v.remember,
                fingerprint: getClientFingerprint(),
                deviceId: getOrCreateDeviceId()
            });
        },

        /* ---------------- success ---------------- */
        onSuccess() {
            toast("خوش آمدید", "success");
            setTimeout(() => (location.href = "/"), 500);
        },

        onError(payload) {
            if (location.hostname === "localhost") {
                console.debug("[login error]", payload);
            }

            // اگه خطای invalid credentials بود → روی فیلد password تمرکز کن
            if (payload?.code === FormKit.ERROR_CODES.INVALID_CREDENTIALS) {
                const pw = form.querySelector(`[name="password"]`);
                if (pw)
                    pw.select?.();
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