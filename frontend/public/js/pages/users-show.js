/* ============================================================
   Public Profile Page
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
    const $ = (s) => document.querySelector(s);
    const $$ = (s) => Array.from(document.querySelectorAll(s));

    const root = $('#pubProfile');
    const idOrUsername = root?.dataset.idOrUsername;
    if (!idOrUsername) return;

    const state = {
        user: null,
        currentUser: null,
        isOwn: false,
        projects: { page: 1, sort: 'recent', totalPages: 1 },
        reviews: { page: 1, totalPages: 1 },
        activeTab: 'projects',
    };

    /* ============================================================
       API
       ============================================================ */
    async function api(path) {
        const res = await fetch(path, { credentials: 'include' });
        let data = null;
        try { data = await res.json(); } catch { }
        if (!res.ok) {
            const err = new Error(data?.message || 'خطا');
            Object.assign(err, data || {}, { status: res.status });
            throw err;
        }
        return data;
    }

    /* ============================================================
       Helpers
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

    function formatNumber(n) {
        n = Number(n) || 0;
        if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
        if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
        return String(n);
    }

    function formatDate(d) {
        if (!d) return '—';
        try {
            return new Intl.DateTimeFormat('fa-IR', { dateStyle: 'medium' }).format(new Date(d));
        } catch { return '—'; }
    }

    function relativeTime(d) {
        if (!d) return '';
        const diff = Date.now() - new Date(d).getTime();
        const s = Math.floor(diff / 1000);
        if (s < 60) return 'همین الان';
        const m = Math.floor(s / 60);
        if (m < 60) return `${m} دقیقه پیش`;
        const h = Math.floor(m / 60);
        if (h < 24) return `${h} ساعت پیش`;
        const days = Math.floor(h / 24);
        if (days < 30) return `${days} روز پیش`;
        return `${Math.floor(days / 30)} ماه پیش`;
    }

    function renderMarkdown(text) {
        if (typeof window.parseMarkdown === 'function') {
            return window.parseMarkdown(text || '');
        }
        // fallback — escape + newlines
        return escapeHtml(text || '').replace(/\n/g, '<br>');
    }

    /* ============================================================
       Load profile
       ============================================================ */
    async function loadProfile() {
        try {
            /* ---------- current user (optional) ---------- */
            try {
                const me = await api('/api/auth/me');
                state.currentUser = me.user;
            } catch { /* guest */ }

            /* ---------- profile ---------- */
            const data = await api(`/api/users/${encodeURIComponent(idOrUsername)}`);
            state.user = data.user;

            state.isOwn = !!(state.currentUser && String(state.currentUser.id) === String(data.user.id));

            renderProfile();
            showContent();

            document.title = `${data.user.name || data.user.username} — پروفایل`;

            /* ---------- load active tab ---------- */
            loadProjects();
        } catch (err) {
            showError(err);
        }
    }

    function renderProfile() {
        const u = state.user;

        /* ---------- avatar ---------- */
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

        /* ---------- name / username ---------- */
        $('#ppName').textContent = u.name || u.username || 'کاربر';
        $('#ppUsername').textContent = '@' + (u.username || '—');
        $('#ppJoined').textContent = `عضو از ${formatDate(u.createdAt)}`;

        /* ---------- role ---------- */
        const roleEl = $('#ppRole');
        const roleMap = { user: 'کاربر', admin: 'ادمین', developer: 'دولوپر' };
        roleEl.textContent = roleMap[u.role] || 'کاربر';
        roleEl.dataset.role = u.role || 'user';

        /* ---------- verified ---------- */
        if (u.emailVerified) {
            $('#ppVerified').style.display = '';
        }

        /* ---------- bio ---------- */
        const bioEl = $('#ppBio');
        if (u.bio && u.bio.trim()) {
            bioEl.classList.add('md-preview-content');
            bioEl.innerHTML = renderMarkdown(u.bio);
        } else {
            bioEl.textContent = '';
            bioEl.style.display = 'none';
        }

        /* ---------- stats ---------- */
        $('#statProjects').textContent = formatNumber(u.stats.projects);
        $('#statReviews').textContent = formatNumber(u.stats.reviewsReceived);   // ← changed
        $('#statDownloads').textContent = formatNumber(u.stats.downloads);
        $('#statRating').textContent = (u.stats.rating || 0).toFixed(1);

        $('#tabProjectsCount').textContent = formatNumber(u.stats.projects);
        $('#tabReviewsCount').textContent = formatNumber(u.stats.reviewsReceived); // ← changed

        /* ---------- actions (own profile) ---------- */
        if (state.isOwn) {
            $('#ppActions').style.display = '';
        }
    }

    function showContent() {
        $('#ppLoading').style.display = 'none';
        $('#ppContent').style.display = '';
    }

    function showError(err) {
        $('#ppLoading').style.display = 'none';
        $('#ppError').style.display = 'flex';

        if (err.status === 404) {
            $('#ppErrorTitle').textContent = 'کاربر یافت نشد';
            $('#ppErrorSub').textContent = 'کاربری با این شناسه وجود ندارد';
        } else {
            $('#ppErrorTitle').textContent = 'خطا در بارگذاری';
            $('#ppErrorSub').textContent = err.message || '';
        }
    }

    /* ============================================================
       Tabs
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
       Projects
       ============================================================ */
    async function loadProjects() {
        const grid = $('#ppProjectsGrid');
        grid.innerHTML = `<div class="pp-empty">در حال بارگذاری…</div>`;

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
                    این کاربر هنوز پروژه‌ای منتشر نکرده است
                </div>`;
                renderPagination('projects');
                return;
            }

            grid.innerHTML = data.projects.map(renderProjectCard).join('');
            renderPagination('projects');
        } catch (err) {
            grid.innerHTML = `<div class="pp-empty">خطا در بارگذاری پروژه‌ها</div>`;
        }
    }

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
       Reviews
       ============================================================ */
    async function loadReviews() {
        const list = $('#ppReviewsList');
        list.innerHTML = `<div class="pp-empty">در حال بارگذاری…</div>`;

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
                        هنوز ریویویی برای پروژه‌های این کاربر ثبت نشده
                    </div>
                `;

                renderPagination('reviews');

                return;
            }

            list.innerHTML = data.reviews.map(renderReviewCard).join('');
            renderPagination('reviews');
        } catch (err) {
            list.innerHTML = `<div class="pp-empty">خطا در بارگذاری ریویوها</div>`;
        }
    }

    function renderReviewCard(r) {
        const reviewer = r.user || {};
        const p = r.project || {};

        /* ---------- reviewer (نویسنده ریویو) ---------- */
        const reviewerName = reviewer.name || reviewer.username || 'کاربر';
        const reviewerInitial = reviewerName.trim().charAt(0).toUpperCase();
        const reviewerAvatarStyle = reviewer.avatar?.url
            ? `background-image:url('${escapeHtml(reviewer.avatar.url)}');background-size:cover;background-position:center;`
            : '';
        const reviewerLink = reviewer.username
            ? `/users/${encodeURIComponent(reviewer.username)}`
            : null;

        /* ---------- project (پروژه‌ای که ریویو روشه) ---------- */
        const cover = p.images?.[0]?.url;
        const projectInitial = !cover ? escapeHtml((p.title || '?')[0].toUpperCase()) : '';
        const thumbStyle = cover ? `background-image:url('${escapeHtml(cover)}')` : '';
        const projectLink = p.slug
            ? `/projects/${encodeURIComponent(p.slug)}`
            : p._id
                ? `/projects/${p._id}`
                : '#';

        /* ---------- stars ---------- */
        const stars = Array.from({ length: 5 }, (_, i) =>
            i < Math.round(r.rating || 0)
                ? '<span style="color:#fbbf24">★</span>'
                : '<span style="color:#2a2a2a">★</span>'
        ).join('');

        /* ---------- avatar element ---------- */
        const avatarHtml = reviewerLink
            ? `<a href="${reviewerLink}" class="pp-review-card__reviewer-avatar" style="${reviewerAvatarStyle}" onclick="event.stopPropagation();">
                ${!reviewer.avatar?.url ? escapeHtml(reviewerInitial) : ''}
           </a>`
            : `<div class="pp-review-card__reviewer-avatar" style="${reviewerAvatarStyle}">
                ${!reviewer.avatar?.url ? escapeHtml(reviewerInitial) : ''}
           </div>`;

        /* ---------- name element ---------- */
        const nameHtml = reviewerLink
            ? `<a href="${reviewerLink}" class="pp-review-card__reviewer-name" onclick="event.stopPropagation();">${escapeHtml(reviewerName)}</a>`
            : `<span class="pp-review-card__reviewer-name">${escapeHtml(reviewerName)}</span>`;

        return `
            <article class="pp-review-card">

                <!-- reviewer -->
                <div class="pp-review-card__head">
                    ${avatarHtml}
                    <div class="pp-review-card__reviewer-info">
                        ${nameHtml}
                        <span class="pp-review-card__date">${relativeTime(r.createdAt)}</span>
                    </div>
                    <div class="pp-review-card__stars">${stars}</div>
                </div>

                <!-- project -->
                <a class="pp-review-card__project" href="${projectLink}" onclick="event.stopPropagation();">
                    <div class="pp-review-card__project-thumb" style="${thumbStyle}">${projectInitial}</div>
                    <div class="pp-review-card__project-info">
                        <span class="pp-review-card__project-label">درباره پروژه</span>
                        <div class="pp-review-card__project-title">${escapeHtml(p.title || '—')}</div>
                    </div>
                    <div class="pp-review-card__project-arrow">‹</div>
                </a>

                <!-- content -->
                ${r.title ? `<h4 class="pp-review-card__title">${escapeHtml(r.title)}</h4>` : ''}
                ${r.body ? `<p class="pp-review-card__body">${escapeHtml(r.body)}</p>` : ''}

                <!-- satisfaction -->
                <div class="pp-review-card__satisfaction">
                    <span>رضایت</span>
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
            for (let i = Math.max(2, cur - 1); i <= Math.min(total - 1, cur + 1); i++) pages.push(i);
            if (cur < total - 2) pages.push('...');
            pages.push(total);
        }

        el.innerHTML = `
            <button class="pp-page-btn" ${cur === 1 ? 'disabled' : ''} data-page="${cur - 1}">قبلی</button>
            ${pages.map((p) => p === '...'
            ? `<span class="pp-page-btn" style="cursor:default;border:none;background:transparent">…</span>`
            : `<button class="pp-page-btn ${p === cur ? 'active' : ''}" data-page="${p}">${p}</button>`
        ).join('')}
            <button class="pp-page-btn" ${cur === total ? 'disabled' : ''} data-page="${cur + 1}">بعدی</button>
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
       Init
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