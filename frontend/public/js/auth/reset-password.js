/* ============================================================
   Reset Password Page
   ============================================================
   Handles the password reset flow: restores the reset context
   from session storage, validates the OTP and new password,
   submits the reset request, and manages the resend cooldown.
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
    const $ = (selector) => document.querySelector(selector);
    const $$ = (selector) => Array.from(document.querySelectorAll(selector));

    const form = $('#resetForm');
    const emailDisplay = $('#emailDisplay');
    const codeInput = $('#code');
    const newPasswordInput = $('#newPassword');
    const confirmInput = $('#confirmPassword');
    const submitBtn = $('#submitBtn');
    const resendBtn = $('#resendBtn');

    /* ============================================================
       State
       ============================================================
       The reset context (token + email + expiry) is restored from
       session storage. `resendCooldown` tracks the remaining seconds
       before another code may be requested.
       ============================================================ */
    const STORAGE_KEY = 'password_reset_state';
    let state = null;
    let resendCooldown = 0;
    let resendTimer = null;

    /* ============================================================
       State Persistence
       ============================================================ */

    /**
     * Restore the reset state from session storage. Returns `null`
     * when the stored state is missing, malformed, or expired.
     */
    function loadState() {
        try {
            const raw = sessionStorage.getItem(STORAGE_KEY);
            if (!raw) return null;

            const parsed = JSON.parse(raw);
            if (!parsed?.resetToken || !parsed?.email) return null;

            // Discard the stored state if it has already expired.
            if (parsed.expiresAt && parsed.expiresAt < Date.now()) {
                sessionStorage.removeItem(STORAGE_KEY);
                return null;
            }

            return parsed;
        } catch {
            return null;
        }
    }

    /* Remove the reset state from session storage. */
    function clearState() {
        try {
            sessionStorage.removeItem(STORAGE_KEY);
        } catch { /* Ignore storage errors — state is discarded regardless. */ }
    }

    /**
     * Abort the reset flow, clear the stored state, and redirect the
     * user back to the forgot-password page.
     */
    function redirectBack() {
        clearState();

        if (typeof openDialogError === 'function') {
            openDialogError(
                'Link expired',
                'Please start again from the forgot-password page.'
            );
        }

        setTimeout(() => {
            location.href = '/auth/forgot-password';
        }, 2500);
    }

    /* ============================================================
       API Helper
       ============================================================
       POST a JSON payload and normalise failures into Error
       objects that preserve the server payload and status.
       ============================================================ */
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

    /* ============================================================
       Password Strength Evaluation
       ============================================================
       Applies the strength checklist, updates the indicator bars
       and label, and returns `true` only when every rule passes.
       ============================================================ */
    function evaluatePassword(pw) {
        const rules = {
            length: pw.length >= 8,
            lower: /[a-z]/.test(pw),
            upper: /[A-Z]/.test(pw),
            digit: /\d/.test(pw),
        };

        Object.entries(rules).forEach(([name, ok]) => {
            const li = $(`.pw-rules li[data-rule="${name}"]`);
            if (li) li.classList.toggle('ok', ok);
        });

        const score = Object.values(rules).filter(Boolean).length;
        const strength = newPasswordInput.closest('.field').querySelector('.pw-strength');
        const label = $('#pwStrengthLabel');

        strength.classList.remove('weak', 'fair', 'good', 'strong');

        if (!pw) {
            label.textContent = '';
        } else if (score <= 1) {
            strength.classList.add('weak');
            label.textContent = 'Weak';
        } else if (score === 2) {
            strength.classList.add('fair');
            label.textContent = 'Fair';
        } else if (score === 3) {
            strength.classList.add('good');
            label.textContent = 'Good';
        } else {
            strength.classList.add('strong');
            label.textContent = 'Strong';
        }

        return score === 4;
    }

    /* Show or clear the inline mismatch message between the new
       password and its confirmation. */
    function checkMatch() {
        const errEl = $('#matchError');

        if (!confirmInput.value) {
            errEl.textContent = '';
            errEl.classList.remove('visible');

            return;
        }

        if (newPasswordInput.value !== confirmInput.value) {
            errEl.textContent = 'The password and its confirmation do not match.';
            errEl.classList.add('visible');
        } else {
            errEl.textContent = '';
            errEl.classList.remove('visible');
        }
    }

    newPasswordInput.addEventListener('input', () => {
        evaluatePassword(newPasswordInput.value);
        checkMatch();
    });

    confirmInput.addEventListener('input', checkMatch);

    /* ============================================================
       Password Visibility Toggle
       ============================================================
       Switches the referenced input between `password` and `text`,
       and updates the toggle's ARIA state.
       ============================================================ */
    $$('.toggle-pass').forEach((btn) => {
        btn.addEventListener('click', () => {
            const input = document.getElementById(btn.dataset.target);
            if (!input) return;

            const isPwd = input.type === 'password';
            input.type = isPwd ? 'text' : 'password';

            btn.classList.toggle('active', isPwd);
            btn.setAttribute('aria-label', isPwd ? 'Hide password' : 'Show password');
        });
    });

    /* ============================================================
       OTP Input
       ============================================================
       Restricts the verification code field to digits and caps it
       at six characters.
       ============================================================ */
    codeInput.addEventListener('input', (e) => {
        e.target.value = e.target.value.replace(/\D/g, '').slice(0, 6);
    });

    /* ============================================================
       Submit Handler
       ============================================================
       Validates the OTP and new password, then submits the reset
       request. On success, clears the stored state and redirects
       to the login page.
       ============================================================ */
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        if (!state?.resetToken) {
            return redirectBack();
        }

        const code = codeInput.value.trim();
        const newPassword = newPasswordInput.value;
        const confirmPassword = confirmInput.value;

        FormKit.clearAllErrors(form);

        const errors = {};

        if (!/^\d{6}$/.test(code)) {
            errors.code = 'The code must be exactly 6 digits.';
        }

        if (!newPassword || newPassword.length < 8) {
            errors.newPassword = 'The new password must be at least 8 characters long.';
        } else if (!evaluatePassword(newPassword)) {
            errors.newPassword = 'The password must include a lowercase letter, an uppercase letter, and a digit.';
        }

        if (newPassword !== confirmPassword) {
            errors.confirmPassword = 'The password and its confirmation do not match.';
        }

        if (Object.keys(errors).length) {
            for (const [field, msg] of Object.entries(errors)) {
                const input = form.querySelector(`[name="${field}"]`);
                if (input) FormKit.showFieldError(input, msg);
            }

            return;
        }

        submitBtn.disabled = true;
        const original = submitBtn.textContent;
        submitBtn.textContent = 'Changing…';

        try {
            const data = await api('/api/auth/reset-password', {
                resetToken: state.resetToken,
                code,
                newPassword,
                confirmPassword,
            });

            clearState();

            toast('Your password has been changed successfully.', 'success');

            // Present a success dialog before redirecting to sign-in.
            if (typeof openDialogError === 'function') {
                openDialogError(
                    'Success',
                    data.message || 'You can now sign in with your new password.'
                );
            }

            setTimeout(() => {
                location.href = '/auth/login';
            }, 2000);
        } catch (err) {
            // An expired or invalid token requires restarting the flow.
            if (err.status === 401) {
                return redirectBack();
            }

            if (err.field) {
                const input = form.querySelector(`[name="${err.field}"]`);
                if (input) FormKit.showFieldError(input, err.message);
            } else if (err.details) {
                for (const [field, messages] of Object.entries(err.details)) {
                    const input = form.querySelector(`[name="${field}"]`);
                    if (input && Array.isArray(messages) && messages[0]) {
                        FormKit.showFieldError(input, messages[0]);
                    }
                }
            } else {
                FormKit.showFieldError(codeInput, err.message);
            }

            toast(err.message || 'Failed to change the password.', 'error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = original;
        }
    });

    /* ============================================================
       Resend Code
       ============================================================
       Requests a fresh verification code, then starts a cooldown
       to prevent repeated requests.
       ============================================================ */
    resendBtn.addEventListener('click', async () => {
        if (resendCooldown > 0 || !state?.resetToken) return;

        resendBtn.disabled = true;
        const original = resendBtn.textContent;
        resendBtn.textContent = 'Sending…';

        try {
            const data = await api('/api/auth/resend-password-reset', {
                resetToken: state.resetToken,
            });

            toast(data.message || 'A new code has been sent.', 'success');
            startResendCooldown(60);
            codeInput.focus();
        } catch (err) {
            if (err.status === 401) {
                return redirectBack();
            }

            toast(err.message || 'Failed to send the code.', 'error');
        } finally {
            resendBtn.disabled = false;
            resendBtn.textContent = original;
        }
    });

    /**
     * Begin a countdown that disables the resend button and shows
     * the remaining seconds until another request is permitted.
     */
    function startResendCooldown(seconds) {
        resendCooldown = seconds;

        const timer = $('#resendTimer');
        const countdownEl = $('#resendCountdown');

        resendBtn.disabled = true;
        timer.style.display = '';

        clearInterval(resendTimer);

        const tick = () => {
            countdownEl.textContent = resendCooldown;

            if (resendCooldown <= 0) {
                clearInterval(resendTimer);
                timer.style.display = 'none';
                resendBtn.disabled = false;

                return;
            }

            resendCooldown--;
        };

        tick();
        resendTimer = setInterval(tick, 1000);
    }

    /* ============================================================
       Initialization
       ============================================================
       Restore the reset state. Redirect away when it is missing
       or expired; otherwise populate the UI and start the cooldown.
       ============================================================ */
    (function init() {
        state = loadState();

        if (!state) {
            redirectBack();

            return;
        }

        emailDisplay.textContent = state.email;

        startResendCooldown(60);
        setTimeout(() => codeInput.focus(), 200);
    })();
});

/**
 * Copyright (c) 2026 Sobhan Rasoulzadeh Asl (Sobhan-SRZA / Mr. Sinre)
 *
 * Licensed under the BSD 3-Clause License.
 * See the LICENSE file in the project root for license information.
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */