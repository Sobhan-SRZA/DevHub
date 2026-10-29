(function () {
    'use strict';

    /* ============================================================
       State
       ============================================================
       Holds the profile page's editing state: the lazily mounted
       Markdown editor instance, the current user record, and a
       flag indicating whether the biography is being edited.
       ============================================================ */
    const bioState = {
        editor: null,       // MarkdownEditor instance (mounted lazily).
        user: null,         // Current user record.
        isEditing: false,
    };

    /* ============================================================
       Helpers
       ============================================================ */

    /* Escape user-supplied strings before interpolating them into HTML. */
    function escapeHtml(s) {
        if (s === null || s === undefined) return '';

        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    /* Determine whether a value is a plain object (not null or an array). */
    function isObj(v) {
        return v && typeof v === 'object' && !Array.isArray(v);
    }

    /**
     * Fetch JSON from the API. Throws an error carrying the server
     * payload when the response is unsuccessful or explicitly marked
     * as a failure (`ok: false`).
     */
    async function getJSON(url) {
        const res = await fetch(url, { credentials: 'include' });

        let data = {};
        try {
            data = await res.json();
        } catch (_) { /* Ignore JSON parse failures. */ }

        if (!res.ok || data.ok === false) {
            const msg = data.message || `Failed to fetch data (${res.status})`;
            const err = new Error(msg);

            err.status = res.status;
            err.payload = data;

            throw err;
        }

        return data;
    }

    /**
     * Send a JSON payload via the given HTTP method. Throws an error
     * carrying the server payload on failure.
     */
    async function sendJSON(url, method, body) {
        const res = await fetch(url, {
            method,
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });

        let data = {};
        try {
            data = await res.json();
        } catch (_) { /* Ignore JSON parse failures. */ }

        if (!res.ok || data.ok === false) {
            const msg = data.message || `Request failed (${res.status})`;
            const err = new Error(msg);

            err.status = res.status;
            err.payload = data;

            throw err;
        }

        return data;
    }

    /**
     * Extract the value at `key` from a response payload, transparently
     * handling envelopes shaped as `{ data: {...} }`.
     */
    function unwrap(payload, key) {
        if (!payload) return null;

        if (isObj(payload.data)) {
            if (key && payload.data[key] !== undefined) return payload.data[key];

            return payload.data;
        }

        if (key && payload[key] !== undefined) return payload[key];

        return payload;
    }

    /**
     * Locate the statistics object within a response payload,
     * tolerating several common server response shapes.
     */
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

    /* Format a numeric value with locale-aware grouping, or an em dash. */
    function formatNumber(n) {
        if (n === null || n === undefined || isNaN(n)) return '—';

        return Number(n).toLocaleString('en-US');
    }

    /* Map a role identifier to its human-readable label. */
    function roleLabel(role) {
        switch (role) {
            case 'developer': return 'Developer';
            case 'admin': return 'Admin';
            case 'user': return 'User';
            default: return role || '—';
        }
    }

    /* Map a project status identifier to its human-readable label. */
    function statusLabel(s) {
        switch (s) {
            case 'published': return 'Published';
            case 'archived': return 'Archived';
            case 'draft':
            default: return 'Draft';
        }
    }

    /* ============================================================
       Rendering
       ============================================================ */

    /* ============================================================
       Bio — Display (Read-Only)
       ============================================================
       Renders the user's Markdown biography into the read-only
       preview element, or hides the section when no bio exists.
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

        // Reuse the shared Markdown parser so the preview matches
        // the editor's rendering exactly.
        if (typeof window.parseMarkdown === 'function') {
            try {
                preview.innerHTML = window.parseMarkdown(bio);
            } catch (err) {
                console.warn('[profile] parseMarkdown failed:', err);
                preview.textContent = bio;
            }
        } else {
            // Fallback: render the raw text.
            preview.textContent = bio;
        }

        section.hidden = false;
    }

    /* ============================================================
       Bio — Edit
       ============================================================
       Mounts the Markdown editor on demand, using the same
       integration pattern as the projects page.
       ============================================================ */
    function mountBioEditor() {
        if (bioState.editor) return bioState.editor;

        const host = document.getElementById('profileBioEditor');
        if (!host) return null;

        if (!window.MarkdownEditor) {
            console.error('[profile] MarkdownEditor not loaded');

            if (window.toast) window.toast('The Markdown editor failed to load.', 'error');

            return null;
        }

        bioState.editor = new window.MarkdownEditor('#profileBioEditor', {
            name: 'bio',
            value: (bioState.user && bioState.user.bio) || '',
            maxLength: 5000,          // Matches the server-side bio limit.
            minHeight: 220,
            placeholder: 'Write about yourself… (Markdown and HTML supported)',
        });

        return bioState.editor;
    }

    /* Switch the bio section into editing mode and focus the editor. */
    function enterBioEditMode() {
        if (bioState.isEditing) return;

        const displaySection = document.getElementById('profileBioSection');
        const editSection = document.getElementById('profileBioEditSection');
        if (!displaySection || !editSection) return;

        // Mount the editor if it has not been created yet.
        const editor = mountBioEditor();
        if (!editor) return;

        // Always sync the editor with the current user's bio.
        editor.setValue((bioState.user && bioState.user.bio) || '');

        displaySection.hidden = true;
        editSection.hidden = false;
        bioState.isEditing = true;

        // Focus the underlying textarea once the transition settles.
        setTimeout(() => editor.focus(), 100);
    }

    /* Return the bio section to display mode. */
    function exitBioEditMode() {
        if (!bioState.isEditing) return;

        const displaySection = document.getElementById('profileBioSection');
        const editSection = document.getElementById('profileBioEditSection');
        if (!displaySection || !editSection) return;

        // Keep the display section hidden when the bio is empty.
        const currentBio = (bioState.user && bioState.user.bio) || '';
        displaySection.hidden = !currentBio.trim();

        editSection.hidden = true;
        bioState.isEditing = false;
    }

    /**
     * Persist the current editor contents to the server, then refresh
     * the preview and exit editing mode.
     */
    async function saveBio() {
        const editor = bioState.editor;
        if (!editor) return;

        const saveBtn = document.getElementById('saveBioBtn');
        const cancelBtn = document.getElementById('cancelBioBtn');
        const originalText = saveBtn ? saveBtn.textContent : 'Save';

        const newBio = (editor.getValue() || '').trim();

        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.textContent = 'Saving…';
        }

        if (cancelBtn) cancelBtn.disabled = true;

        try {
            await sendJSON('/api/profile/me', 'PATCH', { bio: newBio });

            // Update the local state so the display reflects the change.
            if (bioState.user) bioState.user.bio = newBio;

            renderBioDisplay(newBio);
            exitBioEditMode();

            if (window.toast) window.toast('Your bio has been saved.', 'success');
        } catch (err) {
            console.error('[profile] save bio failed:', err);

            if (window.openDialogError) {
                window.openDialogError('Failed to save the bio', err.message || '');
            } else if (window.toast) {
                window.toast(err.message || 'Failed to save the bio.', 'error');
            }
        } finally {
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.textContent = originalText;
            }

            if (cancelBtn) cancelBtn.disabled = false;
        }
    }

    /* Bind the edit, save, and cancel handlers for the bio section. */
    function bindBioActions() {
        document.getElementById('editBioBtn')?.addEventListener('click', enterBioEditMode);
        document.getElementById('saveBioBtn')?.addEventListener('click', saveBio);
        document.getElementById('cancelBioBtn')?.addEventListener('click', () => {
            exitBioEditMode();
        });
    }

    /* Populate the profile hero, identity details, avatar, and bio. */
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
                emailBadge.textContent = '✓ Email verified';
                emailBadge.dataset.state = 'ok';
            } else {
                emailBadge.textContent = '⚠ Email verification pending';
                emailBadge.dataset.state = 'warn';
            }

            emailBadge.hidden = false;
        }

        const viewBtn = document.getElementById('viewPublicBtn');
        if (viewBtn && user.username) {
            viewBtn.href = '/users/' + encodeURIComponent(user.username);
        }

        // Render the bio in display mode.
        renderBioDisplay(user.bio);
    }

    /* Populate the profile statistics cards from the supplied stats. */
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

        // Only display a rating when at least one review exists.
        const reviewCount = Number(reviews ?? 0);
        if (reviewCount > 0 && rating !== null && rating !== undefined && !isNaN(rating)) {
            setStat('statRating', Number(rating).toFixed(1) + ' / 5');
        } else {
            setStat('statRating', '—');
        }
    }

    /* Set the text content of a statistics element by id. */
    function setStat(id, value) {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    }

    /* Render the user's most recent projects, or an empty state. */
    function renderRecentProjects(projects) {
        const wrap = document.getElementById('recentProjects');
        if (!wrap) return;

        if (!Array.isArray(projects) || !projects.length) {
            wrap.innerHTML = `
                <div class="recent-empty">
                    <p>You haven't created any projects yet.</p>
                    <a class="btn-primary" href="/dashboard/projects">Create your first project</a>
                </div>`;

            return;
        }

        wrap.innerHTML = projects.slice(0, 6).map(p => {
            const img = (p.images && p.images[0] && p.images[0].url) ? p.images[0].url : null;
            const title = escapeHtml(p.title || 'Untitled');
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
       Data Loaders
       ============================================================ */

    /* Fetch the current user's profile and render it. */
    async function loadProfile() {
        const payload = await getJSON('/api/profile/me');

        const user =
            unwrap(payload, 'user') ||
            unwrap(payload, 'profile') ||
            payload;

        renderProfile(user);

        return user;
    }

    /* Fetch aggregate statistics for the given user and render them. */
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

    /* Fetch the current user's most recent projects and render them. */
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
       Initialization
       ============================================================
       Bind bio actions, then load the profile, statistics, and
       recent projects. Failures surface through the global error
       dialog when available.
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
                window.openDialogError('Error', err.message || 'Failed to load the profile.');
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