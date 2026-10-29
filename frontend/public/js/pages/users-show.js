/* ============================================================
   Public Profile Page
   ============================================================
   Renders a developer's public profile with their projects
   and the reviews their projects have received. The view is
   tabbed and paginated per section.
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
    const $ = (selector) => document.querySelector(selector);
    const $$ = (selector) => Array.from(document.querySelectorAll(selector));

    const root = $('#pubProfile');
    const idOrUsername = root?.dataset.idOrUsername;
    if (!idOrUsername) return;

    /* --------------------------------------------------------
       View State
       --------------------------------------------------------
       Tracks the profile owner, the current viewer, whether the
       viewer owns this profile, and the pagination state of each
       tabbed section.
       -------------------------------------------------------- */
    const state = {
        user: null,
        currentUser: null,
        isOwn: false,
        projects: { page: 1, sort: 'recent', totalPages: 1 },
        reviews: { page: 1, totalPages: 1 },
        activeTab: 'projects',
    };

    /* ============================================================
       API Helper
       ============================================================
       Fetch JSON from the API; non-2xx responses are converted
       into Error objects preserving the server payload.
       ============================================================ */
    async function api(path) {
        const res = await fetch(path, { credentials: 'include' });

        let data = null;
        try {
            data = await res.json();
        } catch { /* Ignore JSON parse failures. */ }

        if (!res.ok) {
            const err = new Error(data?.message || 'Error');
            Object.assign(err, data || {}, { status: res.status });
            throw err;
        }

        return data;
    }

    /* ============================================================
       Helpers
       ============================================================ */

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

    /* Abbreviate large numbers using K/M suffixes. */
    function formatNumber(n) {
        n = Number(n) || 0;

        if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
        if (n >= 1000) return (n / 1000).toFixed(1) + 'K';

        return String(n);
    }

    /* Format an ISO date as a medium-length English date. */
    function formatDate(d) {
        if (!d) return '—';

        try {
            return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(new Date(d));
        } catch {
            return '—';
        }
    }

    /* Render a human-friendly relative time string (e.g. "3 days ago"). */
    function relativeTime(d) {
        if (!d) return '';

        const diff = Date.now() - new Date(d).getTime();
        const s = Math.floor(diff / 1000);

        if (s < 60) return 'just now';

        const m = Math.floor(s / 60);
        if (m < 60) return `${m} minute${m === 1 ? '' : 's'} ago`;

        const h = Math.floor(m / 60);
        if (h < 24) return `${h} hour${h === 1 ? '' : 's'} ago`;

        const days = Math.floor(h / 24);
        if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;

        const months = Math.floor(days / 30);
        return `${months} month${months === 1 ? '' : 's'} ago`;
    }

    /* Render Markdown via the shared parser, falling back to escaped text. */
    function renderMarkdown(text) {
        if (typeof window.parseMarkdown === 'function') {
            return window.parseMarkdown(text || '');
        }

        // Fallback — escape the text and preserve line breaks.
        return escapeHtml(text || '').replace(/\n/g, '<br>');
    }

    /* ============================================================
       Profile Loading
       ============================================================
       Resolve the current viewer (if any) and the profile owner
       in sequence, then render the header and load the active
       tab's data.
       ============================================================ */
    async function loadProfile() {
        try {
            /* ---------- Current viewer (optional) ---------- */
            try {
                const me = await api('/api/auth/me');
                state.currentUser = me.user;
            } catch { /* Guest — no authenticated user. */ }

            /* ---------- Profile owner ---------- */
            const data = await api(`/api/users/${encodeURIComponent(idOrUsername)}`);
            state.user = data.user;

            state.isOwn = !!(
                state.currentUser &&
                String(state.currentUser.id) === String(data.user.id)
            );

            renderProfile();
            showContent();

            document.title = `${data.user.name || data.user.username} — Profile`;

            /* ---------- Load the active tab's data ---------- */
            loadProjects();
        } catch (err) {
            showError(err);
        }
    }

    /* Populate the profile header, statistics, and tab counters. */
    function renderProfile() {
        const u = state.user;

        /* ---------- Avatar ---------- */
        const avatar = $('#ppAvatar');
        const hasAvatar = !!u.avatar?.url;

        if (hasAvatar) {
            avatar.style.backgroundImage = `url('${escapeHtml(u.avatar.url)}')`;
            avatar.textContent = '';
        } else {
            avatar.style.backgroundImage = '';
            avatar.style.background = 'linear-gradient(135deg, #007bff, #6ebbff)';
            avatar.textContent = (u.name || u.username || '?').charAt(0).toUpperCase();
        }

        /* ---------- Name and username ---------- */
        $('#ppName').textContent = u.name || u.username || 'User';
        $('#ppUsername').textContent = '@' + (u.username || '—');
        $('#ppJoined').textContent = `Joined ${formatDate(u.createdAt)}`;

        /* ---------- Role badge ---------- */
        const roleEl = $('#ppRole');
        const roleMap = { user: 'User', admin: 'Admin', developer: 'Developer' };

        roleEl.textContent = roleMap[u.role] || 'User';
        roleEl.dataset.role = u.role || 'user';

        /* ---------- Verified indicator ---------- */
        if (u.emailVerified) {
            $('#ppVerified').style.display = '';
        }

        /* ---------- Biography ---------- */
        const bioEl = $('#ppBio');
        if (u.bio && u.bio.trim()) {
            bioEl.classList.add('md-preview-content');
            bioEl.innerHTML = renderMarkdown(u.bio);
        } else {
            bioEl.textContent = '';
            bioEl.style.display = 'none';
        }

        /* ---------- Statistics ---------- */
        $('#statProjects').textContent = formatNumber(u.stats.projects);
        $('#statReviews').textContent = formatNumber(u.stats.reviewsReceived);
        $('#statDownloads').textContent = formatNumber(u.stats.downloads);
        $('#statRating').textContent = (u.stats.rating || 0).toFixed(1);

        $('#tabProjectsCount').textContent = formatNumber(u.stats.projects);
        $('#tabReviewsCount').textContent = formatNumber(u.stats.reviewsReceived);

        /* ---------- Owner-only actions ---------- */
        if (state.isOwn) {
            $('#ppActions').style.display = '';
        }
    }

    /* Reveal the profile content once data has been loaded. */
    function showContent() {
        $('#ppLoading').style.display = 'none';
        $('#ppContent').style.display = '';
    }

    /* Show the error panel with messaging appropriate to the status code. */
    function showError(err) {
        $('#ppLoading').style.display = 'none';
        $('#ppError').style.display = 'flex';

        if (err.status === 404) {
            $('#ppErrorTitle').textContent = 'User not found';
            $('#ppErrorSub').textContent = 'No user exists with that identifier.';
        } else {
            $('#ppErrorTitle').textContent = 'Failed to load';
            $('#ppErrorSub').textContent = err.message || '';
        }
    }

    /* ============================================================
       Tab Switching
       ============================================================
       Lazily loads each tab's data the first time it is opened.
       ============================================================ */
    $$('.pp-tab').forEach((tab) => {
        tab.addEventListener('click', () => {
            const t = tab.dataset.tab;
            if (t === state.activeTab) return;
            state.activeTab = t;

            $$('.pp-tab').forEach((x) => x.classList.toggle('active', x === tab));
            $$('.pp-panel').forEach((p) => p.classList.toggle('active', p.dataset.panel === t));

            if (t === 'projects' && !state.projects.loaded) loadProjects();
            if (t === 'reviews' && !state.reviews.loaded) loadReviews();
        });
    });

    /* ============================================================
       Projects Tab
       ============================================================ */
    async function loadProjects() {
        const grid = $('#ppProjectsGrid');
        grid.innerHTML = `<div class="pp-empty">Loading…</div>`;

        try {
            const params = new URLSearchParams({
                page: state.projects.page,
                sort: state.projects.sort,
                limit: 12,
            });

            const data = await api(`/api/users/${encodeURIComponent(idOrUsername)}/projects?${params}`);

            state.projects.loaded = true;
            state.projects.totalPages = data.pagination?.pages || 1;

            if (!data.projects.length) {
                grid.innerHTML = `<div class="pp-empty">
                    This user has not published any projects yet.
                </div>`;

                renderPagination('projects');
                return;
            }

            grid.innerHTML = data.projects.map(renderProjectCard).join('');
            renderPagination('projects');
        } catch (err) {
            grid.innerHTML = `<div class="pp-empty">Failed to load projects.</div>`;
        }
    }

    /* Render a single project card for the projects tab. */
    function renderProjectCard(p) {
        const cover = p.images?.[0]?.url;
        const initial = !cover ? escapeHtml((p.title || '?')[0].toUpperCase()) : '';
        const coverStyle = cover ? `background-image:url('${escapeHtml(cover)}')` : '';
        const stars = p.githubData?.stars || 0;

        return `
            <a class="pp-proj-card" href="/projects/${escapeHtml(p.slug || p._id)}">
                <div class="pp-proj-card__cover" style="${coverStyle}">
                    ${initial ? `<span class="pp-proj-card__initial">${initial}</span>` : ''}
                </div>
                <div class="pp-proj-card__body">
                    <h3 class="pp-proj-card__title">${escapeHtml(p.title)}</h3>
                    <p class="pp-proj-card__desc">${escapeHtml(p.shortDescription || '')}</p>
                    <div class="pp-proj-card__stats">
                        ${stars ? `
                            <span class="pp-proj-card__stat pp-proj-card__stat--star">
                                ⭐ ${formatNumber(stars)}
                            </span>
                        ` : ''}
                        <span class="pp-proj-card__stat pp-proj-card__stat--download">
                            ⬇ ${formatNumber(p.downloads || 0)}
                        </span>
                        ${p.reviewCount ? `
                            <span class="pp-proj-card__stat">💬 ${formatNumber(p.reviewCount)}</span>
                        ` : ''}
                    </div>
                </div>
            </a>
        `;
    }

    /* ============================================================
       Reviews Tab
       ============================================================
       Lists the reviews that other users have left on this
       developer's projects.
       ============================================================ */
    async function loadReviews() {
        const list = $('#ppReviewsList');
        list.innerHTML = `<div class="pp-empty">Loading…</div>`;

        try {
            const params = new URLSearchParams({
                page: state.reviews.page,
                limit: 10,
                sort: 'recent'
            });

            const data = await api(`/api/users/${encodeURIComponent(idOrUsername)}/reviews?${params}`);

            state.reviews.loaded = true;
            state.reviews.totalPages = data.pagination?.pages || 1;

            if (!data.reviews.length) {
                list.innerHTML = `
                    <div class="pp-empty">
                        No reviews have been submitted for this user's projects yet.
                    </div>
                `;

                renderPagination('reviews');
                return;
            }

            list.innerHTML = data.reviews.map(renderReviewCard).join('');
            renderPagination('reviews');
        } catch (err) {
            list.innerHTML = `<div class="pp-empty">Failed to load reviews.</div>`;
        }
    }

    /* Render a single review card, including the reviewer and project. */
    function renderReviewCard(r) {
        const reviewer = r.user || {};
        const p = r.project || {};

        /* ---------- Reviewer (author of the review) ---------- */
        const reviewerName = reviewer.name || reviewer.username || 'User';
        const reviewerInitial = reviewerName.trim().charAt(0).toUpperCase();

        const reviewerAvatarStyle = reviewer.avatar?.url
            ? `background-image:url('${escapeHtml(reviewer.avatar.url)}');background-size:cover;background-position:center;`
            : '';

        const reviewerLink = reviewer.username
            ? `/users/${encodeURIComponent(reviewer.username)}`
            : null;

        /* ---------- Project (the reviewed project) ---------- */
        const cover = p.images?.[0]?.url;
        const projectInitial = !cover ? escapeHtml((p.title || '?')[0].toUpperCase()) : '';
        const thumbStyle = cover ? `background-image:url('${escapeHtml(cover)}')` : '';

        const projectLink = p.slug
            ? `/projects/${encodeURIComponent(p.slug)}`
            : p._id
                ? `/projects/${p._id}`
                : '#';

        /* ---------- Star rating ---------- */
        const stars = Array.from({ length: 5 }, (_, i) =>
            i < Math.round(r.rating || 0)
                ? '<span style="color:#fbbf24">★</span>'
                : '<span style="color:#2a2a2a">★</span>'
        ).join('');

        /* ---------- Reviewer avatar (link when possible) ---------- */
        const avatarHtml = reviewerLink
            ? `<a href="${reviewerLink}" class="pp-review-card__reviewer-avatar" style="${reviewerAvatarStyle}" onclick="event.stopPropagation();">
                ${!reviewer.avatar?.url ? escapeHtml(reviewerInitial) : ''}
           </a>`
            : `<div class="pp-review-card__reviewer-avatar" style="${reviewerAvatarStyle}">
                ${!reviewer.avatar?.url ? escapeHtml(reviewerInitial) : ''}
           </div>`;

        /* ---------- Reviewer name (link when possible) ---------- */
        const nameHtml = reviewerLink
            ? `<a href="${reviewerLink}" class="pp-review-card__reviewer-name" onclick="event.stopPropagation();">${escapeHtml(reviewerName)}</a>`
            : `<span class="pp-review-card__reviewer-name">${escapeHtml(reviewerName)}</span>`;

        return `
            <article class="pp-review-card">

                <!-- Reviewer -->
                <div class="pp-review-card__head">
                    ${avatarHtml}
                    <div class="pp-review-card__reviewer-info">
                        ${nameHtml}
                        <span class="pp-review-card__date">${relativeTime(r.createdAt)}</span>
                    </div>
                    <div class="pp-review-card__stars">${stars}</div>
                </div>

                <!-- Reviewed project -->
                <a class="pp-review-card__project" href="${projectLink}" onclick="event.stopPropagation();">
                    <div class="pp-review-card__project-thumb" style="${thumbStyle}">${projectInitial}</div>
                    <div class="pp-review-card__project-info">
                        <span class="pp-review-card__project-label">About the project</span>
                        <div class="pp-review-card__project-title">${escapeHtml(p.title || '—')}</div>
                    </div>
                    <div class="pp-review-card__project-arrow">‹</div>
                </a>

                <!-- Review content -->
                ${r.title ? `<h4 class="pp-review-card__title">${escapeHtml(r.title)}</h4>` : ''}
                ${r.body ? `<p class="pp-review-card__body">${escapeHtml(r.body)}</p>` : ''}

                <!-- Satisfaction meter -->
                <div class="pp-review-card__satisfaction">
                    <span>Satisfaction</span>
                    <div class="pp-review-card__satisfaction-bar">
                        <div class="pp-review-card__satisfaction-fill" style="width:${r.satisfaction || 0}%"></div>
                    </div>
                    <span>${r.satisfaction || 0}%</span>
                </div>
            </article>
         `;
    }

    /* ============================================================
       Pagination
       ============================================================
       Renders a paginated control for either the projects or the
       reviews tab, with a sliding page window.
       ============================================================ */
    function renderPagination(which) {
        const el = which === 'projects' ? $('#ppProjectsPagination') : $('#ppReviewsPagination');
        const s = state[which === 'projects' ? 'projects' : 'reviews'];

        if (!s.totalPages || s.totalPages <= 1) {
            el.innerHTML = '';
            return;
        }

        const cur = s.page;
        const total = s.totalPages;
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

        el.innerHTML = `
            <button class="pp-page-btn" ${cur === 1 ? 'disabled' : ''} data-page="${cur - 1}">Previous</button>
            ${pages.map((p) => p === '...'
            ? `<span class="pp-page-btn" style="cursor:default;border:none;background:transparent">…</span>`
            : `<button class="pp-page-btn ${p === cur ? 'active' : ''}" data-page="${p}">${p}</button>`
        ).join('')}
            <button class="pp-page-btn" ${cur === total ? 'disabled' : ''} data-page="${cur + 1}">Next</button>
        `;

        el.querySelectorAll('[data-page]').forEach((b) => {
            b.addEventListener('click', () => {
                const pg = Number(b.dataset.page);

                if (pg >= 1 && pg <= total && pg !== cur) {
                    s.page = pg;

                    if (which === 'projects') loadProjects();
                    else loadReviews();
                }
            });
        });
    }

    /* ============================================================
       Initialization
       ============================================================ */
    loadProfile();
});

/**
 * Copyright (c) 2026 Sobhan Rasoulzadeh Asl (Sobhan-SRZA / Mr. Sinre)
 *
 * Licensed under the BSD 3-Clause License.
 * See the LICENSE file in the project root for license information.
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */