/* ============================================================
   Public Projects List
   ============================================================
   Renders the public project catalog with debounced search,
   sorting, and pagination. Cards are keyboard-accessible and
   navigate to the project detail page when activated.
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
    const $ = (selector, root = document) => root.querySelector(selector);

    /* --------------------------------------------------------
       View State
       --------------------------------------------------------
       Centralised state that drives the list query and pagination.
       -------------------------------------------------------- */
    const state = {
        search: '',
        sort: 'recent',
        page: 1,
        limit: 20,
        totalPages: 1,
        total: 0,
    };

    const grid = $('#projectsGrid');
    const meta = $('#projectsMeta');
    const pagination = $('#pagination');
    const searchEl = $('#searchProjects');
    const sortEl = $('#sortProjects');

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

    /* Abbreviate large numbers using K/M suffixes. */
    function formatNumber(n) {
        n = Number(n) || 0;

        if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
        if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';

        return String(n);
    }

    /* Convert a hex colour into an rgba() string with the given alpha. */
    function hexA(hex, a) {
        if (!hex) return `rgba(96,165,250,${a})`;

        const h = String(hex).replace('#', '');
        if (h.length < 6) return `rgba(96,165,250,${a})`;

        const r = parseInt(h.slice(0, 2), 16);
        const g = parseInt(h.slice(2, 4), 16);
        const b = parseInt(h.slice(4, 6), 16);

        return `rgba(${r},${g},${b},${a})`;
    }

    /**
     * Produce the markup for a single project card. Up to three tags
     * are displayed, with an overflow indicator when more exist.
     */
    function renderCard(p) {
        const cover = p.images?.[0]?.url;
        const coverStyle = cover
            ? `background-image:url('${escapeHtml(cover)}')`
            : '';

        const owner = p.owner || {};
        const ownerName = owner.name || owner.username || '—';

        const tags = (p.tags || []).slice(0, 3);
        const moreTags = Math.max(0, (p.tags || []).length - 3);

        const stats = [];
        if (p.githubData?.stars) stats.push(`<span class="pc__stat">⭐ ${formatNumber(p.githubData.stars)}</span>`);
        if (p.downloads) stats.push(`<span class="pc__stat">⬇ ${formatNumber(p.downloads)}</span>`);
        if (p.rating) stats.push(`<span class="pc__stat">★ ${Number(p.rating).toFixed(1)}</span>`);

        return `
        <a class="pc" href="/projects/${escapeHtml(p.slug)}" role="link" tabindex="0">
            <div class="pc__cover" style="${coverStyle}">
                ${!cover ? `<span class="pc__cover-initial">${escapeHtml((p.title || '?')[0])}</span>` : ''}
            </div>
            <div class="pc__body">
                <h3 class="pc__title">${escapeHtml(p.title)}</h3>
                <p class="pc__desc">${escapeHtml(p.shortDescription || '')}</p>
                ${tags.length ? `<div class="pc__tags">${tags.map((t) =>
            `<span class="pc__tag" style="background:${hexA(t.color, 0.1)};color:${t.color || 'var(--accent)'};border-color:${hexA(t.color, 0.25)}">${escapeHtml(t.name)}</span>`
        ).join('')}${moreTags ? `<span class="pc__tag pc__tag--more">+${moreTags}</span>` : ''}</div>` : ''}
                <div class="pc__footer">
                    <div class="pc__owner">
                        <span class="pc__owner-name">${escapeHtml(ownerName)}</span>
                    </div>
                    ${stats.length ? `<div class="pc__stats">${stats.join('')}</div>` : ''}
                </div>
            </div>
        </a>`;
    }

    /**
     * Attach navigation handlers to the rendered cards. Clicks on
     * nested interactive elements (links, buttons) are ignored, and
     * Enter/Space activate the card for keyboard users.
     */
    function bindCards() {
        grid.querySelectorAll('.pc[data-href]').forEach((card) => {
            const go = () => { location.href = card.dataset.href; };

            card.addEventListener('click', (e) => {
                if (e.target.closest('a, button')) return;
                go();
            });

            card.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    go();
                }
            });
        });
    }

    /**
     * Render the pagination controls, showing up to seven numbered
     * buttons with a sliding window around the current page.
     */
    function renderPagination() {
        if (state.totalPages <= 1) {
            pagination.innerHTML = "";

            return;
        }

        const cur = state.page;
        const total = state.totalPages;
        const pages = [];

        if (total <= 7) {
            for (let i = 1; i <= total; i++)
                pages.push(i);
        } else {
            pages.push(1);
            if (cur > 3)
                pages.push("...");

            for (let i = Math.max(2, cur - 1); i <= Math.min(total - 1, cur + 1); i++)
                pages.push(i);

            if (cur < total - 2)
                pages.push("...");

            pages.push(total);
        }

        pagination.innerHTML = `
            <button class="page-btn" ${cur === 1 ? "disabled" : ""} data-page="${cur - 1}">Previous</button>
            ${pages.map((p) => p === "..."
            ? `<span class="page-btn" style="cursor:default;border:none;background:transparent">…</span>`
            : `<button class="page-btn ${p === cur ? "active" : ""}" data-page="${p}">${p}</button>`
        ).join("")}
            <button class="page-btn" ${cur === total ? "disabled" : ""} data-page="${cur + 1}">Next</button>
        `;

        pagination.querySelectorAll("[data-page]").forEach((btn) => {
            btn.addEventListener("click", () => {
                const p = Number(btn.dataset.page);

                if (p >= 1 && p <= total && p !== cur) {
                    state.page = p;
                    load();
                    window.scrollTo({ top: 0, behavior: "smooth" });
                }
            });
        });
    }

    /**
     * Fetch and render the current page of projects using the active
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

            if (state.search) params.set('search', state.search);

            const data = await api(`/api/projects?${params}`);
            const projects = data.projects || [];

            state.totalPages = data.pagination?.pages || 1;
            state.total = data.pagination?.total || projects.length;

            if (meta) {
                meta.textContent = state.total
                    ? `${state.total.toLocaleString('en-US')} projects`
                    : 'No projects found';
            }

            if (!projects.length) {
                grid.innerHTML = `<div class="list-empty">No projects matched the current filter.</div>`;
            } else {
                grid.innerHTML = projects.map(renderCard).join('');
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