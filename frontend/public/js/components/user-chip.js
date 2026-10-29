/* ============================================================
   User Chip — Profile Link with Avatar and Name
   ============================================================
   Renders a compact, clickable user identity element containing
   an avatar (or initial fallback) and an optional display name.
   When the user has a username, the chip becomes a link to their
   public profile.
   ============================================================ */

(function (global) {
    'use strict';

    /**
     * Escape user-supplied strings before interpolating them into
     * HTML to prevent markup injection.
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
     * Build a user chip element.
     *
     * The chip renders the user's avatar (or their initial as a
     * fallback) and, optionally, their display name. When a
     * username is available, the chip is emitted as an anchor that
     * links to the user's public profile; otherwise, it is emitted
     * as a non-interactive span.
     *
     * @param {Object} user
     *   The user record, shaped as `{ _id, name, username, avatar: { url } }`.
     * @param {Object} opts
     *   - size:      Avatar size in pixels.
     *   - showName:  Whether to render the display name.
     *   - className: Extra classes applied to the root element.
     * @returns {string} The chip's HTML markup.
     */
    function userChip(user, opts = {}) {
        const { size = 26, showName = true, className = '' } = opts;

        const name = user?.name || user?.username || 'User';
        const initial = name.trim().charAt(0).toUpperCase();

        const url = user?.avatar?.url;
        const username = user?.username;

        // Apply the avatar as a background image when available.
        const style = url
            ? `background-image:url('${escapeHtml(url)}');background-size:cover;background-position:center;`
            : '';

        const inner = `
            <span class="user-chip__avatar" style="width:${size}px;height:${size}px;${style}">
                ${!url ? escapeHtml(initial) : ''}
            </span>
            ${showName ? `<span class="user-chip__name">${escapeHtml(name)}</span>` : ''}
        `;

        // Emit a link when a username is present; stop propagation so
        // parent click handlers (e.g., card navigation) do not fire.
        if (username) {
            return `<a href="/users/${encodeURIComponent(username)}" class="user-chip ${className}" onclick="event.stopPropagation();">${inner}</a>`;
        }

        return `<span class="user-chip ${className}">${inner}</span>`;
    }

    global.userChip = userChip;
})(window);

/**
 * Copyright (c) 2026 Sobhan Rasoulzadeh Asl (Sobhan-SRZA / Mr. Sinre)
 *
 * Licensed under the BSD 3-Clause License.
 * See the LICENSE file in the project root for license information.
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */