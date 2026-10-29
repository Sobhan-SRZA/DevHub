/* ============================================================
   Public Users Directory
   ============================================================
   Renders the public directory of developers with debounced
   search, sorting, and pagination. User cards are keyboard-
   accessible links to the corresponding profile pages.
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
    const $ = (selector, root = document) => root.querySelector(selector);

    /* --------------------------------------------------------
       View State
       --------------------------------------------------------
       Centralised state that drives the directory query and
       pagination.
       -------------------------------------------------------- */
    const state = {
        search: '',
        sort: 'recent',
        page: 1,
        limit: 24,
        totalPages: 1,
        total: 0,
    };

    const grid = $('#usersGrid');
    const meta = $('#usersMeta');
    const pagination = $('#usersPagination');
    const searchEl = $('#usersSearch');
    const sortEl = $('#usersSort');

    let searchTimer = null;

    /**
     * Fetch JSON from the given API path. Non-2xx responses are
     * converted into thrown errors carrying the server message.
     */
    async function api(path) {
        const res = await fetch(path, { credentials: 'include' });

        let data = null;
        try {
            data = await res.json();
        } catch { /* Ignore JSON parse failures. */ }

        if (!res.ok) {
            throw new Error(data?.message || 'Error');
        }

        return data;
    }

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
     * Produce the markup for a single user card, including avatar,
     * display name, username, a truncated bio, and the project count.
     */
    function renderUser(u) {
        const name = u.name || u.username || 'User';
        const initial = (name[0] || '?').toUpperCase();

        const avatarStyle = u.avatar?.url
            ? `background-image:url('${escapeHtml(u.avatar.url)}')`
            : '';

        // Strip common Markdown markers from the bio before truncating.
        const bio = (u.bio || '').replace(/[#*_`]/g, '').slice(0, 120);
        const projects = u.projectsCount ?? u.stats?.projects ?? 0;

        return `
        <article class="uc" data-href="/users/${escapeHtml(u.username)}" role="link" tabindex="0">
            <div class="uc__top">
                <div class="uc__avatar" style="${avatarStyle}">${avatarStyle ? '' : escapeHtml(initial)}</div>
                <div>
                    <p class="uc__name">${escapeHtml(name)}</p>
                    <div class="uc__username">@${escapeHtml(u.username || '')}</div>
                </div>
            </div>
            ${bio ? `<p class="uc__bio">${escapeHtml(bio)}</p>` : ''}
            <div class="uc__stats">
                <span>${Number(projects).toLocaleString('en-US')} project${Number(projects) === 1 ? '' : 's'}</span>
            </div>
        </article>`;
    }

    /**
     * Attach navigation handlers to the rendered user cards. Enter
     * and Space activate a card for keyboard users.
     */
    function bindCards() {
        grid.querySelectorAll('.uc[data-href]').forEach((card) => {
            const go = () => { location.href = card.dataset.href; };

            card.addEventListener('click', go);

            card.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    go();
                }
            });
        });
    }

    /**
     * Render the pagination controls, showing a sliding window of
     * up to six numbered pages around the current page.
     */
    function renderPagination() {
        if (!pagination) return;

        if (state.totalPages <= 1) {
            pagination.innerHTML = '';
            return;
        }

        const pages = [];

        if (state.page > 1) {
            pages.push(`<button type="button" data-page="${state.page - 1}">Previous</button>`);
        }

        const start = Math.max(1, state.page - 2);
        const end = Math.min(state.totalPages, start + 5);

        for (let i = start; i <= end; i++) {
            pages.push(`<button type="button" data-page="${i}" class="${i === state.page ? 'active' : ''}">${i}</button>`);
        }

        if (state.page < state.totalPages) {
            pages.push(`<button type="button" data-page="${state.page + 1}">Next</button>`);
        }

        pagination.innerHTML = pages.join('');

        pagination.querySelectorAll('button').forEach((btn) => {
            btn.addEventListener('click', () => {
                state.page = Number(btn.dataset.page);
                load();
                window.scrollTo({ top: 0, behavior: 'smooth' });
            });
        });
    }

    /**
     * Fetch and render the current page of users using the active
     * search, sort, and pagination state.
     */
    async function load() {
        grid.innerHTML = `<div class="home-loading" style="grid-column:1/-1"><div class="home-loading__spinner"></div></div>`;

        try {
            const params = new URLSearchParams({
                sort: state.sort,
                page: String(state.page),
                limit: String(state.limit),
            });

            if (state.search) params.set('q', state.search);

            const data = await api(`/api/users?${params}`);
            const users = data.users || [];

            state.totalPages = data.pagination?.pages || 1;
            state.total = data.pagination?.total || users.length;

            if (meta) {
                meta.textContent = state.total
                    ? `${state.total.toLocaleString('en-US')} users`
                    : 'No users found';
            }

            if (!users.length) {
                grid.innerHTML = `<div class="list-empty">No users found.</div>`;
            } else {
                grid.innerHTML = users.map(renderUser).join('');
                bindCards();
            }

            renderPagination();
        } catch (err) {
            grid.innerHTML = `<div class="list-empty">Error: ${escapeHtml(err.message || '')}</div>`;
        }
    }

    /* Debounce search input to avoid excessive network requests. */
    searchEl?.addEventListener('input', () => {
        clearTimeout(searchTimer);

        searchTimer = setTimeout(() => {
            state.search = searchEl.value.trim();
            state.page = 1;
            load();
        }, 320);
    });

    /* Reset to the first page whenever the sort order changes. */
    sortEl?.addEventListener('change', () => {
        state.sort = sortEl.value;
        state.page = 1;
        load();
    });

    load();
});

/**
 * Copyright (c) 2026 Sobhan Rasoulzadeh Asl (Sobhan-SRZA / Mr. Sinre)
 *
 * Licensed under the BSD 3-Clause License.
 * See the LICENSE file in the project root for license information.
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */