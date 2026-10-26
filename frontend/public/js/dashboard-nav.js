/* ============================================================
   Dashboard Sidebar — Collapse + Active + Logout
   ============================================================ */

(function () {
    'use strict';

    const layout = document.querySelector('.dash-layout');
    const collapseBtn = document.getElementById('dashCollapseBtn');
    const logoutBtn = document.getElementById('dashLogoutBtn');

    /* ---------------- Collapse ---------------- */
    if (layout && collapseBtn) {
        const STORAGE_KEY = 'dash_sidebar_collapsed';

        if (localStorage.getItem(STORAGE_KEY) === '1') {
            layout.classList.add('is-collapsed');
            collapseBtn.title = 'باز کردن منو (Ctrl+B)';
        }

        function toggle() {
            layout.classList.toggle('is-collapsed');
            const nowCollapsed = layout.classList.contains('is-collapsed');
            localStorage.setItem(STORAGE_KEY, nowCollapsed ? '1' : '0');
            collapseBtn.title = nowCollapsed ? 'باز کردن منو (Ctrl+B)' : 'جمع کردن منو (Ctrl+B)';
        }

        collapseBtn.addEventListener('click', toggle);

        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
                e.preventDefault();
                toggle();
            }
        });
    }

    /* ---------------- Active link ---------------- */
    const path = location.pathname;
    let best = null;
    let bestLen = -1;

    document.querySelectorAll('.dash-nav__item[data-nav]').forEach((a) => {
        const target = a.dataset.nav;
        const exact = a.hasAttribute('data-exact');
        let isActive = false;

        if (exact) {
            isActive = path === target;
        } else {
            isActive = path === target || path.startsWith(target + '/');
        }

        if (isActive && target.length > bestLen) {
            bestLen = target.length;
            best = a;
        }
    });

    if (best) best.classList.add('active');

    /* ---------------- Logout ---------------- */
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


/* ============================================================
   Breadcrumb Dropdown Menu
   ============================================================ */
(function () {
    const btn = document.getElementById('dashBreadcrumbBtn');
    const menu = document.getElementById('dashBreadcrumbMenu');
    const nav = document.getElementById('dashBreadcrumbNav');

    if (!btn || !menu || !nav) return;

    // Backdrop (mobile only — dynamically create)
    let backdrop = null;

    function createBackdrop() {
        if (backdrop) return backdrop;
        backdrop = document.createElement('div');
        backdrop.className = 'dash-breadcrumb__backdrop';
        document.body.appendChild(backdrop);
        backdrop.addEventListener('click', closeMenu);
        return backdrop;
    }

    let open = false;

    function openMenu() {
        if (open) return;
        open = true;

        menu.classList.add('open');
        btn.setAttribute('aria-expanded', 'true');

        // mobile: show backdrop + lock scroll
        if (window.matchMedia('(max-width: 640px)').matches) {
            createBackdrop().classList.add('open');
            document.body.style.overflow = 'hidden';
        }

        // focus first item for keyboard users
        const firstItem = menu.querySelector('.dash-menu__item');
        if (firstItem) setTimeout(() => firstItem.focus(), 100);
    }

    function closeMenu() {
        if (!open) return;
        open = false;

        menu.classList.remove('open');
        btn.setAttribute('aria-expanded', 'false');

        if (backdrop) backdrop.classList.remove('open');
        document.body.style.overflow = '';
    }

    function toggleMenu(e) {
        e.stopPropagation();
        if (open) closeMenu();
        else openMenu();
    }

    btn.addEventListener('click', toggleMenu);

    /* close on outside click */
    document.addEventListener('click', (e) => {
        if (open && !menu.contains(e.target) && !btn.contains(e.target)) {
            closeMenu();
        }
    });

    /* close on Escape */
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && open) {
            closeMenu();
            btn.focus();
        }
    });

    /* close when clicking a link */
    menu.querySelectorAll('.dash-menu__item').forEach((link) => {
        link.addEventListener('click', () => {
            setTimeout(closeMenu, 80);
        });
    });

    /* keyboard navigation inside menu */
    menu.addEventListener('keydown', (e) => {
        const items = Array.from(menu.querySelectorAll('.dash-menu__item'));
        const idx = items.indexOf(document.activeElement);

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            const next = items[(idx + 1) % items.length];
            next?.focus();
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            const prev = items[(idx - 1 + items.length) % items.length];
            prev?.focus();
        } else if (e.key === 'Home') {
            e.preventDefault();
            items[0]?.focus();
        } else if (e.key === 'End') {
            e.preventDefault();
            items[items.length - 1]?.focus();
        }
    });

    /* close on resize (mobile <-> desktop) */
    window.addEventListener('resize', () => {
        if (!open) return;
        // just close to reset positioning
        closeMenu();
    });

    /* mark active item */
    const path = location.pathname;
    menu.querySelectorAll('.dash-menu__item[data-nav]').forEach((a) => {
        const target = a.dataset.nav;
        const exact = a.hasAttribute('data-exact');
        const isActive = exact
            ? path === target
            : (path === target || path.startsWith(target + '/'));

        a.classList.toggle('active', isActive);
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