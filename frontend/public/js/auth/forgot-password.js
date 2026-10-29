/* ============================================================
   Forgot Password Page
   ============================================================
   Handles the password recovery request: validates the
   submitted email address, dispatches the recovery request to
   the API, persists any returned reset token in session storage,
   and redirects the user to the reset-password page.
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
    const $ = (selector) => document.querySelector(selector);
    const form = $('#forgotForm');

    if (!form) return;

    const emailInput = $('#email');
    const submitBtn = $('#submitBtn');

    /* ---------------- API Helper ----------------
       POST a JSON payload and normalise failures into Error
       objects that preserve the server payload and status.
       ---------------- */
    async function api(path, body) {
        const res = await fetch(path, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });

        let data = null;
        try {
            data = await res.json();
        } catch { /* Ignore JSON parse failures. */ }

        if (!res.ok) {
            const err = new Error(data?.message || 'Error');
            Object.assign(err, data || {}, { status: res.status });
            throw err;
        }

        return data;
    }

    /* ---------------- Submit Handler ----------------
       Validate the email, submit the recovery request, persist
       the reset token when returned, and redirect to the
       reset-password page on success.
       ---------------- */
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const email = emailInput.value.trim().toLowerCase();

        FormKit.clearAllErrors(form);

        if (!email) {
            return FormKit.showFieldError(emailInput, 'Email is required.');
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
            return FormKit.showFieldError(emailInput, 'Invalid email address.');
        }

        submitBtn.disabled = true;
        const original = submitBtn.textContent;
        submitBtn.textContent = 'Sending…';

        try {
            const data = await api('/api/auth/forgot-password', { email });

            // Persist the reset state so the reset-password page can
            // resume the flow without another round trip.
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
                data?.message || 'If the email exists in our system, a code will be sent.',
                'success'
            );

            // Redirect to the reset-password page.
            setTimeout(() => {
                location.href = '/auth/reset-password';
            }, 800);
        } catch (err) {
            // Render field-level errors when the server identifies a
            // specific field; otherwise surface a general toast.
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

            toast(err.message || 'Failed to send the recovery request.', 'error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = original;
        }
    });

    /* ---------------- Initialization ----------------
       Focus the email field once the page has settled.
       ---------------- */
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