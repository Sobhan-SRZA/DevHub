/* ============================================================
   DevHub Theme Controller
   ============================================================
   Manages the application's colour mode and accent palette.
   Preferences are persisted in localStorage and applied to the
   document root as `data-mode` and `data-accent` attributes.

   Supported modes:   system | light | dark
   Supported accents: blue | violet | emerald | amber | rose | cyan
   ============================================================ */
(function () {
    'use strict';

    /* Storage keys and the set of valid option values. */
    var STORAGE_MODE = 'dh-mode';
    var STORAGE_ACCENT = 'dh-accent';
    var ACCENTS = ['blue', 'violet', 'emerald', 'amber', 'rose', 'cyan'];
    var MODES = ['system', 'light', 'dark'];

    /* --------------------------------------------------------
       Safe Storage Access
       --------------------------------------------------------
       Wraps localStorage reads and writes so that private-browsing
       modes or storage-quota errors cannot break the page.
       -------------------------------------------------------- */
    function safeGet(key, fallback) {
        try {
            var v = localStorage.getItem(key);
            return v || fallback;
        } catch (e) {
            return fallback;
        }
    }

    function safeSet(key, value) {
        try {
            localStorage.setItem(key, value);
        } catch (e) { /* Ignore storage errors in private mode. */ }
    }

    /* --------------------------------------------------------
       Mode Resolution
       -------------------------------------------------------- */

    /* Determine the operating system's current colour preference. */
    function systemMode() {
        try {
            return window.matchMedia('(prefers-color-scheme: light)').matches
                ? 'light'
                : 'dark';
        } catch (e) {
            return 'dark';
        }
    }

    /* Resolve the stored preference to a concrete mode. */
    function resolveMode(mode) {
        return mode === 'system' ? systemMode() : mode;
    }

    /* --------------------------------------------------------
       Theme Application
       --------------------------------------------------------
       Applies the resolved mode and accent to the document root,
       synchronises the browser's `color-scheme` and the optional
       theme-color meta tag, and dispatches a `dh:theme` event so
       other modules can react to theme changes.
       -------------------------------------------------------- */
    function applyTheme(modePref, accent) {
        if (MODES.indexOf(modePref) === -1) modePref = 'system';
        if (ACCENTS.indexOf(accent) === -1) accent = 'blue';

        var resolved = resolveMode(modePref);
        var root = document.documentElement;

        root.setAttribute('data-mode', resolved);
        root.setAttribute('data-accent', accent);
        root.style.colorScheme = resolved;

        // Keep the theme-color meta tag in sync when present.
        var meta = document.querySelector('meta[name="theme-color"]');
        if (meta) {
            meta.setAttribute('content', resolved === 'light' ? '#f8fafc' : '#070b12');
        }

        window.dispatchEvent(new CustomEvent('dh:theme', {
            detail: { mode: modePref, resolved: resolved, accent: accent }
        }));
    }

    /* Read the persisted mode and accent preferences. */
    function getState() {
        return {
            mode: safeGet(STORAGE_MODE, 'system'),
            accent: safeGet(STORAGE_ACCENT, 'blue')
        };
    }

    /* Persist a new mode preference and re-apply the theme. */
    function setMode(mode) {
        if (MODES.indexOf(mode) === -1) return;

        safeSet(STORAGE_MODE, mode);
        applyTheme(mode, getState().accent);
        syncUI();
    }

    /* Persist a new accent preference and re-apply the theme. */
    function setAccent(accent) {
        if (ACCENTS.indexOf(accent) === -1) return;

        safeSet(STORAGE_ACCENT, accent);
        applyTheme(getState().mode, accent);
        syncUI();
    }

    /* --------------------------------------------------------
       UI Synchronisation
       --------------------------------------------------------
       Reflects the current theme state in the mode and accent
       toggle buttons, and updates the trigger's icon and labels.
       -------------------------------------------------------- */
    function syncUI() {
        var state = getState();
        var resolved = resolveMode(state.mode);

        document.querySelectorAll('.theme-mode-btn').forEach(function (btn) {
            var m = btn.getAttribute('data-mode');
            btn.classList.toggle('is-active', m === state.mode);
            btn.setAttribute('aria-pressed', m === state.mode ? 'true' : 'false');
        });

        document.querySelectorAll('.theme-accent-btn').forEach(function (btn) {
            var a = btn.getAttribute('data-accent');
            btn.classList.toggle('is-active', a === state.accent);
            btn.setAttribute('aria-pressed', a === state.accent ? 'true' : 'false');
        });

        var trigger = document.getElementById('themeBtn');
        if (trigger) {
            var label =
                (state.mode === 'system' ? 'System' : state.mode === 'light' ? 'Light' : 'Dark') +
                ' · ' +
                state.accent;

            trigger.setAttribute('title', 'Theme: ' + label);
            trigger.setAttribute('aria-label', 'Choose theme (' + label + ')');

            // Swap the sun and moon icons according to the resolved mode.
            var sun = trigger.querySelector('[data-icon="sun"]');
            var moon = trigger.querySelector('[data-icon="moon"]');

            if (sun && moon) {
                sun.style.display = resolved === 'light' ? 'none' : 'block';
                moon.style.display = resolved === 'light' ? 'block' : 'none';
            }
        }
    }

    /* --------------------------------------------------------
       Panel Visibility
       -------------------------------------------------------- */
    function closePanel() {
        var panel = document.getElementById('themePanel');
        var btn = document.getElementById('themeBtn');

        if (panel) panel.classList.remove('is-open');
        if (btn) btn.setAttribute('aria-expanded', 'false');
    }

    function togglePanel() {
        var panel = document.getElementById('themePanel');
        var btn = document.getElementById('themeBtn');
        if (!panel || !btn) return;

        var open = !panel.classList.contains('is-open');

        panel.classList.toggle('is-open', open);
        btn.setAttribute('aria-expanded', open ? 'true' : 'false');

        if (open) {
            // Close any other open menus for a cleaner interaction.
            var profileMenu = document.getElementById('profileMenu');

            if (profileMenu) profileMenu.classList.remove('open', 'is-open', 'show');
        }
    }

    /* --------------------------------------------------------
       Event Binding
       --------------------------------------------------------
       Wires up the trigger, panel, outside-click and Escape-key
       handlers, and subscribes to OS theme changes so that
       "system" mode updates reactively.
       -------------------------------------------------------- */
    function bind() {
        var btn = document.getElementById('themeBtn');
        var panel = document.getElementById('themePanel');
        if (!btn || !panel) return;

        btn.addEventListener('click', function (e) {
            e.stopPropagation();
            togglePanel();
        });

        panel.addEventListener('click', function (e) {
            e.stopPropagation();

            var modeBtn = e.target.closest('.theme-mode-btn');
            if (modeBtn) {
                setMode(modeBtn.getAttribute('data-mode'));
                return;
            }

            var accentBtn = e.target.closest('.theme-accent-btn');
            if (accentBtn) {
                setAccent(accentBtn.getAttribute('data-accent'));
            }
        });

        document.addEventListener('click', function () {
            closePanel();
        });

        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') closePanel();
        });

        // React to OS-level theme changes while in "system" mode.
        try {
            var mq = window.matchMedia('(prefers-color-scheme: light)');
            var onChange = function () {
                if (getState().mode === 'system') {
                    applyTheme('system', getState().accent);
                    syncUI();
                }
            };

            if (mq.addEventListener) mq.addEventListener('change', onChange);
            else if (mq.addListener) mq.addListener(onChange);
        } catch (e) { /* Ignore environments without matchMedia support. */ }

        syncUI();
    }

    /* --------------------------------------------------------
       Bootstrapping
       --------------------------------------------------------
       Apply the persisted theme immediately — the inline boot
       script may already have run — then bind UI interactions
       once the DOM is ready.
       -------------------------------------------------------- */
    applyTheme(getState().mode, getState().accent);

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bind);
    } else {
        bind();
    }

    /* --------------------------------------------------------
       Public API
       --------------------------------------------------------
       Exposed as `window.DevHubTheme` for programmatic control.
       -------------------------------------------------------- */
    window.DevHubTheme = {
        setMode: setMode,
        setAccent: setAccent,
        getState: function () {
            var s = getState();

            return {
                mode: s.mode,
                accent: s.accent,
                resolved: resolveMode(s.mode)
            };
        }
    };
})();

/**
 * Copyright (c) 2026 Sobhan Rasoulzadeh Asl (Sobhan-SRZA / Mr. Sinre)
 *
 * Licensed under the BSD 3-Clause License.
 * See the LICENSE file in the project root for license information.
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */