/* ============================================================
   User Chip — لینک پروفایل با آواتار و نام
   ============================================================ */
(function (global) {
    'use strict';

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
     * @param {Object} user  { _id, name, username, avatar: { url } }
     * @param {Object} opts  { size, showName, className }
     */
    function userChip(user, opts = {}) {
        const { size = 26, showName = true, className = '' } = opts;

        const name = user?.name || user?.username || 'کاربر';
        const initial = name.trim().charAt(0).toUpperCase();
        const url = user?.avatar?.url;
        const username = user?.username;

        const style = url
            ? `background-image:url('${escapeHtml(url)}');background-size:cover;background-position:center;`
            : '';

        const inner = `
            <span class="user-chip__avatar" style="width:${size}px;height:${size}px;${style}">
                ${!url ? escapeHtml(initial) : ''}
            </span>
            ${showName ? `<span class="user-chip__name">${escapeHtml(name)}</span>` : ''}
        `;

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