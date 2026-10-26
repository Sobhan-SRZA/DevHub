/* ============================================================
   HEADER — Search, Drawer, Profile, Auth
   ============================================================ */

(function () {
    'use strict';

    const $ = (s) => document.querySelector(s);
    const $$ = (s) => Array.from(document.querySelectorAll(s));

    const state = { user: null };

    const els = {
        // auth
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

        // dashboard shortcut
        dashShortcut: $('#dashShortcut'),

        // search
        searchBtn: $('#searchBtn'),
        searchOverlay: $('#searchOverlay'),
        searchInput: $('#searchInput'),

        // drawer
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
       Utils
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

    function setAvatar(el, user) {
        if (!el) return;
        const name = user?.name || user?.username || '?';
        const initial = name.trim().charAt(0).toUpperCase();
        const url = user?.avatar?.url;

        el.style.backgroundImage = url ? `url('${escapeHtml(url)}')` : '';
        el.style.backgroundSize = url ? 'cover' : '';
        el.style.backgroundPosition = url ? 'center' : '';
        if (!url) el.style.background = 'linear-gradient(135deg, #007bff, #6ebbff)';
        el.textContent = url ? '' : initial;
    }

    /* ============================================================
       Active link detection
       ============================================================ */
    function highlightActive() {
        const current = location.pathname;

        // main site nav
        $$('.h-nav__link').forEach((link) => {
            const href = link.getAttribute('href');
            if (!href) return;
            const isActive = href === '/'
                ? current === '/'
                : (current === href || current.startsWith(href + '/'));
            link.classList.toggle('active', isActive);
        });

        // drawer links (data-nav)
        $$('.h-drawer__link[data-nav]').forEach((link) => {
            const target = link.dataset.nav;
            const exact = link.hasAttribute('data-exact');
            let isActive = false;

            if (exact) {
                isActive = current === target;
            } else {
                isActive = current === target || current.startsWith(target + '/');
            }

            link.classList.toggle('active', isActive);
        });
    }

    /* ============================================================
       Render user
       ============================================================ */
    function renderUser() {
        const u = state.user;

        if (u) {
            /* desktop header */
            els.authGuests.style.display = 'none';
            els.authGuests.style.visibility = 'visible';
            els.authProfile.style.display = 'flex';
            if (els.dashShortcut) els.dashShortcut.style.display = '';

            const displayName = u.name || u.username || 'کاربر';
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

            /* drawer */
            els.drawerGuests.style.display = 'none';
            els.drawerGuests.style.visibility = 'visible';
            els.drawerProfile.style.display = 'flex';
            els.drawerLogout.style.display = 'flex';

            /* ✅ show dashboard section always when logged in */
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
       Fetch user
       ============================================================ */
    async function fetchUser() {
        try {
            const res = await fetch('/api/auth/me', { credentials: 'include' });
            if (res.ok) {
                const data = await res.json();
                state.user = data.user;
            }
        } catch { }
        renderUser();
    }

    /* ============================================================
       Profile dropdown
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

    document.addEventListener('click', (e) => {
        if (els.profileMenu?.classList.contains('open') &&
            !els.profileMenu.contains(e.target) &&
            !els.profileBtn.contains(e.target)) {
            closeMenu();
        }
    });

    /* ============================================================
       Search
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

    els.searchInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            const q = els.searchInput.value.trim();
            if (q) location.href = `/explore?q=${encodeURIComponent(q)}`;
        }
    });

    /* ============================================================
       Mobile drawer
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
        if (els.mobileDrawer.classList.contains('open')) closeDrawer();
        else openDrawer();
    });

    $$('[data-close-drawer]').forEach((el) => el.addEventListener('click', closeDrawer));

    // بستن روی کلیک لینک
    $$('.h-drawer__link').forEach((link) => {
        link.addEventListener('click', () => setTimeout(closeDrawer, 100));
    });

    /* ============================================================
       Logout
       ============================================================ */
    async function doLogout() {
        try {
            await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
        } catch { }
        state.user = null;
        renderUser();
        closeMenu();
        closeDrawer();
        if (location.pathname !== '/') location.href = '/';
    }

    els.logoutBtn?.addEventListener('click', doLogout);
    els.drawerLogout?.addEventListener('click', doLogout);

    /* ============================================================
       Keyboard
       ============================================================ */
    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
            e.preventDefault();
            openSearch();
            return;
        }
        if (e.key === '/' && !isTyping()) {
            e.preventDefault();
            openSearch();
            return;
        }
        if (e.key === 'Escape') {
            if (els.searchOverlay.classList.contains('open')) closeSearch();
            if (els.mobileDrawer.classList.contains('open')) closeDrawer();
            if (els.profileMenu.classList.contains('open')) closeMenu();
        }
    });

    function isTyping() {
        const el = document.activeElement;
        if (!el) return false;
        const tag = el.tagName.toLowerCase();
        return tag === 'input' || tag === 'textarea' || tag === 'select' || el.isContentEditable;
    }

    /* ============================================================
       Init
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