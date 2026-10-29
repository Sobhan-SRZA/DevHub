/* ============================================================
   Home Page
   ============================================================
   Renders the landing page's dynamic sections: aggregate
   statistics, trending / featured / newest / top-rated /
   top-downloaded project groups, and empty or error states.
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
    const $ = (selector, root = document) => root.querySelector(selector);
    const main = $('#homeMain');

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

    /* ---------------- Section Presentation ----------------
       Per-section icons and accent colours, keyed by section name.
       ---------------- */
    const SECTION_ICONS = {
        trending: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></svg>',
        featured: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>',
        newProjects: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>',
        topRated: '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>',
        topDownloaded: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>',
    };

    const SECTION_COLORS = {
        trending: '#ff5f6d',
        featured: '#fbbf24',
        newProjects: '#4ade80',
        topRated: '#ec4899',
        topDownloaded: '#34d399',
    };

    /**
     * Render a single project-group section. Returns an empty string
     * when the section contains no projects, allowing the caller to
     * concatenate sections without additional conditionals.
     */
    function renderSection(key, section, layout = 'grid') {
        if (!section.projects?.length) return '';

        const icon = SECTION_ICONS[key] || '';
        const color = SECTION_COLORS[key] || '#6ebbff';

        // `newProjects` maps to the `new` sort key on the explore page.
        const exploreSort = key === 'newProjects' ? 'new' : key;

        return `
            <section class="home-section">
                <div class="home-section__head">
                    <div class="home-section__title-wrap">
                        <h2 class="home-section__title">
                            <span class="home-section__title-icon" style="--c:${color}">${icon}</span>
                            ${escapeHtml(section.title)}
                        </h2>
                        <p class="home-section__sub">${escapeHtml(section.subtitle || '')}</p>
                    </div>
                    <a href="/explore?sort=${exploreSort}" class="home-section__link">
                        View all
                        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="15 18 9 12 15 6"></polyline>
                        </svg>
                    </a>
                </div>

                <div class="home-grid ${layout === 'wide' ? 'home-grid--wide' : ''}">
                    ${section.projects.map(renderCard).join('')}
                </div>
            </section>
        `;
    }

    /* ---------------- Project Card ----------------
       Render a single project card with cover image, derived
       badges, tags, owner chip, and usage statistics.
       ---------------- */
    function renderCard(p) {
        const owner = p.owner || {};
        const ownerName = owner.name || owner.username || 'User';

        const cover = p.images?.[0]?.url || '';
        const tags = (p.tags || []).slice(0, 3);
        const moreTags = (p.tags || []).length - tags.length;

        // Derived badges: recent and "hot" indicators.
        const now = Date.now();
        const ageHours = (now - new Date(p.createdAt).getTime()) / 3600000;
        const isNew = ageHours < 72;
        const isHot = (p.githubData?.stars || 0) > 50 || (p.downloads || 0) > 100;

        const coverStyle = cover ? `background-image:url('${escapeHtml(cover)}');` : '';
        const initial = !cover
            ? `<span class="pc__cover-initial">${escapeHtml((p.title || '?')[0])}</span>`
            : '';

        const badges = [];
        if (p.featured) badges.push('<span class="pc__badge pc__badge--featured">★ Featured</span>');
        if (isHot) badges.push('<span class="pc__badge pc__badge--hot">🔥 Hot</span>');
        if (isNew && !isHot) badges.push('<span class="pc__badge pc__badge--new">New</span>');

        const tagsHtml = tags.map((t) => `
        <span class="pc__tag" style="background:${hexA(t.color, 0.1)}; color:${t.color}; border-color:${hexA(t.color, 0.25)}">
            ${escapeHtml(t.name)}
        </span>
    `).join('');

        const stats = [];
        if (p.githubData?.stars) stats.push(`<span class="pc__stat pc__stat--star">⭐ ${formatNumber(p.githubData.stars)}</span>`);
        if (p.downloads) stats.push(`<span class="pc__stat pc__stat--download">⬇ ${formatNumber(p.downloads)}</span>`);
        if (p.rating) stats.push(`<span class="pc__stat pc__stat--rating">★ ${p.rating.toFixed(1)}</span>`);

        /* Render the owner as a link chip when the shared helper is available. */
        const ownerChip = window.userChip
            ? window.userChip(owner, { size: 26, showName: true, className: 'pc__owner-chip' })
            : `<span class="pc__owner-name">${escapeHtml(ownerName)}</span>`;

        return `
        <article class="pc" data-href="/projects/${escapeHtml(p.slug)}">
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
                        ${ownerChip}
                    </div>
                    ${stats.length ? `<div class="pc__stats">${stats.join('')}</div>` : ''}
                </div>
            </div>
        </article>
    `;
    }

    /* ---------------- Render Page ----------------
       Load the home feed, animate the aggregate statistics, and
       assemble the project sections.
       ---------------- */
    async function load() {
        try {
            const data = await api('/api/projects/home-feed');

            /* Hero statistics */
            const stats = data.stats || {};
            animateNumber($('#statProjects'), stats.projects || 0);
            animateNumber($('#statUsers'), stats.users || 0);
            animateNumber($('#statTags'), stats.tags || 0);
            animateNumber($('#statDownloads'), stats.downloads || 0);

            /* Project sections */
            const s = data.sections || {};

            const html = [
                renderSection('trending', s.trending, 'wide'),
                renderSection('featured', s.featured),
                renderSection('newProjects', s.newProjects),
                renderSection('topRated', s.topRated),
                renderSection('topDownloaded', s.topDownloaded),
            ].join('');

            main.innerHTML = html || `
                <div class="explore-empty">
                    <div class="explore-empty__icon">🌱</div>
                    <h3 class="explore-empty__title">No projects published yet</h3>
                    <p class="explore-empty__sub">Be the first to share your project.</p>
                </div>
            `;

            /* Make every card a keyboard-accessible link. */
            main.querySelectorAll('.pc[data-href]').forEach((card) => {
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
            main.innerHTML = `
                <div class="explore-empty">
                    <div class="explore-empty__icon">⚠️</div>
                    <h3 class="explore-empty__title">Failed to load</h3>
                    <p class="explore-empty__sub">${escapeHtml(err.message || '')}</p>
                </div>
            `;
        }
    }

    /* ---------------- Number Animation ----------------
       Ease a numeric counter from zero to its target over a fixed
       duration using an ease-out cubic curve.
       ---------------- */
    function animateNumber(el, target) {
        if (!el) return;

        const duration = 800;
        const start = performance.now();
        const initial = 0;

        function tick(now) {
            const t = Math.min(1, (now - start) / duration);
            const eased = 1 - Math.pow(1 - t, 3);

            el.textContent = formatNumber(Math.round(initial + (target - initial) * eased));

            if (t < 1) requestAnimationFrame(tick);
        }

        requestAnimationFrame(tick);
    }

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

    /* ---------------- Initialization ---------------- */
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