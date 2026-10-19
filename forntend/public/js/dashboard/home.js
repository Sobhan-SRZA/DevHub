/* ============================================================
   Dashboard Home
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
    const $ = (s, r = document) => r.querySelector(s);

    /* ============================================================
       API
       ============================================================ */
    async function api(path) {
        const res = await fetch(path, { credentials: 'include' });
        let data = null;
        try { data = await res.json(); } catch { }
        if (!res.ok) {
            const err = new Error(data?.message || 'خطا');
            Object.assign(err, data, { status: res.status });
            throw err;
        }
        return data;
    }

    /* ============================================================
       Welcome
       ============================================================ */
    async function loadUser() {
        try {
            const data = await api('/api/auth/me');
            const u = data.user;
            if (!u) return;

            const name = u.name || u.username || 'کاربر';

            $('#welcomeName').textContent = name.split(' ')[0];
            const avatarBig = document.getElementById('welcomeAvatar');
            const initialEl = document.getElementById('welcomeAvatarContent');
            if (u.avatar?.url) {
                avatarBig.style.backgroundImage = `url('${u.avatar.url}')`;
                avatarBig.style.backgroundSize = 'cover';
                avatarBig.style.backgroundPosition = 'center';
                if (initialEl) initialEl.style.display = 'none';
            } else {
                avatarBig.style.backgroundImage = '';
                avatarBig.style.background = 'linear-gradient(135deg, #007bff, #6ebbff)';
                if (initialEl) {
                    initialEl.style.display = '';
                    initialEl.textContent = name.trim().charAt(0).toUpperCase();
                }
            }
            // پیام خوش‌آمد بر اساس ساعت
            const hour = new Date().getHours();
            let greeting = 'به داشبورد خودت خوش آمدی';
            if (hour < 6) greeting = 'شب بخیر 🌙';
            else if (hour < 12) greeting = 'صبح بخیر ☀️';
            else if (hour < 17) greeting = 'روز بخیری';
            else if (hour < 21) greeting = 'عصر بخیر 🌆';
            else greeting = 'شب بخیر 🌙';

            $('#welcomeSub').textContent = greeting;
        } catch (err) {
            if (err.status === 401) location.href = '/login';
        }
    }

    /* ============================================================
       Stats
       ============================================================ */
    async function loadStats() {
        try {
            // پروژه‌های من
            const projects = await api('/api/projects?mine=true&limit=1');
            const totalProjects = projects.pagination?.total || 0;

            // منتشرشده و پیش‌نویس
            const [pub, draft] = await Promise.all([
                api('/api/projects?mine=true&status=published&limit=1').catch(() => ({ pagination: { total: 0 } })),
                api('/api/projects?mine=true&status=draft&limit=1').catch(() => ({ pagination: { total: 0 } })),
            ]);

            // تگ‌های من — تخمینی از usage
            // (اگه backend endpoint خاصی نداری، از همین پروژه‌ها استخراج کن)
            let totalTags = 0;
            let totalReviews = 0;
            let totalDownloads = 0;
            let totalStars = 0;
            let totalComments = 0;

            try {
                const all = await api('/api/projects?mine=true&limit=100');
                const items = all.projects || [];

                const tagSet = new Set();
                for (const p of items) {
                    (p.tags || []).forEach((t) => tagSet.add(t._id));
                    totalReviews += p.reviewCount || 0;
                    totalDownloads += p.downloads || 0;
                    totalStars += p.githubData?.stars || 0;
                }
                totalTags = tagSet.size;
            } catch { }

            renderStats({
                projects: totalProjects,
                published: pub.pagination?.total || 0,
                drafts: draft.pagination?.total || 0,
                tags: totalTags,
                reviews: totalReviews,
                downloads: totalDownloads,
                stars: totalStars,
                comments: totalComments,
            });
        } catch (err) {
            $('#dashStats').innerHTML = `
                <div class="panel-empty" style="grid-column:1/-1">
                    خطا در بارگذاری آمار
                </div>
            `;
        }
    }

    function renderStats(s) {
        const cards = [
            {
                key: 'projects',
                label: 'پروژه‌ها',
                value: s.projects,
                icon: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path></svg>`,
                color: '#6ebbff',
                meta: s.published ? `${s.published} منتشر شده` : null,
            },
            {
                key: 'published',
                label: 'منتشر شده',
                value: s.published,
                icon: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`,
                color: '#4ade80',
                meta: s.drafts ? `${s.drafts} پیش‌نویس` : null,
            },
            {
                key: 'stars',
                label: 'ستاره‌ها',
                value: formatNumber(s.stars),
                icon: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>`,
                color: '#fbbf24',
                meta: 'از گیت‌هاب',
            },
            {
                key: 'downloads',
                label: 'دانلودها',
                value: formatNumber(s.downloads),
                icon: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>`,
                color: '#34d399',
                meta: 'فایل پروژه‌ها',
            },
            {
                key: 'reviews',
                label: 'ریویوها',
                value: formatNumber(s.reviews),
                icon: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>`,
                color: '#ec4899',
                meta: 'امتیازهای دریافتی',
            },
            {
                key: 'tags',
                label: 'تگ‌ها',
                value: formatNumber(s.tags),
                icon: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path><line x1="7" y1="7" x2="7.01" y2="7"></line></svg>`,
                color: '#a78bfa',
                meta: 'تگ‌های استفاده‌شده',
            },
        ];

        $('#dashStats').innerHTML = cards.map((c) => `
            <div class="stat-card" style="--c: ${c.color}">
                <div class="stat-card__head">
                    <span class="stat-card__label">${c.label}</span>
                    <div class="stat-card__icon">${c.icon}</div>
                </div>
                <div class="stat-card__value">${c.value}</div>
                ${c.meta ? `<div class="stat-card__meta">${c.meta}</div>` : ''}
            </div>
        `).join('');
    }

    /* ============================================================
       Recent Projects
       ============================================================ */
    async function loadRecentProjects() {
        try {
            const data = await api('/api/projects?mine=true&limit=5&sort=recent');
            const items = data.projects || [];

            if (!items.length) {
                $('#recentProjects').innerHTML = `
                    <div class="panel-empty">
                        هنوز پروژه‌ای نساخته‌اید — از دکمه «پروژه جدید» شروع کنید
                    </div>
                `;
                return;
            }

            $('#recentProjects').innerHTML = items.map((p) => {
                const statusMap = { draft: 'پیش‌نویس', published: 'منتشر شده', archived: 'آرشیو' };
                const cover = p.images?.[0]?.url;
                const thumbStyle = cover
                    ? `background-image:url('${escapeHtml(cover)}')`
                    : '';
                const initial = !cover ? escapeHtml((p.title || '?')[0]) : '';

                return `
                    <a class="recent-item" href="/dashboard/projects?edit=${p._id}">
                        <div class="recent-item__thumb" style="${thumbStyle}">${initial}</div>
                        <div class="recent-item__body">
                            <div class="recent-item__title">${escapeHtml(p.title)}</div>
                            <div class="recent-item__sub">${escapeHtml(p.shortDescription || '')}</div>
                        </div>
                        <div class="recent-item__meta">
                            <span class="recent-item__status recent-item__status--${p.status}">
                                ${statusMap[p.status]}
                            </span>
                        </div>
                    </a>
                `;
            }).join('');
        } catch (err) {
            $('#recentProjects').innerHTML = `<div class="panel-empty">خطا در بارگذاری</div>`;
        }
    }

    /* ============================================================
       Recent Comments
       ============================================================ */
    async function loadRecentComments() {
        try {
            // اول پروژه‌های خودم رو می‌گیرم
            const projectsData = await api('/api/projects?mine=true&limit=10');
            const projects = projectsData.projects || [];

            if (!projects.length) {
                $('#recentComments').innerHTML = `<div class="panel-empty">هنوز پروژه‌ای ندارید</div>`;
                return;
            }

            // آخرین کامنت‌های هر پروژه
            const allComments = [];
            await Promise.all(
                projects.map(async (p) => {
                    try {
                        const c = await api(`/api/projects/${p._id}/comments?limit=3&sort=recent`);
                        (c.comments || []).forEach((cm) => {
                            allComments.push({ ...cm, _projectTitle: p.title, _projectSlug: p.slug });
                        });
                    } catch { }
                })
            );

            // مرتب‌سازی بر اساس زمان
            allComments.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            const top = allComments.slice(0, 6);

            if (!top.length) {
                $('#recentComments').innerHTML = `<div class="panel-empty">هنوز نظری دریافت نکرده‌اید</div>`;
                return;
            }

            $('#recentComments').innerHTML = top.map((c) => {
                const u = c.user || {};
                const name = u.name || u.username || 'کاربر';
                const initial = name.charAt(0).toUpperCase();
                const ago = relativeTime(c.createdAt);

                return `
                    <a class="recent-item" href="/projects/${c._projectSlug}#comment-${c._id}">
                        <div class="recent-item__thumb">${escapeHtml(initial)}</div>
                        <div class="recent-item__body">
                            <div class="recent-item__title">${escapeHtml(name)}</div>
                            <div class="recent-item__sub">${escapeHtml(truncate(c.body, 70))}</div>
                        </div>
                        <div class="recent-item__meta">
                            <span>${ago}</span>
                        </div>
                    </a>
                `;
            }).join('');
        } catch (err) {
            $('#recentComments').innerHTML = `<div class="panel-empty">خطا در بارگذاری</div>`;
        }
    }

    /* ============================================================
       Helpers
       ============================================================ */
    function formatNumber(n) {
        if (!n) return '0';
        if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
        if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
        return String(n);
    }

    function relativeTime(dateStr) {
        if (!dateStr) return '';
        const diff = Date.now() - new Date(dateStr).getTime();
        const s = Math.floor(diff / 1000);
        if (s < 60) return 'همین الان';
        const m = Math.floor(s / 60);
        if (m < 60) return `${m} دقیقه پیش`;
        const h = Math.floor(m / 60);
        if (h < 24) return `${h} ساعت پیش`;
        const d = Math.floor(h / 24);
        if (d < 30) return `${d} روز پیش`;
        const mo = Math.floor(d / 30);
        return `${mo} ماه پیش`;
    }

    function truncate(s, n) {
        s = String(s || '');
        return s.length > n ? s.slice(0, n) + '…' : s;
    }

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
       Init
       ============================================================ */
    loadUser();
    loadStats();
    loadRecentProjects();
    loadRecentComments();
});

/**
 * Copyright (c) 2026 Sobhan Rasoulzadeh Asl (Sobhan-SRZA / Mr. Sinre)
 *
 * Licensed under the BSD 3-Clause License.
 * See the LICENSE file in the project root for license information.
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */