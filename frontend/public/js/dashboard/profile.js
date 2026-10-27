(function () {
    'use strict';
    /* ============================================================
        State
       ============================================================ */
    const bioState = {
        editor: null,       // نمونه MarkdownEditor (lazy)
        user: null,         // کاربر فعلی
        isEditing: false,
    };

    /* ============================================================
       Helpers
       ============================================================ */
    function escapeHtml(s) {
        if (s === null || s === undefined) return '';
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function isObj(v) {
        return v && typeof v === 'object' && !Array.isArray(v);
    }

    async function getJSON(url) {
        const res = await fetch(url, { credentials: 'include' });
        let data = {};
        try { data = await res.json(); } catch (_) { /* ignore */ }
        if (!res.ok || data.ok === false) {
            const msg = data.message || `خطا در دریافت داده (${res.status})`;
            const err = new Error(msg);
            err.status = res.status;
            err.payload = data;
            throw err;
        }
        return data;
    }

    async function sendJSON(url, method, body) {
        const res = await fetch(url, {
            method,
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        let data = {};
        try { data = await res.json(); } catch (_) { /* ignore */ }
        if (!res.ok || data.ok === false) {
            const msg = data.message || `خطا (${res.status})`;
            const err = new Error(msg);
            err.status = res.status;
            err.payload = data;
            throw err;
        }
        return data;
    }

    function unwrap(payload, key) {
        if (!payload) return null;
        if (isObj(payload.data)) {
            if (key && payload.data[key] !== undefined) return payload.data[key];
            return payload.data;
        }
        if (key && payload[key] !== undefined) return payload[key];
        return payload;
    }

    function extractStats(payload) {
        if (!payload) return null;
        const root = isObj(payload.data) ? payload.data : payload;
        if (isObj(root.stats)) return root.stats;
        if (isObj(root.user) && isObj(root.user.stats)) return root.user.stats;

        const hasStatKeys = (o) => isObj(o) && (
            o.projects !== undefined ||
            o.projectCount !== undefined ||
            o.projectsCount !== undefined ||
            o.totalProjects !== undefined ||
            o.reviews !== undefined ||
            o.reviewCount !== undefined ||
            o.reviewsReceived !== undefined ||
            o.totalReviews !== undefined ||
            o.downloads !== undefined ||
            o.totalDownloads !== undefined ||
            o.rating !== undefined ||
            o.averageRating !== undefined ||
            o.avgRating !== undefined
        );

        if (isObj(root.user) && hasStatKeys(root.user)) return root.user;
        if (hasStatKeys(root)) return root;
        return null;
    }

    function formatNumber(n) {
        if (n === null || n === undefined || isNaN(n)) return '—';
        return Number(n).toLocaleString('fa-IR');
    }

    function roleLabel(role) {
        switch (role) {
            case 'developer': return 'دولوپر';
            case 'admin': return 'ادمین';
            case 'user': return 'کاربر';
            default: return role || '—';
        }
    }

    function statusLabel(s) {
        switch (s) {
            case 'published': return 'منتشرشده';
            case 'archived': return 'آرشیو';
            case 'draft':
            default: return 'پیش‌نویس';
        }
    }

    /* ============================================================
        Render 
    ============================================================ */
    /* ============================================================
   Bio — Display (read-only)
   ============================================================ */
    function renderBioDisplay(bio) {
        const section = document.getElementById('profileBioSection');
        const preview = document.querySelector('#profileBioDisplay .md-preview-content');
        if (!section || !preview) return;

        if (!bio || !bio.trim()) {
            section.hidden = true;
            preview.innerHTML = '';
            return;
        }

        // ✅ استفاده از parseMarkdown — همان موتور داخلی MarkdownEditor
        // (چون ادیتور اصلی اینجا نباید UI نمایش دهد — فقط preview لازم است)
        if (typeof window.parseMarkdown === 'function') {
            try {
                preview.innerHTML = window.parseMarkdown(bio);
            } catch (err) {
                console.warn('[profile] parseMarkdown failed:', err);
                preview.textContent = bio;
            }
        } else {
            // fallback ساده
            preview.textContent = bio;
        }

        section.hidden = false;
    }

    /* ============================================================
       Bio — Edit (با استفاده از MarkdownEditor — الگوی projects.js)
       ============================================================ */
    function mountBioEditor() {
        if (bioState.editor) return bioState.editor;

        const host = document.getElementById('profileBioEditor');
        if (!host) return null;

        if (!window.MarkdownEditor) {
            console.error('[profile] MarkdownEditor not loaded');
            if (window.toast) window.toast('ادیتور مارک‌داون لود نشد', 'error');
            return null;
        }

        bioState.editor = new window.MarkdownEditor('#profileBioEditor', {
            name: 'bio',
            value: (bioState.user && bioState.user.bio) || '',
            maxLength: 5000,          // طبق updateProfileSchema (اگه محدودیت دارد)
            minHeight: 220,
            placeholder: 'درباره خودت بنویس... (Markdown + HTML)',
        });

        return bioState.editor;
    }

    function enterBioEditMode() {
        if (bioState.isEditing) return;

        const displaySection = document.getElementById('profileBioSection');
        const editSection = document.getElementById('profileBioEditSection');
        if (!displaySection || !editSection) return;

        // mount editor اگر نبود
        const editor = mountBioEditor();
        if (!editor) return;

        // همیشه مقدار فعلی user رو ست کن (شاید از قبل عوض شده)
        editor.setValue((bioState.user && bioState.user.bio) || '');

        displaySection.hidden = true;
        editSection.hidden = false;
        bioState.isEditing = true;

        // فوکوس روی textarea
        setTimeout(() => editor.focus(), 100);
    }

    function exitBioEditMode() {
        if (!bioState.isEditing) return;

        const displaySection = document.getElementById('profileBioSection');
        const editSection = document.getElementById('profileBioEditSection');
        if (!displaySection || !editSection) return;

        // اگه bio خالی بود، نمایش‌دهنده هم مخفی بمونه
        const currentBio = (bioState.user && bioState.user.bio) || '';
        displaySection.hidden = !currentBio.trim();

        editSection.hidden = true;
        bioState.isEditing = false;
    }

    async function saveBio() {
        const editor = bioState.editor;
        if (!editor) return;

        const saveBtn = document.getElementById('saveBioBtn');
        const cancelBtn = document.getElementById('cancelBioBtn');
        const originalText = saveBtn ? saveBtn.textContent : 'ذخیره';

        const newBio = (editor.getValue() || '').trim();

        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.textContent = 'در حال ذخیره…';
        }
        if (cancelBtn) cancelBtn.disabled = true;

        try {
            const payload = await sendJSON('/api/profile/me', 'PATCH', { bio: newBio });

            // آپدیت state محلی
            if (bioState.user) bioState.user.bio = newBio;

            // دوباره رندر preview
            renderBioDisplay(newBio);

            // خروج از edit mode
            exitBioEditMode();

            if (window.toast) window.toast('بیو ذخیره شد', 'success');
        } catch (err) {
            console.error('[profile] save bio failed:', err);

            if (window.openDialogError) {
                window.openDialogError('خطا در ذخیره بیو', err.message || '');
            } else if (window.toast) {
                window.toast(err.message || 'خطا در ذخیره', 'error');
            }
        } finally {
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.textContent = originalText;
            }
            if (cancelBtn) cancelBtn.disabled = false;
        }
    }

    function bindBioActions() {
        document.getElementById('editBioBtn')?.addEventListener('click', enterBioEditMode);
        document.getElementById('saveBioBtn')?.addEventListener('click', saveBio);
        document.getElementById('cancelBioBtn')?.addEventListener('click', () => {
            // rollback مقادیر اگه لازم بود
            exitBioEditMode();
        });
    }

    function renderProfile(user) {
        if (!user) return;

        bioState.user = user;

        const nameEl = document.getElementById('profileHeroName');
        if (nameEl) nameEl.textContent = user.name || user.username || '—';

        const userEl = document.getElementById('profileHeroUsername');
        if (userEl) userEl.textContent = '@' + (user.username || '—');

        const emailEl = document.getElementById('profileHeroEmail');
        if (emailEl) emailEl.textContent = user.email || '—';

        const roleEl = document.getElementById('profileRoleBadge');
        if (roleEl && user.role) {
            roleEl.textContent = roleLabel(user.role);
            roleEl.dataset.role = user.role;
            roleEl.hidden = false;
        }

        const avatarWrap = document.getElementById('profileAvatarBig');
        const initial = document.getElementById('profileAvatarInitial');
        if (avatarWrap) {
            if (user.avatar && user.avatar.url) {
                const img = document.createElement('img');
                img.src = user.avatar.url;
                img.alt = user.name || user.username || 'avatar';
                img.className = 'profile-avatar-img';
                avatarWrap.innerHTML = '';
                avatarWrap.appendChild(img);
            } else if (initial) {
                const source = (user.name || user.username || '?').trim();
                initial.textContent = source.charAt(0).toUpperCase();
            }
        }

        const emailBadge = document.getElementById('profileEmailBadge');
        if (emailBadge) {
            if (user.emailVerified) {
                emailBadge.textContent = '✓ ایمیل تأیید شده';
                emailBadge.dataset.state = 'ok';
            } else {
                emailBadge.textContent = '⚠ در انتظار تأیید ایمیل';
                emailBadge.dataset.state = 'warn';
            }
            emailBadge.hidden = false;
        }

        const viewBtn = document.getElementById('viewPublicBtn');
        if (viewBtn && user.username) {
            viewBtn.href = '/users/' + encodeURIComponent(user.username);
        }

        // Bio — نمایش
        renderBioDisplay(user.bio);
    }

    function renderStats(stats) {
        if (!stats) {
            setStat('statProjects', '—');
            setStat('statReviews', '—');
            setStat('statDownloads', '—');
            setStat('statRating', '—');
            return;
        }

        const projects = stats.projects ?? stats.projectCount ?? stats.projectsCount ?? stats.totalProjects;
        const reviews = stats.reviews ?? stats.reviewCount ?? stats.reviewsReceived ?? stats.totalReviews;
        const downloads = stats.downloads ?? stats.totalDownloads ?? stats.downloadCount;
        const rating = stats.rating ?? stats.averageRating ?? stats.avgRating ?? stats.ratingAverage;

        setStat('statProjects', formatNumber(projects));
        setStat('statReviews', formatNumber(reviews));
        setStat('statDownloads', formatNumber(downloads));

        const reviewCount = Number(reviews ?? 0);
        if (reviewCount > 0 && rating !== null && rating !== undefined && !isNaN(rating)) {
            setStat('statRating', Number(rating).toFixed(1) + ' / 5');
        } else {
            setStat('statRating', '—');
        }
    }

    function setStat(id, value) {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    }

    function renderRecentProjects(projects) {
        const wrap = document.getElementById('recentProjects');
        if (!wrap) return;

        if (!Array.isArray(projects) || !projects.length) {
            wrap.innerHTML = `
                <div class="recent-empty">
                    <p>هنوز پروژه‌ای نساخته‌اید.</p>
                    <a class="btn-primary" href="/dashboard/projects">اولین پروژه را بسازید</a>
                </div>`;
            return;
        }

        wrap.innerHTML = projects.slice(0, 6).map(p => {
            const img = (p.images && p.images[0] && p.images[0].url) ? p.images[0].url : null;
            const title = escapeHtml(p.title || 'بدون عنوان');
            const desc = escapeHtml(p.shortDescription || '');
            const slug = p.slug || p._id;
            const status = p.status || 'draft';

            const cover = img
                ? `<img class="recent-card-cover" src="${escapeHtml(img)}" alt="${title}" loading="lazy">`
                : `<div class="recent-card-cover recent-card-cover--placeholder">${escapeHtml(title.charAt(0))}</div>`;

            return `
                <a class="recent-card" href="/projects/${encodeURIComponent(slug)}">
                    ${cover}
                    <div class="recent-card-body">
                        <div class="recent-card-head">
                            <h3 class="recent-card-title">${title}</h3>
                            <span class="recent-status recent-status--${escapeHtml(status)}">${statusLabel(status)}</span>
                        </div>
                        ${desc ? `<p class="recent-card-desc">${desc}</p>` : ''}
                    </div>
                </a>`;
        }).join('');
    }

    /* ============================================================
       Loaders
       ============================================================ */
    async function loadProfile() {
        const payload = await getJSON('/api/profile/me');
        const user =
            unwrap(payload, 'user') ||
            unwrap(payload, 'profile') ||
            payload;
        renderProfile(user);
        return user;
    }

    async function loadStats(user) {
        const username = user && user.username;
        if (!username) {
            console.warn('[profile] no username, skip stats');
            renderStats(null);
            return;
        }
        try {
            const payload = await getJSON('/api/users/' + encodeURIComponent(username));
            const stats = extractStats(payload);
            if (!stats) {
                console.warn('[profile] stats not found in payload:', payload);
            }
            renderStats(stats);
        } catch (err) {
            console.warn('[profile] stats load failed:', err.message, err.payload);
            renderStats(null);
        }
    }

    async function loadRecentProjects() {
        try {
            const payload = await getJSON('/api/projects?mine=true&limit=6&sort=recent');
            const items =
                unwrap(payload, 'projects') ||
                unwrap(payload, 'items') ||
                (Array.isArray(payload.data) ? payload.data : null) ||
                [];
            renderRecentProjects(items);
        } catch (err) {
            console.warn('[profile] projects load failed:', err.message, err.payload);
            renderRecentProjects([]);
        }
    }

    /* ============================================================
       Boot
       ============================================================ */
    document.addEventListener('DOMContentLoaded', async () => {
        bindBioActions();

        try {
            const user = await loadProfile();
            await Promise.all([
                loadStats(user),
                loadRecentProjects(),
            ]);
        } catch (err) {
            console.error('[profile] load failed:', err);
            if (window.openDialogError) {
                window.openDialogError('خطا', err.message || 'بارگذاری پروفایل ناموفق بود.');
            }
        }
    });
})();

/**
 * Copyright (c) 2026 Sobhan Rasoulzadeh Asl (Sobhan-SRZA / Mr. Sinre)
 *
 * Licensed under the BSD 3-Clause License.
 * See the LICENSE file in the project root for license information.
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */