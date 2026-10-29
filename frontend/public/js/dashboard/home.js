/* ============================================================
   Dashboard Home — Role-Aware
   ============================================================
   Populates the dashboard landing page with role-appropriate
   content: a time-based greeting, aggregate statistics, admin
   panel counters, developer health indicators, and the user's
   most recent projects. Also guards the "New Project" action
   behind an email-verification check.
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
    const $ = (selector) => document.querySelector(selector);

    /* Role and account flags exposed by the server via window globals. */
    const userRole = window.__USER_ROLE__ || 'user';
    const isAdmin = window.__IS_ADMIN__ === true;
    const isDeveloper = window.__IS_DEVELOPER__ === true;
    const emailVerified = window.__EMAIL_VERIFIED__ === true;

    /* ============================================================
       Greeting
       ============================================================
       Renders a time-of-day greeting tailored to the current
       user's role.
       ============================================================ */
    function setGreeting() {
        const el = $('#welcomeGreeting');
        if (!el) return;

        const hour = new Date().getHours();

        let greeting =
            hour < 6 ? 'Good night 🌙' :
                hour < 12 ? 'Good morning ☀️' :
                    hour < 17 ? 'Good afternoon' :
                        hour < 21 ? 'Good evening 🌆' :
                            'Good night 🌙';

        if (userRole === 'admin') greeting += ' — Your admin panel is ready.';
        else if (userRole === 'developer') greeting += ' — Full system access.';

        el.textContent = greeting;
    }

    /* ============================================================
       API Helper (Non-Throwing)
       ============================================================
       Fetch JSON from the API. Returns `null` on any failure so
       callers can render gracefully without try/catch blocks.
       ============================================================ */
    async function api(path) {
        try {
            const res = await fetch(path, { credentials: 'include' });
            if (!res.ok) return null;

            return await res.json();
        } catch {
            return null;
        }
    }

    /* ============================================================
       Formatters
       ============================================================ */

    /* Abbreviate large numbers using K/M suffixes. */
    function formatNumber(n) {
        n = Number(n) || 0;

        if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
        if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';

        return String(n);
    }

    /* Convert a byte count into a human-readable size string. */
    function bytesHuman(b) {
        b = Number(b) || 0;

        if (b < 1024) return b + ' B';
        if (b < 1024 * 1024) return (b / 1024).toFixed(1) + ' KB';
        if (b < 1024 * 1024 * 1024) return (b / 1024 / 1024).toFixed(1) + ' MB';

        return (b / 1024 / 1024 / 1024).toFixed(2) + ' GB';
    }

    /* Format an uptime in seconds as days/hours/minutes. */
    function formatUptime(seconds) {
        seconds = Number(seconds) || 0;
        if (seconds <= 0) return '—';

        const d = Math.floor(seconds / 86400);
        const h = Math.floor((seconds % 86400) / 3600);
        const m = Math.floor((seconds % 3600) / 60);

        if (d > 0) return `${d}d ${h}h`;
        if (h > 0) return `${h}h ${m}m`;

        return `${m}m`;
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

    /* ============================================================
       Primary Statistics
       ============================================================
       Aggregates the user's project data into summary cards and
       appends admin and developer-specific cards when applicable.
       ============================================================ */
    async function loadPrimaryStats() {
        const container = $('#primaryStats');
        if (!container) return;

        const myProjectsRes = await api('/api/projects?mine=true&limit=100');
        const myProjects = myProjectsRes?.projects || [];
        const myTotal = myProjectsRes?.pagination?.total || myProjects.length;

        let totalDownloads = 0, totalStars = 0, totalReviews = 0;

        for (const p of myProjects) {
            totalDownloads += p.downloads || 0;
            totalStars += p.githubData?.stars || 0;
            totalReviews += p.reviewCount || 0;
        }

        const publishedCount = myProjects.filter((p) => p.status === 'published').length;

        const cards = [
            {
                label: 'Projects',
                value: myTotal,
                icon: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path></svg>`,
                color: '#6ebbff',
                meta: `${publishedCount} published`,
            },
            {
                label: 'Downloads',
                value: formatNumber(totalDownloads),
                icon: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>`,
                color: '#34d399',
            },
            {
                label: 'Stars',
                value: formatNumber(totalStars),
                icon: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>`,
                color: '#fbbf24',
            },
            {
                label: 'Reviews',
                value: formatNumber(totalReviews),
                icon: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>`,
                color: '#ec4899',
            },
        ];

        // Admin-only: total user count.
        if (isAdmin) {
            const usersRes = await api('/api/admin/users?limit=1');

            if (usersRes) {
                cards.push({
                    label: 'Users',
                    value: formatNumber(usersRes.pagination?.total || 0),
                    icon: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>`,
                    color: '#007bff',
                });
            }
        }

        // Developer-only: server uptime is surfaced in the dev health panel.
        if (isDeveloper) {
            const health = await api('/api/health');

            if (health) {
                cards.push({
                    label: 'Uptime',
                    value: formatUptime(health.uptime),
                    icon: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>`,
                    color: '#a78bfa',
                    meta: 'Server active',
                });
            }
        }

        container.innerHTML = cards.map((c) => `
            <div class="home-stat-card">
                <div class="home-stat-card__icon" style="--c:${c.color}">${c.icon}</div>
                <div class="home-stat-card__body">
                    <span class="home-stat-card__label">${c.label}</span>
                    <span class="home-stat-card__value">${c.value}</span>
                    ${c.meta ? `<span class="home-stat-card__meta">${c.meta}</span>` : ''}
                </div>
            </div>
        `).join('');
    }

    /* ============================================================
       Admin Panel Counts
       ============================================================
       Populates the admin quick panel with aggregate counts and,
       when pending items exist, surfaces a badge on the
       corresponding navigation entry.
       ============================================================ */
    async function loadAdminPanel() {
        if (!isAdmin) return;

        const [usersRes, tagsRes, typesRes, pendingRes] = await Promise.all([
            api('/api/admin/users?limit=1'),
            api('/api/tags?limit=1'),
            api('/api/tag-types'),
            api('/api/tags/pending'),
        ]);

        const usersCount = usersRes?.pagination?.total;
        if (typeof usersCount === 'number') {
            $('#adminUsersCount').textContent = `${formatNumber(usersCount)} users`;
        }

        const tagsCount = tagsRes?.pagination?.total;
        if (typeof tagsCount === 'number') {
            $('#adminTagsCount').textContent = `${formatNumber(tagsCount)} tags`;
        }

        if (typesRes?.types) {
            $('#adminTypesCount').textContent = `${typesRes.types.length} categories`;
        }

        if (pendingRes) {
            const pendingTags = (pendingRes.tags || []).length;
            const pendingTypes = (pendingRes.types || []).length;
            const total = pendingTags + pendingTypes;

            if (total > 0) {
                const card = $('#pendingCard');
                if (card) card.style.display = '';

                $('#adminPendingCount').textContent = `${total} item${total === 1 ? '' : 's'}`;

                const badge = $('#navUsersBadge');
                if (badge) {
                    badge.textContent = total;
                    badge.classList.add('visible');
                }
            }
        }
    }

    /* ============================================================
       Developer Health
       ============================================================
       Displays database connectivity, uptime, memory pressure,
       and Node.js version. Falls back to "Unavailable" when the
       health endpoint is unreachable.
       ============================================================ */
    async function loadDevHealth() {
        if (!isDeveloper) return;

        const data = await api('/api/health');

        if (!data) {
            document.querySelectorAll('.dev-health-card__value--loading').forEach((el) => {
                el.textContent = 'Unavailable';
                el.classList.remove('dev-health-card__value--loading');
            });

            return;
        }

        /* Database connectivity */
        const dbEl = $('#devDbStatus');
        if (dbEl) {
            const ok = !!data.database?.connected;

            dbEl.textContent = ok ? 'Connected ✓' : 'Disconnected';
            dbEl.className = `dev-health-card__value ${ok ? 'dev-health-card__value--ok' : 'dev-health-card__value--danger'}`;
        }

        /* Server uptime */
        const upEl = $('#devUptime');
        if (upEl) {
            upEl.textContent = formatUptime(data.uptime);
            upEl.classList.remove('dev-health-card__value--loading');
        }

        /* Heap memory usage */
        const memEl = $('#devMemory');
        if (memEl) {
            const used = data.memory?.heapUsed || 0;
            const total = data.memory?.heapTotal || 0;
            const pct = total > 0 ? Math.round((used / total) * 100) : 0;

            memEl.textContent = `${bytesHuman(used)} (${pct}%)`;
            memEl.className = 'dev-health-card__value ' + (
                pct > 85 ? 'dev-health-card__value--danger' :
                    pct > 65 ? 'dev-health-card__value--warn' :
                        'dev-health-card__value--ok'
            );
        }

        /* Node.js version */
        const nodeEl = $('#devNode');
        if (nodeEl) {
            nodeEl.textContent = data.nodeVersion || '—';
            nodeEl.classList.remove('dev-health-card__value--loading');
        }
    }

    /* ============================================================
       Recent Projects
       ============================================================
       Lists the user's six most recently updated projects with a
       thumbnail, relative timestamp, download count, and status.
       ============================================================ */
    async function loadRecentProjects() {
        const container = $('#recentProjects');
        if (!container) return;

        const data = await api('/api/projects?mine=true&limit=6&sort=recent');
        const items = data?.projects || [];

        if (!items.length) {
            container.innerHTML = `<div class="home-empty">No projects yet — start by clicking "New Project".</div>`;

            return;
        }

        const statusMap = { draft: 'Draft', published: 'Published', archived: 'Archived' };

        container.innerHTML = items.map((p) => {
            const cover = p.images?.[0]?.url;
            const thumbStyle = cover ? `background-image:url('${escapeHtml(cover)}')` : '';
            const initial = !cover ? escapeHtml((p.title || '?')[0].toUpperCase()) : '';

            return `
                <a class="recent-proj" href="/projects/${p.slug || p._id}">
                    <div class="recent-proj__thumb" style="${thumbStyle}">${initial}</div>
                    <div class="recent-proj__body">
                        <div class="recent-proj__title">${escapeHtml(p.title)}</div>
                        <div class="recent-proj__meta">
                            ${relativeTime(p.updatedAt)} • ${formatNumber(p.downloads || 0)} downloads
                        </div>
                    </div>
                    <span class="recent-proj__status recent-proj__status--${p.status}">
                        ${statusMap[p.status] || p.status}
                    </span>
                </a>
            `;
        }).join('');
    }

    /* ============================================================
       New Project Guard
       ============================================================
       Intercepts the "New Project" action and blocks navigation
       when the user's email has not been verified, redirecting
       them to the verification page instead.
       ============================================================ */
    function setupNewProjectGuard() {
        const btn = $('#newProjectBtn');
        if (!btn) return;

        btn.addEventListener('click', (e) => {
            if (!emailVerified) {
                e.preventDefault();

                if (typeof openDialogError === 'function') {
                    openDialogError(
                        'Email not verified',
                        'You must verify your email before creating a project.'
                    );
                }

                setTimeout(() => {
                    location.href = '/auth/verify-email';
                }, 1800);

                return;
            }

            location.href = '/dashboard/projects';
        });
    }

    /* ============================================================
       Initialization
       ============================================================ */
    setGreeting();
    loadPrimaryStats();
    loadAdminPanel();
    loadDevHealth();
    loadRecentProjects();
    setupNewProjectGuard();
});

/**
 * Copyright (c) 2026 Sobhan Rasoulzadeh Asl (Sobhan-SRZA / Mr. Sinre)
 *
 * Licensed under the BSD 3-Clause License.
 * See the LICENSE file in the project root for license information.
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */