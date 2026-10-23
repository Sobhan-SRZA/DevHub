/* ============================================================
   Reset Password Page
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
    const $ = (s) => document.querySelector(s);
    const $$ = (s) => Array.from(document.querySelectorAll(s));

    const form = $('#resetForm');
    const emailDisplay = $('#emailDisplay');
    const codeInput = $('#code');
    const newPasswordInput = $('#newPassword');
    const confirmInput = $('#confirmPassword');
    const submitBtn = $('#submitBtn');
    const resendBtn = $('#resendBtn');

    /* ============================================================
       State
       ============================================================ */
    const STORAGE_KEY = 'password_reset_state';
    let state = null;
    let resendCooldown = 0;
    let resendTimer = null;

    /* ============================================================
       Load / save / clear state
       ============================================================ */
    function loadState() {
        try {
            const raw = sessionStorage.getItem(STORAGE_KEY);
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            if (!parsed?.resetToken || !parsed?.email) return null;

            // چک انقضا
            if (parsed.expiresAt && parsed.expiresAt < Date.now()) {
                sessionStorage.removeItem(STORAGE_KEY);
                return null;
            }
            return parsed;
        } catch {
            return null;
        }
    }

    function clearState() {
        try {
            sessionStorage.removeItem(STORAGE_KEY);
        } catch { }
    }

    function redirectBack() {
        clearState();
        if (typeof openDialogError === 'function') {
            openDialogError(
                'لینک منقضی شده',
                'لطفاً دوباره از صفحه فراموشی رمز شروع کنید'
            );
        }
        setTimeout(() => {
            location.href = '/auth/forgot-password';
        }, 2500);
    }

    /* ============================================================
       API
       ============================================================ */
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

    /* ============================================================
       Password strength (same as settings)
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
            label.textContent = 'ضعیف';
        } else if (score === 2) {
            strength.classList.add('fair');
            label.textContent = 'متوسط';
        } else if (score === 3) {
            strength.classList.add('good');
            label.textContent = 'خوب';
        } else {
            strength.classList.add('strong');
            label.textContent = 'قوی';
        }

        return score === 4;
    }

    function checkMatch() {
        const errEl = $('#matchError');
        if (!confirmInput.value) {
            errEl.textContent = '';
            errEl.classList.remove('visible');
            return;
        }
        if (newPasswordInput.value !== confirmInput.value) {
            errEl.textContent = 'رمز و تکرار آن یکسان نیستند';
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
       Password visibility toggle
       ============================================================ */
    $$('.toggle-pass').forEach((btn) => {
        btn.addEventListener('click', () => {
            const input = document.getElementById(btn.dataset.target);
            if (!input) return;
            const isPwd = input.type === 'password';
            input.type = isPwd ? 'text' : 'password';
            btn.classList.toggle('active', isPwd);
            btn.setAttribute('aria-label', isPwd ? 'پنهان کردن رمز' : 'نمایش رمز');
        });
    });

    /* ============================================================
       OTP input — auto-submit on 6 digits
       ============================================================ */
    codeInput.addEventListener('input', (e) => {
        e.target.value = e.target.value.replace(/\D/g, '').slice(0, 6);
    });

    /* ============================================================
       Submit
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
            errors.code = 'کد باید ۶ رقم باشد';
        }
        if (!newPassword || newPassword.length < 8) {
            errors.newPassword = 'رمز جدید باید حداقل ۸ کاراکتر باشد';
        } else if (!evaluatePassword(newPassword)) {
            errors.newPassword = 'رمز باید شامل حرف کوچک، حرف بزرگ و عدد باشد';
        }
        if (newPassword !== confirmPassword) {
            errors.confirmPassword = 'رمز و تکرار آن یکسان نیستند';
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
        submitBtn.textContent = 'در حال تغییر…';

        try {
            const data = await api('/api/auth/reset-password', {
                resetToken: state.resetToken,
                code,
                newPassword,
                confirmPassword,
            });

            clearState();

            toast('رمز عبور با موفقیت تغییر کرد', 'success');

            // دیالوگ موفقیت + redirect به login
            if (typeof openDialogError === 'function') {
                openDialogError(
                    'موفق',
                    data.message || 'اکنون می‌توانید با رمز جدید وارد شوید'
                );
            }

            setTimeout(() => {
                location.href = '/auth/login';
            }, 2000);
        } catch (err) {
            if (err.status === 401) {
                // توکن منقضی — دوباره شروع کن
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
            toast(err.message || 'خطا در تغییر رمز', 'error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = original;
        }
    });

    /* ============================================================
       Resend
       ============================================================ */
    resendBtn.addEventListener('click', async () => {
        if (resendCooldown > 0 || !state?.resetToken) return;

        resendBtn.disabled = true;
        const original = resendBtn.textContent;
        resendBtn.textContent = 'در حال ارسال…';

        try {
            const data = await api('/api/auth/resend-password-reset', {
                resetToken: state.resetToken,
            });

            toast(data.message || 'کد جدید ارسال شد', 'success');
            startResendCooldown(60);
            codeInput.focus();
        } catch (err) {
            if (err.status === 401) {
                return redirectBack();
            }
            toast(err.message || 'خطا در ارسال', 'error');
        } finally {
            resendBtn.disabled = false;
            resendBtn.textContent = original;
        }
    });

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
       Init
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