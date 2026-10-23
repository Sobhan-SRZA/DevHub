/* ============================================================
   Forgot Password Page
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
    const $ = (s) => document.querySelector(s);
    const form = $('#forgotForm');

    if (!form) return;

    const emailInput = $('#email');
    const submitBtn = $('#submitBtn');

    /* ---------------- API ---------------- */
    async function api(path, body) {
        const res = await fetch(path, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        let data = null;
        try { data = await res.json(); } catch { }
        if (!res.ok) {
            const err = new Error(data?.message || 'خطا');
            Object.assign(err, data || {}, { status: res.status });
            throw err;
        }
        return data;
    }

    /* ---------------- Submit ---------------- */
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const email = emailInput.value.trim().toLowerCase();

        FormKit.clearAllErrors(form);

        if (!email) {
            return FormKit.showFieldError(emailInput, 'ایمیل الزامی است');
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
            return FormKit.showFieldError(emailInput, 'ایمیل نامعتبر است');
        }

        submitBtn.disabled = true;
        const original = submitBtn.textContent;
        submitBtn.textContent = 'در حال ارسال…';

        try {
            const data = await api('/api/auth/forgot-password', { email });

            // ذخیره در sessionStorage
            if (data?.resetToken) {
                sessionStorage.setItem(
                    'password_reset_state',
                    JSON.stringify({
                        resetToken: data.resetToken,
                        email: data.email,
                        expiresAt: Date.now() + (data.expiresIn || 900) * 1000,
                    })
                );
            }

            toast(
                data?.message || 'اگر ایمیل در سیستم موجود باشد، کد ارسال می‌شود',
                'success'
            );

            // ری‌دایرکت به صفحه reset-password
            setTimeout(() => {
                location.href = '/auth/reset-password';
            }, 800);
        } catch (err) {
            if (err.field) {
                const el = form.querySelector(`[name="${err.field}"]`);
                if (el) FormKit.showFieldError(el, err.message);
            } else if (err.details) {
                for (const [field, messages] of Object.entries(err.details)) {
                    const el = form.querySelector(`[name="${field}"]`);
                    if (el && Array.isArray(messages) && messages[0]) {
                        FormKit.showFieldError(el, messages[0]);
                    }
                }
            }
            toast(err.message || 'خطا در ارسال', 'error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = original;
        }
    });

    /* ---------------- Init ---------------- */
    setTimeout(() => emailInput.focus(), 200);
});

/**
 * Copyright (c) 2026 Sobhan Rasoulzadeh Asl (Sobhan-SRZA / Mr. Sinre)
 *
 * Licensed under the BSD 3-Clause License.
 * See the LICENSE file in the project root for license information.
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */