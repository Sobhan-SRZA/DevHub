/* ============================================================
   PROFILE PAGE LOGIC
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {

    /* ---------------- DOM refs ---------------- */
    const els = {
        avatarBig: document.getElementById('profileAvatarBig'),
        heroName: document.getElementById('profileHeroName'),
        heroUser: document.getElementById('profileHeroUsername'),
        heroEmail: document.getElementById('profileHeroEmail'),
        infoUser: document.getElementById('infoUsername'),
        infoEmail: document.getElementById('infoEmail'),
        infoCreated: document.getElementById('infoCreatedAt'),

        sessionsList: document.getElementById('sessionsList'),

        logoutBtn: document.getElementById('logoutSessionBtn'),
        logoutAllBtn: document.getElementById('logoutAllBtn'),
    };

    /* ---------------- helpers ---------------- */
    async function apiGet(path) {
        const res = await fetch(path, {
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' }
        });

        let data = null;
        try { data = await res.json(); } catch { /* no body */ }

        if (!res.ok) {
            const err = new Error(data?.message || 'Request failed');
            err.code = data?.code;
            err.status = res.status;
            err.details = data?.details;
            err.field = data?.field;
            throw err;
        }
        return data;
    }

    function showError(title, message) {
        if (typeof openDialogError === 'function') {
            openDialogError(title, message);
        }

        else {
            alert(`${title}\n${message}`);
        }
    }

    function formatDate(dateStr) {
        if (!dateStr)
            return '—';

        const d = new Date(dateStr);
        if (Number.isNaN(d.getTime()))
            return '—';

        // Persian-friendly short format
        return new Intl.DateTimeFormat('fa-IR', {
            dateStyle: 'medium',
            timeStyle: 'short',
        }).format(d);
    }

    function relativeTime(dateStr) {
        if (!dateStr)
            return '';

        const diff = Date.now() - new Date(dateStr).getTime();
        const s = Math.floor(diff / 1000);
        if (s < 60)
            return 'همین الان';

        const m = Math.floor(s / 60);
        if (m < 60)
            return `${m} دقیقه پیش`;

        const h = Math.floor(m / 60);
        if (h < 24)
            return `${h} ساعت پیش`;

        const days = Math.floor(h / 24);
        if (days < 30)
            return `${days} روز پیش`;

        const months = Math.floor(days / 30);
        return `${months} ماه پیش`;
    }

    /* ---------------- device icon ---------------- */
    function deviceIcon(type) {
        const icons = {
            mobile: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect><line x1="12" y1="18" x2="12" y2="18"></line></svg>`,
            tablet: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"></rect><line x1="12" y1="18" x2="12" y2="18"></line></svg>`,
            desktop: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>`,
            bot: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="8" width="16" height="12" rx="2"></rect><circle cx="9" cy="14" r="1"></circle><circle cx="15" cy="14" r="1"></circle><path d="M12 8V4"></path><circle cx="12" cy="3" r="1"></circle></svg>`,
            unknown: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12" y2="17"></line></svg>`,
        };

        return icons[type] || icons.unknown;
    }

    function deviceLabel(device) {
        if (!device)
            return 'دستگاه ناشناس';

        const parts = [];
        if (device.os)
            parts.push(device.os + (device.osVersion ? ` ${device.osVersion}` : ''));

        if (device.browser)
            parts.push(device.browser);

        return parts.join(' • ') || device.deviceType || 'دستگاه ناشناس';
    }

    function locationLabel(loc) {
        if (!loc)
            return '—';

        const parts = [];
        if (loc.city)
            parts.push(loc.city);

        if (loc.country)
            parts.push(loc.country);

        return parts.join(', ') || loc.ip || '—';
    }

    /* ---------------- render user info ---------------- */
    function renderUser(user) {
        if (!user)
            return;

        const name = user.name || user.username || 'کاربر';
        els.heroName.textContent = name;
        els.heroUser.textContent = '@' + (user.username || '—');
        els.heroEmail.textContent = user.email || '—';

        els.avatarBig.textContent = name.trim().charAt(0).toUpperCase();

        els.infoUser.textContent = user.username || '—';
        els.infoEmail.textContent = user.email || '—';
        els.infoCreated.textContent = user.createdAt ? formatDate(user.createdAt) : '—';
    }

    /* ---------------- render sessions ---------------- */
    function renderSessions(list, currentId) {
        if (!list || list.length === 0) {
            els.sessionsList.innerHTML = `<div class="empty-sessions">هیچ سشن فعالی وجود ندارد.</div>`;

            return;
        }

        els.sessionsList.innerHTML = '';

        for (const s of list) {
            const isCurrent = String(s.id) === String(currentId);
            const card = document.createElement('div');
            card.className = 'session-card' + (isCurrent ? ' current' : '');

            const deviceType = s.device?.deviceType || 'unknown';
            const isBot = s.device?.isBot;

            card.innerHTML = `
                <div class="session-icon">${deviceIcon(deviceType)}</div>

                <div class="session-body">
                    <div class="session-title">
                        <span class="session-device">${escapeHtml(deviceLabel(s.device))}</span>
                        ${isCurrent ? '<span class="session-badge">دستگاه فعلی</span>' : ''}
                        ${isBot ? '<span class="session-badge bot">BOT</span>' : ''}
                    </div>

                    <div class="session-meta">
                        <span title="IP">
                            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>
                            ${escapeHtml(s.location?.ip || '—')}
                        </span>
                        <span title="Location">
                            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                            ${escapeHtml(locationLabel(s.location))}
                        </span>
                        ${s.location?.isp ? `
                        <span title="ISP">
                            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.55a11 11 0 0 1 14.08 0"></path><path d="M1.42 9a16 16 0 0 1 21.16 0"></path><path d="M8.53 16.11a6 6 0 0 1 6.95 0"></path><line x1="12" y1="20" x2="12" y2="20"></line></svg>
                            ${escapeHtml(s.location.isp)}
                        </span>` : ''}
                    </div>

                    <div class="session-dates">
                        <span>ورود: ${formatDate(s.loginAt)}</span>
                        <span>آخرین فعالیت: ${relativeTime(s.lastActiveAt)}</span>
                    </div>
                </div>

                <div class="session-actions">
                    <button type="button" class="revoke-btn" data-id="${s.id}"
                        ${isCurrent ? 'title="برای خروج از این دستگاه از دکمه خروج استفاده کنید"' : ''}>
                        ${isCurrent ? 'دستگاه فعلی' : 'خروج از این دستگاه'}
                    </button>
                </div>
            `;

            // disable revoke for current session
            const btn = card.querySelector('.revoke-btn');
            if (isCurrent) {
                btn.disabled = true;
            }

            else {
                btn.addEventListener('click', () => revokeSession(s.id, btn));
            }

            els.sessionsList.appendChild(card);
        }
    }

    function escapeHtml(str) {
        if (str === null || str === undefined)
            return '';

        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    /* ---------------- actions ---------------- */
    async function revokeSession(id, btn) {
        const ok = await confirmDialog({
            title: 'خروج از دستگاه',
            message: 'مطمئنید می‌خواهید از این دستگاه خارج شوید؟',
            confirmText: 'بله، خارج شو',
            cancelText: 'انصراف',
            danger: true,
        });

        if (!ok)
            return;

        btn.disabled = true;
        try {
            await FormKit.postJSON(`/api/auth/sessions/${id}`, {}, { method: 'DELETE' });
            toast('از این دستگاه خارج شدید', 'success');
            await loadSessions();
        }

        catch (err) {
            if (err.code === 'SESSION_EXPIRED' || err.code === 'UNAUTHENTICATED') {
                location.href = '/login';
                return;
            }

            toast(err.message || 'خروج ناموفق بود', 'error');
            btn.disabled = false;
        }
    }


    async function logout() {
        const ok = await confirmDialog({
            title: 'خروج از دستگاه فعلی',
            message: 'سشن‌ شما بسته می‌شود. ادامه می‌دهید؟',
            confirmText: 'بله، سشن را ببند',
            danger: true
        });

        if (!ok)
            return;

        try {
            await FormKit.postJSON('/api/auth/logout', {});
            window.location.href = '/';
        }

        catch (err) {
            toast(err.message || 'خطا در خروج', 'error');
        }
    }

    async function logoutAll() {
        const ok = await confirmDialog({
            title: 'خروج از همه دستگاه‌ها',
            message: 'همه سشن‌های فعال شما بسته می‌شوند. ادامه می‌دهید؟',
            confirmText: 'بله، همه را ببند',
            danger: true,
        });

        if (!ok)
            return;

        try {
            await FormKit.postJSON('/api/auth/logout-all', {});
            window.location.href = '/';
        }

        catch (err) {
            toast(err.message || 'خطا در خروج', 'error');
        }
    }

    /* ---------------- loaders ---------------- */
    async function loadUser() {
        try {
            const data = await apiGet('/api/auth/me');
            renderUser(data.user);

            return data;
        }

        catch (err) {
            if (err.status === 401) {
                window.location.href = '/login';
                return null;
            }

            showError('خطا', err.message || 'دریافت اطلاعات کاربر ناموفق بود');
            return null;
        }
    }

    async function loadSessions() {
        try {
            const data = await apiGet('/api/auth/sessions');
            renderSessions(data.sessions, data.current);
        }

        catch (err) {
            els.sessionsList.innerHTML = `<div class="empty-sessions">دریافت سشن‌ها ناموفق بود.</div>`;
            console.error(err);
        }
    }

    /* ---------------- wire events ---------------- */
    els.logoutBtn.addEventListener('click', logout);
    els.logoutAllBtn.addEventListener('click', logoutAll);

    /* ---------------- init ---------------- */
    (async function init() {
        const me = await loadUser();
        if (!me)
            return;

        await loadSessions();
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