/* ============================================================
   Settings Page
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
    const $ = (s, r = document) => r.querySelector(s);
    const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

    /* ============================================================
       State
       ============================================================ */
    const state = {
        user: null,
        pendingEmail: null,
        pendingEmailTimer: null,
        bioEditor: null,
        newPasswordPlain: null,
    };

    /* ============================================================
       API
       ============================================================ */
    async function api(path, opts = {}) {
        const res = await fetch(path, {
            credentials: 'include',
            headers: opts.body instanceof FormData ? {} : { 'Content-Type': 'application/json' },
            ...opts,
        });

        let data = null;
        const ct = res.headers.get('content-type') || '';
        if (ct.includes('application/json')) {
            try {
                data = await res.json();
            }

            catch { }
        }

        if (!res.ok) {
            const err = new Error(data?.message || 'خطا');
            Object.assign(err, data || {}, { status: res.status });

            throw err;
        }

        return data;
    }

    /* ============================================================
       Tabs
       ============================================================ */
    $$('.st-tab').forEach((tab) => {
        tab.addEventListener('click', () => {
            $$('.st-tab').forEach((t) => t.classList.toggle('active', t === tab));
            $$('.st-panel').forEach((p) => {
                p.classList.toggle('active', p.dataset.panel === tab.dataset.tab);
            });
            // اگه به تب password رفت، reset کن
            if (tab.dataset.tab === 'password') {
                resetPasswordFlow();
            }
        });
    });

    /* ============================================================
       Load user
       ============================================================ */
    async function loadUser() {
        try {
            const data = await api('/api/profile/me');
            state.user = data.user;
            renderUser();
            initBioEditor();
        } catch (err) {
            if (err.status === 401) {
                location.href = '/auth/login';
            } else {
                toast(err.message || 'خطا در بارگذاری', 'error');
            }
        }
    }

    function renderUser() {
        const u = state.user;
        if (!u) return;

        /* ---------- Name / username ---------- */
        $('#stName').value = u.name || '';
        $('#stUsername').value = u.username || '';

        /* ---------- Avatar ---------- */
        // Avatar
        const preview = $('#avatarPreview');
        if (u.avatar?.url) {
            preview.style.backgroundImage = `url('${u.avatar.url}')`;
            preview.style.backgroundSize = 'cover';
            preview.style.backgroundPosition = 'center';
            preview.textContent = '';   // ← این خط مهمه
        } else {
            preview.style.backgroundImage = '';
            preview.style.background = 'linear-gradient(135deg, #007bff, #6ebbff)';
            preview.textContent = (u.name || '?').charAt(0).toUpperCase();
        }

        /* ---------- Email ---------- */
        $('#currentEmail').textContent = u.email || '—';
        const badge = $('#emailVerifiedBadge');
        if (u.emailVerified) {
            badge.className = 'email-current__badge';
            badge.innerHTML = `
                <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                تایید شده
            `;
        } else {
            badge.className = 'email-current__badge email-current__badge--unverified';
            badge.innerHTML = `تایید نشده`;
        }

        /* ---------- Pending email ---------- */
        if (u.pendingEmail && u.pendingEmail.newEmail) {
            state.pendingEmail = u.pendingEmail;
            showPendingEmailState(u.pendingEmail.newEmail);
        } else {
            hidePendingEmailState();
        }
    }

    /* ============================================================
       Avatar upload
       ============================================================ */
    $('#avatarInput').addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
        if (!allowed.includes(file.type)) {
            toast('فرمت مجاز: JPG, PNG, WebP, GIF', 'error');
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            toast('حجم فایل حداکثر 5MB', 'error');
            return;
        }

        const fd = new FormData();
        fd.append('avatar', file);

        try {
            const data = await api('/api/profile/avatar', { method: 'POST', body: fd });
            state.user.avatar = data.avatar;
            renderUser();
            toast('عکس پروفایل به‌روزرسانی شد', 'success');
        } catch (err) {
            toast(err.message || 'خطا در آپلود', 'error');
        } finally {
            e.target.value = '';
        }
    });

    $('#avatarRemove').addEventListener('click', async () => {
        const ok = await confirmDialog({
            title: 'حذف عکس پروفایل',
            message: 'عکس پروفایل شما حذف شود؟',
            confirmText: 'حذف کن',
            danger: true,
        });
        if (!ok) return;

        try {
            await api('/api/profile/avatar', { method: 'DELETE' });
            state.user.avatar = null;
            renderUser();
            toast('عکس حذف شد', 'success');
        } catch (err) {
            toast(err.message || 'خطا', 'error');
        }
    });

    /* ============================================================
       Profile (name, username)
       ============================================================ */
    $('#profileForm').addEventListener('submit', async (e) => {
        e.preventDefault();

        const name = $('#stName').value.trim();
        const username = $('#stUsername').value.trim();

        const errors = {};
        if (!name || name.length < 2) errors.name = 'نام باید حداقل ۲ کاراکتر باشد';
        if (!username || username.length < 3) errors.username = 'نام کاربری باید حداقل ۳ کاراکتر باشد';
        else if (!/^[a-zA-Z0-9_.-]{3,20}$/.test(username)) errors.username = 'فرمت نام کاربری نامعتبر';

        if (Object.keys(errors).length) {
            FormKit.clearAllErrors($('#profileForm'));
            if (errors.name) FormKit.showFieldError($('#stName'), errors.name);
            if (errors.username) FormKit.showFieldError($('#stUsername'), errors.username);
            return;
        }

        const btn = $('#saveProfileBtn');
        btn.disabled = true;
        const original = btn.textContent;
        btn.textContent = 'در حال ذخیره…';

        try {
            // name
            if (name !== state.user.name) {
                await api('/api/profile/me', {
                    method: 'PATCH',
                    body: JSON.stringify({ name }),
                });
                state.user.name = name;
            }

            // username (اگه عوض شده)
            if (username !== state.user.username) {
                await api('/api/profile/username', {
                    method: 'PATCH',
                    body: JSON.stringify({ username }),
                });
                state.user.username = username;
            }

            toast('اطلاعات به‌روزرسانی شد', 'success');
            renderUser();
        } catch (err) {
            if (err.field) {
                const el = $(`[name="${err.field}"]`);
                if (el) FormKit.showFieldError(el, err.message);
            }
            toast(err.message || 'خطا', 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = original;
        }
    });

    /* ============================================================
       Bio editor (Markdown)
       ============================================================ */
    function initBioEditor() {
        if (!window.MarkdownEditor) return;

        state.bioEditor = new MarkdownEditor('#bioEditorRoot', {
            name: 'bio',
            value: state.user.bio || '',
            placeholder: 'درباره خودت بنویس… (Markdown پشتیبانی می‌شود)',
            maxLength: 2000,
            minHeight: 220,
        });
    }

    $('#saveBioBtn').addEventListener('click', async () => {
        const bio = state.bioEditor.getValue();

        const btn = $('#saveBioBtn');
        btn.disabled = true;
        const original = btn.textContent;
        btn.textContent = 'در حال ذخیره…';

        try {
            await api('/api/profile/me', {
                method: 'PATCH',
                body: JSON.stringify({ bio }),
            });
            state.user.bio = bio;
            toast('توضیحات ذخیره شد', 'success');
        } catch (err) {
            toast(err.message || 'خطا', 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = original;
        }
    });

    /* ============================================================
       Email change — Step 1: Request
       ============================================================ */
    $('#changeEmailForm').addEventListener('submit', async (e) => {
        e.preventDefault();

        const newEmail = $('#newEmail').value.trim();
        const password = $('#confirmPasswordForEmail').value;

        FormKit.clearAllErrors($('#changeEmailForm'));

        if (!newEmail) {
            return FormKit.showFieldError($('#newEmail'), 'ایمیل جدید الزامی است');
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(newEmail)) {
            return FormKit.showFieldError($('#newEmail'), 'ایمیل نامعتبر است');
        }

        if (!password) {
            return FormKit.showFieldError($('#confirmPasswordForEmail'), 'رمز عبور الزامی است');
        }

        const btn = $('#requestEmailBtn');
        btn.disabled = true;
        const original = btn.textContent;
        btn.textContent = 'در حال ارسال…';

        try {
            console.log('🟦 [requestEmailChange] sending:', { newEmail });

            const data = await api('/api/profile/email/request', {
                method: 'POST',
                body: JSON.stringify({ newEmail, password }),
            });

            console.log('🟩 [requestEmailChange] response:', data);

            if (!data?.pendingEmail) {
                console.error('❌ response missing pendingEmail:', data);
                toast('خطا در پردازش پاسخ سرور', 'error');
                return;
            }

            state.pendingEmail = { newEmail: data.pendingEmail };
            showPendingEmailState(data.pendingEmail);

            toast(`کد تایید به ${data.pendingEmail} ارسال شد`, 'success');

            // Reset form
            $('#newEmail').value = '';
            $('#confirmPasswordForEmail').value = '';

            // Focus OTP
            setTimeout(() => $('#emailCode').focus(), 300);
        }

        catch (err) {
            console.error('❌ [requestEmailChange] failed:', err);
            console.error('   status :', err.status);
            console.error('   message:', err.message);
            console.error('   details:', err.details);

            if (err.details) {
                for (const [field, messages] of Object.entries(err.details)) {
                    const input = document.querySelector(`[name="${field}"]`);
                    if (input && Array.isArray(messages) && messages.length) {
                        FormKit.showFieldError(input, messages[0]);
                    }
                }
            }
            
            else if (err.field) {
                const input = document.querySelector(`[name="${err.field}"]`);
                if (input) 
                    FormKit.showFieldError(input, err.message);
            }

            toast(err.message || 'خطا در ارسال کد', 'error');
        }

        finally {
            btn.disabled = false;
            btn.textContent = original;
        }
    });

    function showPendingEmailState(newEmail) {
        $('#pendingEmailValue').textContent = newEmail;
        $('#pendingEmailCard').style.display = '';
        $('#changeEmailCard').style.display = 'none';

        // countdown 10 minutes
        const expiresAt = Date.now() + 10 * 60 * 1000;
        clearInterval(state.pendingEmailTimer);
        state.pendingEmailTimer = setInterval(() => {
            const remaining = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
            const min = String(Math.floor(remaining / 60)).padStart(2, '0');
            const sec = String(remaining % 60).padStart(2, '0');
            $('#pendingEmailTimer').textContent = `${min}:${sec}`;
            if (remaining === 0) {
                clearInterval(state.pendingEmailTimer);
                toast('کد منقضی شد، دوباره درخواست کنید', 'warn');
            }
        }, 1000);
    }

    function hidePendingEmailState() {
        $('#pendingEmailCard').style.display = 'none';
        $('#changeEmailCard').style.display = '';
        clearInterval(state.pendingEmailTimer);
    }

    /* ============================================================
       Email change — Step 2: Verify
       ============================================================ */
    $('#verifyEmailForm').addEventListener('submit', async (e) => {
        e.preventDefault();

        const code = $('#emailCode').value.trim();
        if (!/^\d{6}$/.test(code)) {
            return FormKit.showFieldError($('#emailCode'), 'کد باید ۶ رقم باشد');
        }

        FormKit.clearAllErrors($('#verifyEmailForm'));

        const btn = $('#verifyEmailBtn');
        btn.disabled = true;
        const original = btn.textContent;
        btn.textContent = 'در حال تایید…';

        try {
            const data = await api('/api/profile/email/verify', {
                method: 'POST',
                body: JSON.stringify({ code }),
            });

            state.user.email = data.user.email;
            state.user.emailVerified = true;
            state.user.pendingEmail = null;
            hidePendingEmailState();
            renderUser();
            toast('ایمیل با موفقیت تغییر کرد', 'success');
        } catch (err) {
            FormKit.showFieldError($('#emailCode'), err.message);
        } finally {
            btn.disabled = false;
            btn.textContent = original;
        }
    });

    $('#cancelEmailChange').addEventListener('click', async () => {
        const ok = await confirmDialog({
            title: 'لغو تغییر ایمیل',
            message: 'درخواست تغییر ایمیل لغو شود؟',
            confirmText: 'بله',
            danger: true,
        });
        if (!ok) return;

        try {
            await api('/api/profile/email/pending', { method: 'DELETE' });
            state.user.pendingEmail = null;
            state.pendingEmail = null;
            hidePendingEmailState();
            toast('درخواست لغو شد', 'success');
        } catch (err) {
            toast(err.message || 'خطا', 'error');
        }
    });

    /* ============================================================
       Password change — Step 1: Request
       ============================================================ */
    const newPasswordInput = $('#newPassword');
    const confirmNewPasswordInput = $('#confirmNewPassword');

    function evaluatePassword(pw) {
        const rules = {
            length: pw.length >= 8,
            lower: /[a-z]/.test(pw),
            upper: /[A-Z]/.test(pw),
            digit: /\d/.test(pw),
        };

        // آپدیت UI
        Object.entries(rules).forEach(([name, ok]) => {
            const li = $(`.pw-rules li[data-rule="${name}"]`);
            if (li) li.classList.toggle('ok', ok);
        });

        const score = Object.values(rules).filter(Boolean).length;
        const strength = $('#newPassword').closest('.field').querySelector('.pw-strength');
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

    newPasswordInput.addEventListener('input', () => {
        evaluatePassword(newPasswordInput.value);
        checkPasswordMatch();
    });

    confirmNewPasswordInput.addEventListener('input', checkPasswordMatch);

    function checkPasswordMatch() {
        const errEl = $('#matchError');
        if (!confirmNewPasswordInput.value) {
            errEl.textContent = '';
            return;
        }
        if (newPasswordInput.value !== confirmNewPasswordInput.value) {
            errEl.textContent = 'رمز و تکرار آن یکسان نیستند';
            errEl.classList.add('visible');
            confirmNewPasswordInput.closest('.field').classList.add('has-error');
        } else {
            errEl.textContent = '';
            errEl.classList.remove('visible');
            confirmNewPasswordInput.closest('.field').classList.remove('has-error');
        }
    }

    $('#passwordRequestForm').addEventListener('submit', async (e) => {
        e.preventDefault();

        const currentPassword = $('#currentPassword').value;
        const newPassword = newPasswordInput.value;
        const confirmPassword = confirmNewPasswordInput.value;

        const errors = {};
        if (!currentPassword) errors.currentPassword = 'رمز فعلی الزامی است';
        if (!newPassword || newPassword.length < 8) errors.newPassword = 'رمز جدید باید حداقل ۸ کاراکتر باشد';
        else if (!evaluatePassword(newPassword)) errors.newPassword = 'رمز جدید به قوانین بالا عمل نمی‌کند';
        if (newPassword !== confirmPassword) errors.confirmPassword = 'تکرار رمز یکسان نیست';
        if (currentPassword && newPassword && currentPassword === newPassword) {
            errors.newPassword = 'رمز جدید نباید با رمز فعلی یکسان باشد';
        }

        if (Object.keys(errors).length) {
            FormKit.clearAllErrors($('#passwordRequestForm'));
            if (errors.currentPassword) FormKit.showFieldError($('#currentPassword'), errors.currentPassword);
            if (errors.newPassword) FormKit.showFieldError(newPasswordInput, errors.newPassword);
            if (errors.confirmPassword) FormKit.showFieldError(confirmNewPasswordInput, errors.confirmPassword);
            return;
        }

        FormKit.clearAllErrors($('#passwordRequestForm'));

        const btn = $('#requestPwBtn');
        btn.disabled = true;
        const original = btn.textContent;
        btn.textContent = 'در حال ارسال…';

        try {
            const data = await api('/api/profile/password/request', {
                method: 'POST',
                body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
            });

            // ذخیره رمز جدید برای مرحله بعد
            state.newPasswordPlain = { newPassword, confirmPassword };

            // نمایش کارت تایید
            $('#passwordRequestForm').closest('.st-card').style.display = 'none';
            $('#confirmPasswordCard').style.display = '';
            $('#pwEmailHint').textContent = `کد ۶ رقمی به ${data.email} ارسال شد`;

            // Set hidden inputs
            $('#passwordConfirmForm [name="newPassword"]').value = newPassword;
            $('#passwordConfirmForm [name="confirmPassword"]').value = confirmPassword;

            setTimeout(() => $('#passwordCode').focus(), 300);
        } catch (err) {
            if (err.field) {
                const el = $(`[name="${err.field}"]`);
                if (el) FormKit.showFieldError(el, err.message);
            }
            toast(err.message || 'خطا', 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = original;
        }
    });

    function resetPasswordFlow() {
        $('#passwordRequestForm').closest('.st-card').style.display = '';
        $('#confirmPasswordCard').style.display = 'none';
        $('#passwordRequestForm').reset();
        $('#passwordConfirmForm').reset();
        $('#pwStrengthLabel').textContent = '';
        $('#matchError').textContent = '';
        $$('.pw-rules li').forEach((li) => li.classList.remove('ok'));
        const strength = $('#newPassword').closest('.field').querySelector('.pw-strength');
        strength.classList.remove('weak', 'fair', 'good', 'strong');
        state.newPasswordPlain = null;
    }

    /* ============================================================
       Password change — Step 2: Confirm
       ============================================================ */
    $('#passwordConfirmForm').addEventListener('submit', async (e) => {
        e.preventDefault();

        const code = $('#passwordCode').value.trim();
        const newPassword = $('#passwordConfirmForm [name="newPassword"]').value;
        const confirmPassword = $('#passwordConfirmForm [name="confirmPassword"]').value;

        if (!/^\d{6}$/.test(code)) {
            return FormKit.showFieldError($('#passwordCode'), 'کد باید ۶ رقم باشد');
        }
        if (!newPassword) {
            toast('رمز جدید گم شده، لطفاً از ابتدا شروع کنید', 'error');
            return resetPasswordFlow();
        }

        FormKit.clearAllErrors($('#passwordConfirmForm'));

        const btn = $('#confirmPwBtn');
        btn.disabled = true;
        const original = btn.textContent;
        btn.textContent = 'در حال تغییر…';

        try {
            const data = await api('/api/profile/password/confirm', {
                method: 'POST',
                body: JSON.stringify({ code, newPassword, confirmPassword }),
            });

            toast('رمز عبور با موفقیت تغییر کرد', 'success');

            const msg = data.revokedSessions
                ? `از ${data.revokedSessions} دستگاه دیگر خارج شدید`
                : 'شما از همه دستگاه‌ها خارج شدید';

            await confirmDialog({
                title: 'تغییر رمز موفق',
                message: msg,
                confirmText: 'متوجه شدم',
                danger: false,
            });

            resetPasswordFlow();
        } catch (err) {
            FormKit.showFieldError($('#passwordCode'), err.message);
        } finally {
            btn.disabled = false;
            btn.textContent = original;
        }
    });

    $('#cancelPasswordChange').addEventListener('click', () => {
        resetPasswordFlow();
    });

    /* ============================================================
       Logout all
       ============================================================ */
    $('#logoutAllBtn').addEventListener('click', async () => {
        const ok = await confirmDialog({
            title: 'خروج از همه دستگاه‌ها',
            message: 'تمام سشن‌های فعال شما بسته می‌شوند. ادامه می‌دهید؟',
            confirmText: 'بله، همه را ببند',
            danger: true,
        });
        if (!ok) return;

        try {
            await api('/api/auth/logout-all', { method: 'POST' });
            location.href = '/';
        } catch (err) {
            toast(err.message || 'خطا', 'error');
        }
    });

    /* ============================================================
       Password visibility toggle (از auth.js قابل استفاده)
       ============================================================ */
    document.querySelectorAll('.toggle-pass').forEach((btn) => {
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
       Helpers
       ============================================================ */
    function escapeHtml(s) {
        if (s == null) return '';
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    /* ============================================================
       Init
       ============================================================ */
    loadUser();
});

/**
 * Copyright (c) 2026 Sobhan Rasoulzadeh Asl (Sobhan-SRZA / Mr. Sinre)
 *
 * Licensed under the BSD 3-Clause License.
 * See the LICENSE file in the project root for license information.
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */