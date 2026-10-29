/* ============================================================
   Verify Email Page
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
    const $ = (s) => document.querySelector(s);
    const form = $('#verifyForm');

    if (!form) return;

    const emailDisplay = $('#emailDisplay');
    const codeInput = $('#otpCode');
    const submitBtn = $('#submitBtn');
    const resendBtn = $('#resendBtn');

    /* ============================================================
       State
       ============================================================ */
    const STORAGE_KEY = 'email_verify_state';
    let state = null;
    let resendCooldown = 0;
    let resendTimer = null;

    /* ============================================================
       Storage helpers
       ============================================================ */
    function loadState() {
        try {
            const raw = sessionStorage.getItem(STORAGE_KEY);
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            if (!parsed?.verifyToken || !parsed?.email) return null;

            if (parsed.expiresAt && parsed.expiresAt < Date.now()) {
                sessionStorage.removeItem(STORAGE_KEY);
                return null;
            }
            return parsed;
        } catch {
            return null;
        }
    }

    function saveState(s) {
        try {
            sessionStorage.setItem(STORAGE_KEY, JSON.stringify(s));
        } catch { }
    }

    function clearState() {
        try {
            sessionStorage.removeItem(STORAGE_KEY);
        } catch { }
    }

    /* ============================================================
       Dialog helpers
       ============================================================ */
    function showDialogAndRedirect(title, message, url, delay = 2500) {
        if (typeof openDialogError === 'function') {
            openDialogError(title, message);
        }
        setTimeout(() => {
            location.href = url;
        }, delay);
    }

    function redirectBack() {
        clearState();
        showDialogAndRedirect(
            'لینک منقضی شده',
            'برای ادامه، لطفاً دوباره وارد حساب خود شوید',
            '/auth/login'
        );
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
       OTP input — only digits, max 6
       ============================================================ */
    codeInput.addEventListener('input', (e) => {
        e.target.value = e.target.value.replace(/\D/g, '').slice(0, 6);
    });

    /* ============================================================
       Submit
       ============================================================ */
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        if (!state?.verifyToken) {
            return redirectBack();
        }

        const code = codeInput.value.trim();

        FormKit.clearAllErrors(form);

        if (!/^\d{6}$/.test(code)) {
            return FormKit.showFieldError(codeInput, 'کد باید ۶ رقم باشد');
        }

        submitBtn.disabled = true;
        const original = submitBtn.textContent;
        submitBtn.textContent = 'در حال تایید…';

        try {
            const data = await api('/api/auth/verify-email', {
                verifyToken: state.verifyToken,
                code,
            });

            clearState();

            toast(data?.message || 'ایمیل با موفقیت تایید شد', 'success');

            if (typeof openDialogError === 'function') {
                openDialogError(
                    'موفق',
                    data?.message || 'حساب شما فعال شد. در حال انتقال…'
                );
            }

            setTimeout(() => {
                location.href = '/dashboard';
            }, 2000);
        } catch (err) {
            if (err.status === 401) {
                return redirectBack();
            }

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
            } else {
                FormKit.showFieldError(codeInput, err.message);
            }
            toast(err.message || 'خطا در تایید ایمیل', 'error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = original;
        }
    });

    /* ============================================================
       Resend
       ============================================================ */
    resendBtn.addEventListener('click', async () => {
        if (resendCooldown > 0 || !state?.verifyToken) return;

        resendBtn.disabled = true;
        const original = resendBtn.textContent;
        resendBtn.textContent = 'در حال ارسال…';

        try {
            const data = await api('/api/auth/resend-verification', {
                verifyToken: state.verifyToken,
            });

            // اگر سرور توکن جدید داد، state را آپدیت کن
            if (data?.verifyToken) {
                state.verifyToken = data.verifyToken;
                if (data.expiresIn) {
                    state.expiresAt = Date.now() + data.expiresIn * 1000;
                }
                saveState(state);
            }

            toast(data?.message || 'کد جدید ارسال شد', 'success');
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

    /* ============================================================
       Resend cooldown
       ============================================================ */
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
    (async function init() {
        state = loadState();

        if (!state) {
            // اگه state تو sessionStorage نیست، از سرور تلاش کن
            try {
                const res = await fetch('/api/auth/me', { credentials: 'include' });
                if (res.ok) {
                    const data = await res.json();

                    if (data?.user && !data.user.emailVerified) {
                        // کاربر لاگینه ولی ایمیل تایید نشده — کد جدید بگیر
                        const rr = await fetch('/api/auth/resend-verification-for-me', {
                            method: 'POST',
                            credentials: 'include',
                        });

                        if (rr.ok) {
                            const rd = await rr.json();
                            state = {
                                verifyToken: rd.verifyToken,
                                email: rd.email,
                                expiresAt: rd.expiresIn
                                    ? Date.now() + rd.expiresIn * 1000
                                    : undefined,
                            };
                            saveState(state);
                        }
                    } else if (data?.user?.emailVerified) {
                        // ایمیل تایید شده — برو داشبورد
                        location.href = '/dashboard';
                        return;
                    }
                }
            } catch { }
        }

        if (!state) {
            // هیچ راهی نیست — کاربر باید لاگین کنه
            showDialogAndRedirect(
                'نیاز به ورود',
                'برای ادامه، لطفاً وارد حساب خود شوید',
                '/auth/login'
            );
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