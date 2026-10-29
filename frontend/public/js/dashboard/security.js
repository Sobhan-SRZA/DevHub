(function () {
    'use strict';

    /* ============================================================
       Utilities
       ============================================================ */

    /* Escape user-supplied strings before interpolating them into HTML. */
    function escapeHtml(s) {
        if (s === null || s === undefined) return '';

        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    /**
     * Perform a credentialed JSON request. Non-2xx responses and
     * payloads explicitly marked as `ok: false` are converted into
     * thrown errors carrying the server message.
     */
    async function reqJSON(url, options) {
        const res = await fetch(url, Object.assign({ credentials: 'include' }, options));

        const data = await res.json().catch(() => ({}));

        if (!res.ok || data.ok === false) {
            throw new Error(data.message || `Request failed (${res.status})`);
        }

        return data;
    }

    /**
     * Extract the value at `key` from a response payload, transparently
     * handling envelopes shaped as `{ data: {...} }`.
     */
    function unwrap(payload, key) {
        if (!payload) return null;

        if (payload.data && typeof payload.data === 'object') {
            if (key && payload.data[key] !== undefined) return payload.data[key];

            return payload.data;
        }

        if (key && payload[key] !== undefined) return payload[key];

        return payload;
    }

    /* ============================================================
       Date and Device Helpers
       ============================================================ */

    /**
     * Render a human-friendly relative time string (e.g. "3 days ago")
     * with a locale-formatted date as the fallback for older entries.
     */
    function formatRelative(dateStr) {
        if (!dateStr) return '—';

        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return '—';

        const diffMs = Date.now() - d.getTime();
        const min = Math.floor(diffMs / 60000);

        if (min < 1) return 'just now';
        if (min < 60) return `${min} minute${min === 1 ? '' : 's'} ago`;

        const hr = Math.floor(min / 60);
        if (hr < 24) return `${hr} hour${hr === 1 ? '' : 's'} ago`;

        const day = Math.floor(hr / 24);
        if (day < 30) return `${day} day${day === 1 ? '' : 's'} ago`;

        return d.toLocaleDateString('en-US');
    }

    /* Return the SVG icon matching the given device type. */
    function deviceIcon(device) {
        const t = (device && device.deviceType) || 'desktop';

        const icons = {
            mobile: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect><line x1="12" y1="18" x2="12.01" y2="18"></line></svg>`,
            tablet: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"></rect><line x1="12" y1="18" x2="12.01" y2="18"></line></svg>`,
            desktop: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>`,
        };

        return icons[t] || icons.desktop;
    }

    /* Summarise a device record as "browser · OS", falling back to the user agent. */
    function deviceSummary(device) {
        if (!device) return '—';

        const parts = [];

        if (device.browser) parts.push(device.browser + (device.browserVersion ? ' ' + device.browserVersion : ''));
        if (device.os) parts.push(device.os);

        return parts.join(' · ') || device.userAgent || '—';
    }

    /* Summarise a location record as "city, country", falling back to the IP. */
    function locationSummary(location) {
        if (!location) return '—';

        const parts = [];

        if (location.city) parts.push(location.city);
        if (location.country) parts.push(location.country);

        return parts.join(', ') || location.ip || '—';
    }

    /* ============================================================
       Session Rendering
       ============================================================
       Renders the list of active sessions, highlighting the current
       device and offering revoke / sign-out controls per row.
       ============================================================ */
    function renderSessions(sessions, currentSessionId) {
        const wrap = document.getElementById('sessionsList');
        if (!wrap) return;

        if (!sessions || !sessions.length) {
            wrap.innerHTML = `<div class="sessions-empty">No active sessions were found.</div>`;

            return;
        }

        wrap.innerHTML = sessions.map(s => {
            const id = s._id || s.id || s.sessionId;

            // Identify the session that issued the current request.
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
                            ${isCurrent ? `<span class="session-badge">This device</span>` : ''}
                        </div>
                        <div class="session-meta">
                            <span>📍 ${escapeHtml(locationSummary(s.location))}</span>
                            <span>🕒 ${escapeHtml(formatRelative(s.lastActiveAt))}</span>
                        </div>
                        <div class="session-meta session-meta--small">
                            <span>Signed in: ${escapeHtml(formatRelative(s.loginAt))}</span>
                        </div>
                    </div>
                    <div class="session-actions">
                        ${isCurrent
                    ? `<button class="btn-danger btn-sm" data-action="logout-current">Sign out</button>`
                    : `<button class="btn-secondary btn-sm" data-action="revoke">Revoke access</button>`
                }
                    </div>
                </article>`;
        }).join('');

        wrap.querySelectorAll('[data-action]').forEach(btn => {
            btn.addEventListener('click', onSessionAction);
        });
    }

    /**
     * Handle revoke and sign-out actions for a single session row.
     * Both actions require confirmation when the confirm dialog is
     * available, and fall back to the native confirm prompt otherwise.
     */
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
                        title: 'Revoke access',
                        message: 'Are you sure you want to revoke access for this device?',
                        confirmText: 'Revoke',
                        danger: true,
                    })
                    : confirm('Revoke access for this device?');

                if (!ok) return;

                btn.disabled = true;

                await reqJSON('/api/auth/sessions/' + encodeURIComponent(sessionId), { method: 'DELETE' });

                if (window.toast) window.toast('Access revoked.', 'success');

                card.remove();
            } else if (action === 'logout-current') {
                const ok = window.confirmDialog
                    ? await window.confirmDialog({
                        title: 'Sign out',
                        message: 'Are you sure you want to sign out of your account?',
                        confirmText: 'Sign out',
                        danger: true,
                    })
                    : confirm('Sign out of your account?');

                if (!ok) return;

                btn.disabled = true;

                await reqJSON('/api/auth/logout', { method: 'POST' });

                location.href = '/';
            }
        } catch (err) {
            console.error('[security] action failed', err);

            if (window.openDialogError) {
                window.openDialogError('Error', err.message || 'The operation failed.');
            }
        } finally {
            btn.disabled = false;
        }
    }

    /* ============================================================
       Data Loading
       ============================================================ */

    /* Fetch the active sessions from the API and render them. */
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
                wrap.innerHTML = `<div class="sessions-error">Failed to load sessions: ${escapeHtml(err.message)}</div>`;
            }
        }
    }

    /* ============================================================
       Initialization
       ============================================================
       Loads the session list on page ready and wires the global
       "sign out of all devices" action.
       ============================================================ */
    document.addEventListener('DOMContentLoaded', () => {
        loadSessions();

        const logoutAllBtn = document.getElementById('logoutAllBtn');
        if (logoutAllBtn) {
            logoutAllBtn.addEventListener('click', async () => {
                const ok = window.confirmDialog
                    ? await window.confirmDialog({
                        title: 'Sign out of all devices',
                        message: 'This will sign you out of every device. You will need to sign in again to continue.',
                        confirmText: 'Sign out everywhere',
                        danger: true,
                    })
                    : confirm('Sign out of all devices?');

                if (!ok) return;

                try {
                    logoutAllBtn.disabled = true;

                    await reqJSON('/api/auth/logout-all', { method: 'POST' });

                    if (window.toast) window.toast('You have been signed out of all devices.', 'success');

                    setTimeout(() => { location.href = '/'; }, 800);
                } catch (err) {
                    if (window.openDialogError) {
                        window.openDialogError('Error', err.message || 'The operation failed.');
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