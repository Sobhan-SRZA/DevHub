(function () {
    'use strict';

    function escapeHtml(s) {
        if (s === null || s === undefined) return '';
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    async function reqJSON(url, options) {
        const res = await fetch(url, Object.assign({ credentials: 'include' }, options));
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data.ok === false) {
            throw new Error(data.message || `خطا (${res.status})`);
        }
        return data;
    }

    function unwrap(payload, key) {
        if (!payload) return null;
        if (payload.data && typeof payload.data === 'object') {
            if (key && payload.data[key] !== undefined) return payload.data[key];
            return payload.data;
        }
        if (key && payload[key] !== undefined) return payload[key];
        return payload;
    }

    /* ---------- date / device helpers ---------- */
    function formatRelative(dateStr) {
        if (!dateStr) return '—';
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return '—';
        const diffMs = Date.now() - d.getTime();
        const min = Math.floor(diffMs / 60000);
        if (min < 1) return 'همین حالا';
        if (min < 60) return `${min} دقیقه پیش`;
        const hr = Math.floor(min / 60);
        if (hr < 24) return `${hr} ساعت پیش`;
        const day = Math.floor(hr / 24);
        if (day < 30) return `${day} روز پیش`;
        return d.toLocaleDateString('fa-IR');
    }

    function deviceIcon(device) {
        const t = (device && device.deviceType) || 'desktop';
        const icons = {
            mobile: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect><line x1="12" y1="18" x2="12.01" y2="18"></line></svg>`,
            tablet: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"></rect><line x1="12" y1="18" x2="12.01" y2="18"></line></svg>`,
            desktop: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>`,
        };
        return icons[t] || icons.desktop;
    }


    function deviceSummary(device) {
        if (!device) return '—';
        const parts = [];
        if (device.browser) parts.push(device.browser + (device.browserVersion ? ' ' + device.browserVersion : ''));
        if (device.os) parts.push(device.os);
        return parts.join(' · ') || device.userAgent || '—';
    }

    function locationSummary(location) {
        if (!location) return '—';
        const parts = [];
        if (location.city) parts.push(location.city);
        if (location.country) parts.push(location.country);
        return parts.join('، ') || location.ip || '—';
    }

    /* ---------- render sessions ---------- */
    function renderSessions(sessions, currentSessionId) {
        const wrap = document.getElementById('sessionsList');
        if (!wrap) return;

        if (!sessions || !sessions.length) {
            wrap.innerHTML = `<div class="sessions-empty">هیچ سشن فعالی یافت نشد.</div>`;
            return;
        }

        wrap.innerHTML = sessions.map(s => {
            const id = s._id || s.id || s.sessionId;
            const isCurrent =
                (s.sessionId && s.sessionId === currentSessionId) ||
                (s.isCurrent === true);

            return `
                <article class="session-card ${isCurrent ? 'session-card--current' : ''}"
                         data-session-id="${escapeHtml(id)}">
                    <div class="session-icon">${deviceIcon(s.device)}</div>
                    <div class="session-info">
                        <div class="session-head">
                            <strong class="session-device">${escapeHtml(deviceSummary(s.device))}</strong>
                            ${isCurrent ? `<span class="session-badge">این دستگاه</span>` : ''}
                        </div>
                        <div class="session-meta">
                            <span>📍 ${escapeHtml(locationSummary(s.location))}</span>
                            <span>🕒 ${escapeHtml(formatRelative(s.lastActiveAt))}</span>
                        </div>
                        <div class="session-meta session-meta--small">
                            <span>ورود: ${escapeHtml(formatRelative(s.loginAt))}</span>
                        </div>
                    </div>
                    <div class="session-actions">
                        ${isCurrent
                    ? `<button class="btn-danger btn-sm" data-action="logout-current">خروج</button>`
                    : `<button class="btn-secondary btn-sm" data-action="revoke">قطع دسترسی</button>`
                }
                    </div>
                </article>`;
        }).join('');

        wrap.querySelectorAll('[data-action]').forEach(btn => {
            btn.addEventListener('click', onSessionAction);
        });
    }

    async function onSessionAction(ev) {
        const btn = ev.currentTarget;
        const action = btn.dataset.action;
        const card = btn.closest('[data-session-id]');
        const sessionId = card && card.dataset.sessionId;
        if (!sessionId) return;

        try {
            if (action === 'revoke') {
                const ok = window.confirmDialog
                    ? await window.confirmDialog({
                        title: 'قطع دسترسی',
                        message: 'آیا از قطع دسترسی این دستگاه مطمئن هستید؟',
                        confirmText: 'قطع کن',
                        danger: true,
                    })
                    : confirm('قطع دسترسی این دستگاه؟');
                if (!ok) return;

                btn.disabled = true;
                await reqJSON('/api/auth/sessions/' + encodeURIComponent(sessionId), { method: 'DELETE' });
                if (window.toast) window.toast('دسترسی قطع شد', 'success');
                card.remove();
            } else if (action === 'logout-current') {
                const ok = window.confirmDialog
                    ? await window.confirmDialog({
                        title: 'خروج',
                        message: 'از حساب خود خارج می‌شوید؟',
                        confirmText: 'خروج',
                        danger: true,
                    })
                    : confirm('از حساب خارج می‌شوید؟');
                if (!ok) return;

                btn.disabled = true;
                await reqJSON('/api/auth/logout', { method: 'POST' });
                location.href = '/';
            }
        } catch (err) {
            console.error('[security] action failed', err);
            if (window.openDialogError) {
                window.openDialogError('خطا', err.message || 'عملیات ناموفق بود.');
            }
        } finally {
            btn.disabled = false;
        }
    }

    /* ---------- load ---------- */
    async function loadSessions() {
        const wrap = document.getElementById('sessionsList');
        try {
            const payload = await reqJSON('/api/auth/sessions');
            const sessions =
                unwrap(payload, 'sessions') ||
                unwrap(payload, 'items') ||
                [];
            const current = unwrap(payload, 'currentSessionId');
            renderSessions(sessions, current);
        } catch (err) {
            console.error('[security] sessions load failed', err);
            if (wrap) {
                wrap.innerHTML = `<div class="sessions-error">خطا در بارگذاری سشن‌ها: ${escapeHtml(err.message)}</div>`;
            }
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        loadSessions();

        const logoutAllBtn = document.getElementById('logoutAllBtn');
        if (logoutAllBtn) {
            logoutAllBtn.addEventListener('click', async () => {
                const ok = window.confirmDialog
                    ? await window.confirmDialog({
                        title: 'خروج از همه دستگاه‌ها',
                        message: 'از همه‌ی دستگاه‌ها خارج می‌شوید؟ برای ورود دوباره باید رمز بزنید.',
                        confirmText: 'خروج از همه',
                        danger: true,
                    })
                    : confirm('از همه دستگاه‌ها خارج می‌شوید؟');
                if (!ok) return;

                try {
                    logoutAllBtn.disabled = true;
                    await reqJSON('/api/auth/logout-all', { method: 'POST' });
                    if (window.toast) window.toast('از همه دستگاه‌ها خارج شدید', 'success');
                    setTimeout(() => { location.href = '/'; }, 800);
                } catch (err) {
                    if (window.openDialogError) {
                        window.openDialogError('خطا', err.message || 'عملیات ناموفق بود.');
                    }
                    logoutAllBtn.disabled = false;
                }
            });
        }
    });
})();

/**
 * Copyright (c) 2026 Sobhan Rasoulzadeh Asl (Sobhan-SRZA / Mr. Sinre)
 *
 * Licensed under the BSD 3-Clause License.
 * See the LICENSE file in the project root for license information.
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */