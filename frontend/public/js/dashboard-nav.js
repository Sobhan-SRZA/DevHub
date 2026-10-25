/* ============================================================
   Dashboard Sidebar — Collapse Toggle + Persistence
   ============================================================ */

(function () {
    'use strict';

    const STORAGE_KEY = 'dash_sidebar_collapsed';

    const layout = document.querySelector('.dash-layout');
    const sidebar = document.getElementById('dashSidebar');
    const collapseBtn = document.getElementById('dashCollapseBtn');

    if (!layout || !sidebar || !collapseBtn) return;

    /* ---------------- restore ---------------- */
    const isCollapsed = localStorage.getItem(STORAGE_KEY) === '1';
    if (isCollapsed) layout.classList.add('is-collapsed');

    /* ---------------- toggle ---------------- */
    function toggle() {
        layout.classList.toggle('is-collapsed');
        const now = layout.classList.contains('is-collapsed');
        localStorage.setItem(STORAGE_KEY, now ? '1' : '0');
        collapseBtn.title = now ? 'باز کردن منو' : 'جمع کردن منو';
    }

    collapseBtn.addEventListener('click', toggle);

    /* ---------------- Ctrl+B shortcut ---------------- */
    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
            e.preventDefault();
            toggle();
        }
    });

    /* ---------------- active link ---------------- */
    const path = location.pathname;
    let best = null;
    let bestLen = -1;

    document.querySelectorAll('.dash-nav__item[data-path]').forEach((a) => {
        const p = a.dataset.path;
        if (p === '/' && path !== '/') return;
        if (path === p || path.startsWith(p + '/')) {
            if (p.length > bestLen) {
                bestLen = p.length;
                best = a;
            }
        }
    });

    if (best) best.classList.add('active');

    /* ---------------- logout ---------------- */
    const logoutBtn = document.getElementById('dashLogoutBtn');
    logoutBtn?.addEventListener('click', async () => {
        if (typeof confirmDialog === 'function') {
            const ok = await confirmDialog({
                title: 'خروج',
                message: 'از حساب خود خارج می‌شوید؟',
                confirmText: 'بله، خارج شو',
                danger: true,
            });
            if (!ok) return;
        }

        try {
            await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
        } catch { }
        location.href = '/';
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