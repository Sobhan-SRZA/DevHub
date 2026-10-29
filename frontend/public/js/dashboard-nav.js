/* ============================================================
   Dashboard Sidebar — Collapse, Active State, and Logout
   ============================================================
   Manages the collapsible sidebar, highlights the active
   navigation item, and handles the logout action.
   ============================================================ */

(function () {
    'use strict';

    const layout = document.querySelector('.dash-layout');
    const collapseBtn = document.getElementById('dashCollapseBtn');
    const logoutBtn = document.getElementById('dashLogoutBtn');

    /* ---------------- Collapse ---------------- */
    if (layout && collapseBtn) {
        const STORAGE_KEY = 'dash_sidebar_collapsed';

        // Restore the persisted collapsed state on load.
        if (localStorage.getItem(STORAGE_KEY) === '1') {
            layout.classList.add('is-collapsed');
            collapseBtn.title = 'Expand menu (Ctrl+B)';
        }

        /**
         * Toggle the sidebar's collapsed state, persist the new state,
         * and update the button's tooltip accordingly.
         */
        function toggle() {
            layout.classList.toggle('is-collapsed');
            const nowCollapsed = layout.classList.contains('is-collapsed');
            localStorage.setItem(STORAGE_KEY, nowCollapsed ? '1' : '0');
            collapseBtn.title = nowCollapsed ? 'Expand menu (Ctrl+B)' : 'Collapse menu (Ctrl+B)';
        }

        collapseBtn.addEventListener('click', toggle);

        // Keyboard shortcut: Ctrl/Cmd + B.
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
                e.preventDefault();
                toggle();
            }
        });
    }

    /* ---------------- Active Link ---------------- */
    /* Choose the most specific matching navigation target. */
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

        // Prefer the longest (most specific) matching route.
        if (isActive && target.length > bestLen) {
            bestLen = target.length;
            best = a;
        }
    });

    if (best) best.classList.add('active');

    /* ---------------- Logout ---------------- */
    logoutBtn?.addEventListener('click', async () => {
        // Prompt for confirmation when the dialog helper is available.
        if (typeof confirmDialog === 'function') {
            const ok = await confirmDialog({
                title: 'Sign Out',
                message: 'Are you sure you want to sign out of your account?',
                confirmText: 'Yes, sign out',
                danger: true,
            });
            if (!ok) return;
        }

        try {
            await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
        } catch { /* Ignore network errors — redirect regardless. */ }

        location.href = '/';
    });
})();


/* ============================================================
   Breadcrumb Dropdown Menu
   ============================================================
   Toggles the breadcrumb dropdown, supports keyboard navigation,
   and renders a mobile backdrop that closes the menu on tap.
   ============================================================ */
(function () {
    const btn = document.getElementById('dashBreadcrumbBtn');
    const menu = document.getElementById('dashBreadcrumbMenu');
    const nav = document.getElementById('dashBreadcrumbNav');

    if (!btn || !menu || !nav) return;

    // Backdrop element — created lazily on first mobile use.
    let backdrop = null;

    /**
     * Create (once) and return the mobile backdrop used to dismiss
     * the menu by tapping outside of it.
     */
    function createBackdrop() {
        if (backdrop) return backdrop;

        backdrop = document.createElement('div');
        backdrop.className = 'dash-breadcrumb__backdrop';
        document.body.appendChild(backdrop);
        backdrop.addEventListener('click', closeMenu);

        return backdrop;
    }

    let open = false;

    /**
     * Open the dropdown menu. On mobile viewports, a backdrop is shown
     * and document scrolling is locked. Keyboard focus is moved to the
     * first menu item to support keyboard-only users.
     */
    function openMenu() {
        if (open) return;
        open = true;

        menu.classList.add('open');
        btn.setAttribute('aria-expanded', 'true');

        // On mobile, display the backdrop and lock page scrolling.
        if (window.matchMedia('(max-width: 640px)').matches) {
            createBackdrop().classList.add('open');
            document.body.style.overflow = 'hidden';
        }

        // Move focus to the first item for keyboard users.
        const firstItem = menu.querySelector('.dash-menu__item');
        if (firstItem) setTimeout(() => firstItem.focus(), 100);
    }

    /**
     * Close the dropdown menu and restore the page to its default
     * scrolling behaviour.
     */
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

    /* Close when clicking outside of the menu. */
    document.addEventListener('click', (e) => {
        if (open && !menu.contains(e.target) && !btn.contains(e.target)) {
            closeMenu();
        }
    });

    /* Close on Escape and return focus to the trigger. */
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && open) {
            closeMenu();
            btn.focus();
        }
    });

    /* Close shortly after a menu link is activated. */
    menu.querySelectorAll('.dash-menu__item').forEach((link) => {
        link.addEventListener('click', () => {
            setTimeout(closeMenu, 80);
        });
    });

    /* Keyboard navigation within the menu. */
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

    /* Close on viewport resize to reset positioning across breakpoints. */
    window.addEventListener('resize', () => {
        if (!open) return;

        closeMenu();
    });

    /* Mark the current route's menu item as active. */
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