/* ============================================================
   HEADER — Search, Drawer, Profile, Authentication
   ============================================================
   Encapsulated module that manages the site header behaviour:
   authentication state, profile dropdown, global search,
   mobile drawer, and keyboard shortcuts.
   ============================================================ */

(function () {
    'use strict';

    const $ = (selector) => document.querySelector(selector);
    const $$ = (selector) => Array.from(document.querySelectorAll(selector));

    /* Holds the currently authenticated user, or `null` for guests. */
    const state = { user: null };

    /* Cached DOM references — resolved once on module init. */
    const els = {
        // Authentication controls
        authGuests: $('#authGuests'),
        authProfile: $('#authProfile'),
        profileBtn: $('#profileBtn'),
        profileMenu: $('#profileMenu'),
        profileName: $('#profileName'),
        profileAvatar: $('#profileAvatar'),
        menuAvatar: $('#menuAvatar'),
        menuName: $('#menuName'),
        menuUsername: $('#menuUsername'),
        menuProfileLink: $('#menuProfileLink'),
        logoutBtn: $('#logoutBtn'),

        // Dashboard shortcut
        dashShortcut: $('#dashShortcut'),

        // Global search overlay
        searchBtn: $('#searchBtn'),
        searchOverlay: $('#searchOverlay'),
        searchInput: $('#searchInput'),

        // Mobile drawer
        mobileMenuBtn: $('#mobileMenuBtn'),
        mobileDrawer: $('#mobileDrawer'),
        drawerGuests: $('#drawerGuests'),
        drawerProfile: $('#drawerProfile'),
        drawerAvatar: $('#drawerAvatar'),
        drawerName: $('#drawerName'),
        drawerUsername: $('#drawerUsername'),
        drawerLogout: $('#drawerLogout'),
        drawerDashboardSection: $('#drawerDashboardSection'),
    };

    /* ============================================================
       Utilities
       ============================================================ */

    /**
     * Escape user-supplied strings before interpolating them into HTML
     * to prevent markup injection.
     */
    function escapeHtml(s) {
        if (s == null) return '';

        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    /**
     * Apply the user's avatar to the given element. When no avatar URL
     * is available, fall back to a gradient background with the
     * initial letter of the display name.
     */
    function setAvatar(el, user) {
        if (!el) return;

        const name = user?.name || user?.username || '?';
        const initial = name.trim().charAt(0).toUpperCase();
        const url = user?.avatar?.url;

        el.style.backgroundImage = url ? `url('${escapeHtml(url)}')` : '';
        el.style.backgroundSize = url ? 'cover' : '';
        el.style.backgroundPosition = url ? 'center' : '';

        if (!url) {
            el.style.background = 'linear-gradient(135deg, #007bff, #6ebbff)';
        }

        el.textContent = url ? '' : initial;
    }

    /* ============================================================
       Active Link Detection
       ============================================================ */

    /**
     * Highlight navigation links that match the current route.
     * Handles both the primary site navigation and the mobile
     * drawer, which may use exact-match or prefix-match semantics.
     */
    function highlightActive() {
        const current = location.pathname;

        // Primary site navigation
        $$('.h-nav__link').forEach((link) => {
            const href = link.getAttribute('href');
            if (!href) return;

            const isActive = href === '/'
                ? current === '/'
                : (current === href || current.startsWith(href + '/'));

            link.classList.toggle('active', isActive);
        });

        // Mobile drawer links (identified by `data-nav`)
        $$('.h-drawer__link[data-nav]').forEach((link) => {
            const target = link.dataset.nav;
            const exact = link.hasAttribute('data-exact');

            let isActive;

            if (exact) {
                isActive = current === target;
            } else {
                isActive = current === target || current.startsWith(target + '/');
            }

            link.classList.toggle('active', isActive);
        });
    }

    /* ============================================================
       User Rendering
       ============================================================ */

    /**
     * Reflect the current authentication state in the header, profile
     * dropdown, and mobile drawer. Guests see the authentication
     * controls; authenticated users see their avatar and menu actions.
     */
    function renderUser() {
        const u = state.user;

        if (u) {
            /* Desktop header */
            els.authGuests.style.display = 'none';
            els.authGuests.style.visibility = 'visible';
            els.authProfile.style.display = 'flex';
            if (els.dashShortcut) els.dashShortcut.style.display = '';

            const displayName = u.name || u.username || 'User';
            els.profileName.textContent = displayName;

            setAvatar(els.profileAvatar, u);
            setAvatar(els.menuAvatar, u);
            setAvatar(els.drawerAvatar, u);

            if (els.menuName) els.menuName.textContent = displayName;
            if (els.menuUsername) els.menuUsername.textContent = '@' + (u.username || '—');
            if (els.drawerName) els.drawerName.textContent = displayName;
            if (els.drawerUsername) els.drawerUsername.textContent = '@' + (u.username || '—');

            if (els.menuProfileLink && u.username) {
                els.menuProfileLink.href = `/users/${encodeURIComponent(u.username)}`;
            }

            /* Mobile drawer */
            els.drawerGuests.style.display = 'none';
            els.drawerGuests.style.visibility = 'visible';
            els.drawerProfile.style.display = 'flex';
            els.drawerLogout.style.display = 'flex';

            // Always reveal the dashboard section for authenticated users.
            if (els.drawerDashboardSection) {
                els.drawerDashboardSection.style.display = 'block';
            }
        } else {
            els.authGuests.style.display = 'flex';
            els.authGuests.style.visibility = 'visible';
            els.authProfile.style.display = 'none';
            if (els.dashShortcut) els.dashShortcut.style.display = 'none';

            els.drawerGuests.style.display = 'flex';
            els.drawerGuests.style.visibility = 'visible';
            els.drawerProfile.style.display = 'none';
            els.drawerLogout.style.display = 'none';

            if (els.drawerDashboardSection) {
                els.drawerDashboardSection.style.display = 'none';
            }
        }
    }

    /* ============================================================
       User Fetching
       ============================================================ */

    /**
     * Resolve the authenticated user from the session API. Silently
     * falls back to the guest state if the request fails.
     */
    async function fetchUser() {
        try {
            const res = await fetch('/api/auth/me', { credentials: 'include' });

            if (res.ok) {
                const data = await res.json();
                state.user = data.user;
            }
        } catch { /* Ignore network errors — fall back to guest state. */ }

        renderUser();
    }

    /* ============================================================
       Profile Dropdown
       ============================================================ */

    function toggleMenu(e) {
        e.stopPropagation();
        els.profileMenu.classList.toggle('open');
        els.profileBtn.setAttribute('aria-expanded', els.profileMenu.classList.contains('open'));
    }

    function closeMenu() {
        els.profileMenu.classList.remove('open');
        els.profileBtn.setAttribute('aria-expanded', 'false');
    }

    els.profileBtn?.addEventListener('click', toggleMenu);

    // Close the dropdown when clicking outside of it.
    document.addEventListener('click', (e) => {
        if (els.profileMenu?.classList.contains('open') &&
            !els.profileMenu.contains(e.target) &&
            !els.profileBtn.contains(e.target)) {
            closeMenu();
        }
    });

    /* ============================================================
       Global Search
       ============================================================ */

    function openSearch() {
        els.searchOverlay.classList.add('open');
        els.searchOverlay.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
        setTimeout(() => els.searchInput?.focus(), 80);
    }

    function closeSearch() {
        els.searchOverlay.classList.remove('open');
        els.searchOverlay.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
        if (els.searchInput) els.searchInput.value = '';
    }

    els.searchBtn?.addEventListener('click', openSearch);
    $$('[data-close-search]').forEach((el) => el.addEventListener('click', closeSearch));

    // Submit the search when pressing Enter in the input field.
    els.searchInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            const q = els.searchInput.value.trim();

            if (q) {
                location.href = `/explore?q=${encodeURIComponent(q)}`;
            }
        }
    });

    /* ============================================================
       Mobile Drawer
       ============================================================ */

    function openDrawer() {
        els.mobileDrawer.classList.add('open');
        els.mobileDrawer.setAttribute('aria-hidden', 'false');
        els.mobileMenuBtn.setAttribute('aria-expanded', 'true');
        document.body.style.overflow = 'hidden';
    }

    function closeDrawer() {
        els.mobileDrawer.classList.remove('open');
        els.mobileDrawer.setAttribute('aria-hidden', 'true');
        els.mobileMenuBtn.setAttribute('aria-expanded', 'false');
        document.body.style.overflow = '';
    }

    els.mobileMenuBtn?.addEventListener('click', () => {
        if (els.mobileDrawer.classList.contains('open')) {
            closeDrawer();
        } else {
            openDrawer();
        }
    });

    $$('[data-close-drawer]').forEach((el) => el.addEventListener('click', closeDrawer));

    // Close the drawer shortly after a navigation link is clicked.
    $$('.h-drawer__link').forEach((link) => {
        link.addEventListener('click', () => setTimeout(closeDrawer, 100));
    });

    /* ============================================================
       Logout
       ============================================================ */

    /**
     * Terminate the current session, reset the local user state, and
     * redirect to the home page when necessary.
     */
    async function doLogout() {
        try {
            await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
        } catch { /* Ignore network errors — clear state regardless. */ }

        state.user = null;
        renderUser();
        closeMenu();
        closeDrawer();

        if (location.pathname !== '/') {
            location.href = '/';
        }
    }

    els.logoutBtn?.addEventListener('click', doLogout);
    els.drawerLogout?.addEventListener('click', doLogout);

    /* ============================================================
       Keyboard Shortcuts
       ============================================================ */

    document.addEventListener('keydown', (e) => {
        // Ctrl/Cmd + K — open global search.
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
            e.preventDefault();
            openSearch();
            return;
        }

        // "/" — open global search when not typing in a field.
        if (e.key === '/' && !isTyping()) {
            e.preventDefault();
            openSearch();
            return;
        }

        // Escape — dismiss any open overlay.
        if (e.key === 'Escape') {
            if (els.searchOverlay.classList.contains('open')) closeSearch();
            if (els.mobileDrawer.classList.contains('open')) closeDrawer();
            if (els.profileMenu.classList.contains('open')) closeMenu();
        }
    });

    /**
     * Determine whether the focused element is a text-entry control,
     * so that global shortcuts do not interfere with user input.
     */
    function isTyping() {
        const el = document.activeElement;
        if (!el) return false;

        const tag = el.tagName.toLowerCase();

        return tag === 'input' || tag === 'textarea' || tag === 'select' || el.isContentEditable;
    }

    /* ============================================================
       Initialization
       ============================================================ */

    highlightActive();
    fetchUser();
})();

/**
 * Copyright (c) 2026 Sobhan Rasoulzadeh Asl (Sobhan-SRZA / Mr. Sinre)
 *
 * Licensed under the BSD 3-Clause License.
 * See the LICENSE file in the project root for license information.
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */