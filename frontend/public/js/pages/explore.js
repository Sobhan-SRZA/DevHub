/* ============================================================
   Explore Page
   ============================================================
   Renders the project discovery view with tag-type filters,
   sorting, debounced search, and paginated results. Project
   cards are keyboard-accessible links.
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
    const $ = (selector, root = document) => root.querySelector(selector);
    const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

    /* ---------------- View State ----------------
       Centralised state that drives the explore query.
       ---------------- */
    const state = {
        sort: 'trending',
        window: '7d',
        search: '',
        tag: '',
        tagType: '',
        page: 1,
        limit: 20,
        totalPages: 1,
    };

    const grid = $('#exploreGrid');
    const pagination = $('#explorePagination');
    const meta = $('#exploreMeta');
    const typesEl = $('#exploreTypes');

    /* ---------------- API Helper ----------------
       Fetch JSON from the API; converts non-2xx responses into
       errors carrying the server message.
       ---------------- */
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

    /* ---------------- Tag-Type Filter Chips ----------------
       Load tag categories and render them as filter chips. The
       first chip ("All") clears the active tag-type filter.
       ---------------- */
    async function loadTypes() {
        try {
            const data = await api('/api/tag-types');
            const types = data.types || [];

            typesEl.innerHTML = `
                <button type="button" class="ex-chip active" data-type="">All</button>
                ${types.map((t) => `
                    <button type="button" class="ex-chip" data-type="${t._id}" style="--c:${t.color}">
                        ${t.icon || ''} ${escapeHtml(t.name)}
                    </button>
                `).join('')}
            `;

            typesEl.querySelectorAll('.ex-chip').forEach((b) => {
                b.addEventListener('click', () => {
                    typesEl.querySelectorAll('.ex-chip').forEach((x) => x.classList.remove('active'));
                    b.classList.add('active');

                    state.tagType = b.dataset.type;
                    state.page = 1;
                    load();
                });
            });
        } catch { /* Non-critical — silently ignore failures. */ }
    }

    /* ---------------- Load Explore Results ----------------
       Fetch the paginated project list matching the current
       sort, search, tag, and tag-type filters, then render the
       grid, meta line, and pagination.
       ---------------- */
    async function load() {
        grid.innerHTML = `<div class="home-loading" style="grid-column:1/-1"><div class="home-loading__spinner"></div></div>`;

        try {
            const params = new URLSearchParams({
                sort: state.sort,
                page: state.page,
                limit: state.limit,
            });

            // The time window applies only to time-sensitive sorts.
            if (state.window && (state.sort === 'trending' || state.sort === 'hot')) {
                params.set('window', state.window);
            }

            if (state.search) params.set('search', state.search);
            if (state.tag) params.set('tag', state.tag);
            if (state.tagType) params.set('tagType', state.tagType);

            const data = await api(`/api/projects/explore?${params}`);

            renderGrid(data.projects || []);
            renderPagination(data.pagination);
            renderMeta(data);

            /* Make each card behave as a keyboard-accessible link. */
            grid.querySelectorAll('.pc[data-href]').forEach((card) => {
                card.setAttribute('role', 'link');
                card.setAttribute('tabindex', '0');
                card.style.cursor = 'pointer';

                const go = () => { location.href = card.dataset.href; };

                card.addEventListener('click', (e) => {
                    if (e.target.closest('a, button')) return;
                    go();
                });

                card.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        if (!e.target.closest('a, button')) go();
                    }
                });
            });
        } catch (err) {
            grid.innerHTML = `
                <div class="explore-empty">
                    <div class="explore-empty__icon">⚠️</div>
                    <h3 class="explore-empty__title">Failed to load</h3>
                    <p class="explore-empty__sub">${escapeHtml(err.message || '')}</p>
                </div>
            `;
        }
    }

    /* Render the project grid, or an empty state when no results match. */
    function renderGrid(projects) {
        if (!projects.length) {
            grid.innerHTML = `
                <div class="explore-empty">
                    <div class="explore-empty__icon">🔍</div>
                    <h3 class="explore-empty__title">No results found</h3>
                    <p class="explore-empty__sub">Adjust the filters or try a different search term.</p>
                </div>
            `;
            return;
        }

        grid.innerHTML = projects.map(renderCard).join('');
    }

    /* Render the result count and active sort label. */
    function renderMeta(data) {
        const total = data.pagination?.total || 0;

        const sortLabels = {
            trending: 'Trending this week',
            hot: 'Popular today',
            'top-rated': 'Top rated',
            'top-downloaded': 'Most downloaded',
            new: 'Newest',
        };

        meta.innerHTML = `
            <span>${formatNumber(total)} projects — sorted by: <strong style="color:#ddd">${sortLabels[state.sort] || state.sort}</strong></span>
            ${data.cached ? '<span style="color:#666; font-size:0.75rem">⚡ cache</span>' : ''}
        `;
    }

    /* Render pagination controls with a sliding page window. */
    function renderPagination(p) {
        if (!p || p.pages <= 1) {
            pagination.innerHTML = '';
            return;
        }

        const cur = p.page;
        const total = p.pages;
        const pages = [];

        if (total <= 7) {
            for (let i = 1; i <= total; i++) pages.push(i);
        } else {
            pages.push(1);

            if (cur > 3) pages.push('...');

            for (let i = Math.max(2, cur - 1); i <= Math.min(total - 1, cur + 1); i++) {
                pages.push(i);
            }

            if (cur < total - 2) pages.push('...');

            pages.push(total);
        }

        pagination.innerHTML = `
            <button class="page-btn" ${cur === 1 ? 'disabled' : ''} data-page="${cur - 1}">Previous</button>
            ${pages.map((pg) => pg === '...'
            ? `<span class="page-btn" style="cursor:default;border:none;background:transparent">…</span>`
            : `<button class="page-btn ${pg === cur ? 'active' : ''}" data-page="${pg}">${pg}</button>`
        ).join('')}
            <button class="page-btn" ${cur === total ? 'disabled' : ''} data-page="${cur + 1}">Next</button>
        `;

        pagination.querySelectorAll('[data-page]').forEach((b) => {
            b.addEventListener('click', () => {
                const pg = Number(b.dataset.page);

                if (pg >= 1 && pg <= total && pg !== cur) {
                    state.page = pg;
                    load();
                    window.scrollTo({ top: 200, behavior: 'smooth' });
                }
            });
        });
    }

    /* ---------------- Project Card ----------------
       Render a single project card with cover image, badges,
       tags, owner, and stats.
       ---------------- */
    function renderCard(p) {
        const owner = p.owner || {};
        const ownerName = owner.name || owner.username || 'User';
        const ownerInitial = ownerName.charAt(0).toUpperCase();

        const cover = p.images?.[0]?.url || '';
        const tags = (p.tags || []).slice(0, 3);
        const moreTags = (p.tags || []).length - tags.length;

        // Derived badges: recent and "hot" indicators.
        const now = Date.now();
        const ageHours = (now - new Date(p.createdAt).getTime()) / 3600000;
        const isNew = ageHours < 72;
        const isHot = (p.githubData?.stars || 0) > 50 || (p.downloads || 0) > 100;

        const ownerAvatarStyle = owner.avatar?.url
            ? `background-image:url('${escapeHtml(owner.avatar.url)}');background-size:cover;background-position:center;`
            : '';

        const coverStyle = cover ? `background-image:url('${escapeHtml(cover)}');` : '';
        const initial = !cover
            ? `<span class="pc__cover-initial">${escapeHtml((p.title || '?')[0])}</span>`
            : '';

        const badges = [];
        if (p.featured) badges.push('<span class="pc__badge pc__badge--featured">★ Featured</span>');
        if (isHot) badges.push('<span class="pc__badge pc__badge--hot">🔥</span>');
        if (isNew && !isHot) badges.push('<span class="pc__badge pc__badge--new">New</span>');

        const tagsHtml = tags.map((t) => `
            <span class="pc__tag" style="background:${hexA(t.color, 0.1)}; color:${t.color}; border-color:${hexA(t.color, 0.25)}">
                ${escapeHtml(t.name)}
            </span>
        `).join('');

        const stats = [];

        if (p.githubData?.stars) {
            stats.push(`<span class="pc__stat pc__stat--star">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
                ${formatNumber(p.githubData.stars)}
            </span>`);
        }

        if (p.downloads) {
            stats.push(`<span class="pc__stat pc__stat--download">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                ${formatNumber(p.downloads)}
            </span>`);
        }

        if (p.rating) {
            stats.push(`<span class="pc__stat pc__stat--rating">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
                ${p.rating.toFixed(1)}
            </span>`);
        }

        return `
            <a class="pc" href="/projects/${p.slug}">
                <div class="pc__cover" style="${coverStyle}">
                    ${initial}
                    ${badges.length ? `<div class="pc__badges">${badges.join('')}</div>` : ''}
                </div>

                <div class="pc__body">
                    <h3 class="pc__title">${escapeHtml(p.title)}</h3>
                    <p class="pc__desc">${escapeHtml(p.shortDescription || '')}</p>

                    ${tags.length ? `
                        <div class="pc__tags">
                            ${tagsHtml}
                            ${moreTags > 0 ? `<span class="pc__tag pc__tag--more">+${moreTags}</span>` : ''}
                        </div>
                    ` : ''}

                    <div class="pc__footer">
                        <div class="pc__owner">
                            <div class="pc__owner-avatar" style="${ownerAvatarStyle}">
                                ${!owner.avatar?.url ? ownerInitial : ''}
                            </div>
                            <span class="pc__owner-name">${escapeHtml(ownerName)}</span>
                        </div>

                        ${stats.length ? `<div class="pc__stats">${stats.join('')}</div>` : ''}
                    </div>
                </div>
            </a>
        `;
    }

    /* ---------------- Sort Tabs ----------------
       Activate the clicked sort option and reload the results.
       ---------------- */
    $$('#exploreSort .ex-sort').forEach((btn) => {
        btn.addEventListener('click', () => {
            $$('#exploreSort .ex-sort').forEach((b) => b.classList.remove('active'));
            btn.classList.add('active');

            state.sort = btn.dataset.sort;
            state.window = btn.dataset.window || null;
            state.page = 1;

            load();
        });
    });

    /* ---------------- Debounced Search ----------------
       Wait for typing to settle before issuing a request.
       ---------------- */
    let searchTimer;

    $('#exploreSearch').addEventListener('input', (e) => {
        clearTimeout(searchTimer);

        searchTimer = setTimeout(() => {
            state.search = e.target.value.trim();
            state.page = 1;
            load();
        }, 400);
    });

    /* ---------------- URL Sync ----------------
       Hydrate the initial view state from the query string and
       reflect it in the UI controls.
       ---------------- */
    function readQuery() {
        const p = new URLSearchParams(location.search);

        if (p.get('sort')) state.sort = p.get('sort');
        if (p.get('tag')) state.tag = p.get('tag');
        if (p.get('tagType')) state.tagType = p.get('tagType');
        if (p.get('search')) state.search = p.get('search');
        if (p.get('window')) state.window = p.get('window');

        // Sync the sort tabs.
        $$('#exploreSort .ex-sort').forEach((b) => {
            b.classList.toggle('active', b.dataset.sort === state.sort);
        });

        if (state.search) $('#exploreSearch').value = state.search;
    }

    /* ---------------- Initialization ---------------- */
    (async () => {
        readQuery();
        await loadTypes();
        await load();
    })();

    /* ---------------- Helpers ---------------- */

    /* Abbreviate large numbers using K/M suffixes. */
    function formatNumber(n) {
        n = Number(n) || 0;

        if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
        if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';

        return String(n);
    }

    /* Convert a hex colour to an rgba() string with the given alpha. */
    function hexA(hex, a) {
        if (!hex) return `rgba(110,187,255,${a})`;

        const h = hex.replace('#', '');
        const r = parseInt(h.substr(0, 2), 16);
        const g = parseInt(h.substr(2, 2), 16);
        const b = parseInt(h.substr(4, 2), 16);

        return `rgba(${r},${g},${b},${a})`;
    }

    /* Escape user-supplied strings before interpolating them into HTML. */
    function escapeHtml(s) {
        if (s == null) return '';

        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }
});

/**
 * Copyright (c) 2026 Sobhan Rasoulzadeh Asl (Sobhan-SRZA / Mr. Sinre)
 *
 * Licensed under the BSD 3-Clause License.
 * See the LICENSE file in the project root for license information.
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */