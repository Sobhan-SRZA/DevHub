/* ============================================================
   Dashboard — Tag Types (Categories)
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
    /* ---------------- State ---------------- */
    const state = {
        view: 'approved', // 'approved' | 'pending'
        types: [],
        pendingTypes: [],
        search: '',
        sort: 'order',
    };

    const $ = (selector, root = document) => root.querySelector(selector);
    const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

    /* ---------------- DOM References ---------------- */
    const grid = $('#typesGrid');
    const searchInput = $('#ttSearch');
    const sortSelect = $('#ttSort');
    const btnNew = $('#btnNewType');
    const filtersRow = $('#filtersRow');
    const pageTitle = $('#pageTitle');
    const pageSub = $('#pageSub');
    const tabs = $$('.tt-tab');

    /* Create/Edit Modal */
    const modal = $('#typeModal');
    const modalBackdrop = $('#typeModalBackdrop');
    const modalTitle = $('#typeModalTitle');
    const modalSubtitle = $('#typeModalSubtitle');
    const modalClose = $('#typeModalClose');
    const modalCancel = $('#typeModalCancel');
    const modalSubmit = $('#typeModalSubmit');
    const form = $('#typeForm');

    /* Category Details Modal */
    const detailModal = $('#detailModal');
    const detailBackdrop = $('#detailBackdrop');
    const detailClose = $('#detailClose');
    const detailCloseBtn = $('#detailCloseBtn');
    const detailTitle = $('#detailTitle');
    const detailSubtitle = $('#detailSubtitle');
    const detailTags = $('#detailTags');

    /* ============================================================
       API
       ============================================================ */

    /**
     * Sends an authenticated API request and parses the JSON response.
     *
     * @param {string} path - The API endpoint.
     * @param {RequestInit} opts - Additional fetch options.
     * @returns {Promise<any>} The parsed API response.
     * @throws {Error} If the request fails.
     */
    async function api(path, opts = {}) {
        const res = await fetch(path, {
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            ...opts,
        });

        let data = null;

        try {
            data = await res.json();
        } catch {
            // The response may not contain valid JSON.
        }

        if (!res.ok) {
            const err = new Error(data?.message || 'An error occurred.');
            Object.assign(err, data, { status: res.status });
            throw err;
        }

        return data;
    }

    /* ============================================================
       Load Data
       ============================================================ */

    async function loadAll() {
        grid.innerHTML = `<div class="dash-loading">Loading...</div>`;

        try {
            const [approved, pending] = await Promise.all([
                api('/api/tag-types').catch(() => ({ types: [] })),
                api('/api/tags/pending').catch(() => ({ types: [] })),
            ]);

            state.types = approved.types || [];
            state.pendingTypes = pending.types || [];

            updateCounts();
            render();
        } catch (err) {
            grid.innerHTML = `
                <div class="tt-empty">
                    <div class="tt-empty__icon">⚠️</div>
                    <h3 class="tt-empty__title">Failed to Load Categories</h3>
                    <p class="tt-empty__sub">${escapeHtml(err.message || '')}</p>
                    <button class="btn-primary" onclick="location.reload()">Try Again</button>
                </div>
            `;
        }
    }

    function updateCounts() {
        $('#approvedCount').textContent = state.types.length;
        $('#pendingCount').textContent = state.pendingTypes.length;

        // Hide the pending tab when there are no pending categories.
        const pendingTab = $('#pendingTab');

        if (state.pendingTypes.length === 0) {
            pendingTab.style.display = 'none';

            if (state.view === 'pending') {
                state.view = 'approved';
                setView('approved');
            }
        } else {
            pendingTab.style.display = '';
        }
    }

    /* ============================================================
       View Switching
       ============================================================ */

    tabs.forEach((tab) => {
        tab.addEventListener('click', () => setView(tab.dataset.view));
    });

    function setView(view) {
        state.view = view;

        tabs.forEach((tab) => {
            tab.classList.toggle('active', tab.dataset.view === view);
        });

        if (view === 'pending') {
            pageTitle.textContent = 'Pending Approval';
            pageSub.textContent = 'User-submitted categories awaiting review and approval.';
            btnNew.style.display = 'none';
            filtersRow.style.display = 'none';
        } else {
            pageTitle.textContent = 'Tag Categories';
            pageSub.textContent = 'Manage tag categories, similar to GitHub Topics.';
            btnNew.style.display = '';
            filtersRow.style.display = '';
        }

        render();
    }

    /* ============================================================
       Render Categories
       ============================================================ */

    function render() {
        const source = state.view === 'pending'
            ? state.pendingTypes
            : state.types;

        /* Filter categories */
        let items = source.slice();

        if (state.search && state.view !== 'pending') {
            const query = state.search.toLowerCase();

            items = items.filter((type) =>
                type.name.toLowerCase().includes(query) ||
                type.slug.toLowerCase().includes(query)
            );
        }

        /* Sort approved categories */
        if (state.view === 'approved') {
            const sortMap = {
                order: (a, b) =>
                    (a.order || 0) - (b.order || 0) ||
                    a.name.localeCompare(b.name),
                name: (a, b) => a.name.localeCompare(b.name),
                usage: (a, b) => (b.tagCount || 0) - (a.tagCount || 0),
                recent: (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
            };

            items.sort(sortMap[state.sort] || sortMap.order);
        }

        if (!items.length) {
            const isPending = state.view === 'pending';

            grid.innerHTML = `
                <div class="tt-empty">
                    <div class="tt-empty__icon">${isPending ? '✅' : '🏷️'}</div>
                    <h3 class="tt-empty__title">
                        ${isPending ? 'All Caught Up!' : 'No Categories Found'}
                    </h3>
                    <p class="tt-empty__sub">
                        ${isPending
                    ? 'There are no categories awaiting approval.'
                    : 'Create your first category to get started.'}
                    </p>
                    ${!isPending
                    ? `<button class="btn-primary" onclick="document.getElementById('btnNewType').click()">Create Category</button>`
                    : ''}
                </div>
            `;

            return;
        }

        grid.innerHTML = items.map(renderCard).join('');
        bindCardActions();
    }

    function renderCard(type) {
        const isPending = state.view === 'pending';
        const isSystem = Boolean(type.isSystem);

        // The server enforces edit and deletion permissions.
        const canEdit = true;
        const canDelete = !isSystem || true;

        return `
            <div class="tt-card" style="--tt-color:${type.color}" data-id="${type._id}">
                <div class="tt-card__head">
                    <div class="tt-card__icon">${escapeHtml(type.icon || '🏷')}</div>
                    <div class="tt-card__title-wrap">
                        <h3 class="tt-card__title">${escapeHtml(type.name)}</h3>
                        <div class="tt-card__slug">${escapeHtml(type.slug)}</div>
                    </div>
                </div>

                <p class="tt-card__desc">
                    ${escapeHtml(type.description || 'No description provided.')}
                </p>

                <div class="tt-card__meta">
                    <span class="tt-chip">
                        <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path>
                        </svg>
                        ${type.tagCount || 0} tags
                    </span>

                    ${isSystem ? `
                        <span class="tt-chip tt-chip--system">
                            <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                            </svg>
                            System
                        </span>
                    ` : ''}

                    ${isPending ? `
                        <span class="tt-chip tt-chip--pending">
                            <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                <circle cx="12" cy="12" r="10"></circle>
                                <polyline points="12 6 12 12 16 14"></polyline>
                            </svg>
                            Pending Approval
                        </span>
                    ` : ''}

                    ${!type.allowUserTags ? `
                        <span class="tt-chip tt-chip--locked">
                            <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                            </svg>
                            Admin Only
                        </span>
                    ` : ''}
                </div>

                <div class="tt-card__actions">
                    ${isPending ? `
                        <button type="button" class="tt-action tt-action--success" data-action="approve">
                            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                <polyline points="20 6 9 17 4 12"></polyline>
                            </svg>
                            Approve
                        </button>
                        <button type="button" class="tt-action tt-action--danger" data-action="delete">
                            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"></path>
                            </svg>
                            Reject
                        </button>
                    ` : `
                        <button type="button" class="tt-action" data-action="view">
                            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                                <circle cx="12" cy="12" r="3"></circle>
                            </svg>
                            View Tags
                        </button>
                        <button type="button" class="tt-action" data-action="edit">
                            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                            </svg>
                            Edit
                        </button>
                        <button type="button" class="tt-action tt-action--danger" data-action="delete">
                            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"></path>
                            </svg>
                            Delete
                        </button>
                    `}
                </div>
            </div>
        `;
    }

    function bindCardActions() {
        $$('.tt-card').forEach((card) => {
            const id = card.dataset.id;

            card.querySelectorAll('[data-action]').forEach((btn) => {
                btn.addEventListener('click', (event) => {
                    event.stopPropagation();

                    const action = btn.dataset.action;

                    if (action === 'edit') openEdit(id);
                    else if (action === 'delete') remove(id);
                    else if (action === 'approve') approve(id);
                    else if (action === 'view') openDetail(id);
                });
            });
        });
    }

    /* ============================================================
       Create/Edit Modal
       ============================================================ */

    function openModal() {
        modal.classList.add('open');
        modalBackdrop.classList.add('open');
        document.body.style.overflow = 'hidden';
    }

    function closeModal() {
        modal.classList.remove('open');
        modalBackdrop.classList.remove('open');
        document.body.style.overflow = '';

        state.editingId = null;

        form.reset();
        FormKit.clearAllErrors(form);
        updatePreview();
    }

    modalClose.addEventListener('click', closeModal);
    modalCancel.addEventListener('click', closeModal);
    modalBackdrop.addEventListener('click', closeModal);

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && modal.classList.contains('open')) {
            closeModal();
        }
    });

    btnNew.addEventListener('click', () => {
        state.editingId = null;

        form.reset();
        form.elements.color.value = '#6ebbff';
        form.elements.order.value = 0;
        form.elements.allowUserTags.checked = true;
        form.elements.icon.value = '';

        modalTitle.textContent = 'Create Category';
        modalSubtitle.textContent = 'Create a category to organize related tags.';
        modalSubmit.textContent = 'Create Category';

        updatePreview();
        openModal();

        setTimeout(() => form.elements.name.focus(), 200);
    });

    function openEdit(id) {
        const type = state.types.find((item) => item._id === id);
        if (!type) return;

        state.editingId = id;

        modalTitle.textContent = 'Edit Category';
        modalSubtitle.textContent = type.name;
        modalSubmit.textContent = 'Save Changes';

        form.elements._id.value = type._id;
        form.elements.name.value = type.name;
        form.elements.slug.value = type.slug;
        form.elements.icon.value = type.icon || '';
        form.elements.color.value = type.color || '#6ebbff';
        form.elements.description.value = type.description || '';
        form.elements.order.value = type.order || 0;
        form.elements.allowUserTags.checked = type.allowUserTags !== false;

        updatePreview();
        openModal();
    }

    /* ============================================================
       Category Preview
       ============================================================ */

    function updatePreview() {
        const name = form.elements.name.value.trim() || 'Category Name';
        const icon = form.elements.icon.value.trim() || '🏷';
        const color = form.elements.color.value || '#6ebbff';

        $('#previewIcon').textContent = icon;
        $('#previewName').textContent = name;

        const card = $('#typePreview').querySelector('.tt-preview__card');
        card.style.setProperty('--tt-color', color);
    }

    form.elements.name?.addEventListener('input', updatePreview);
    form.elements.icon?.addEventListener('input', updatePreview);
    form.elements.color?.addEventListener('input', updatePreview);

    /* Color Presets */
    $$('.tt-color-dot').forEach((btn) => {
        btn.addEventListener('click', () => {
            form.elements.color.value = btn.dataset.color;
            updatePreview();
        });
    });

    /* ============================================================
       Submit Form
       ============================================================ */

    form.addEventListener('submit', async (event) => {
        event.preventDefault();

        const values = {
            name: form.elements.name.value.trim(),
            slug: form.elements.slug.value.trim().toLowerCase() || undefined,
            icon: form.elements.icon.value.trim() || undefined,
            color: form.elements.color.value,
            description: form.elements.description.value.trim() || undefined,
            order: Number(form.elements.order.value) || 0,
            allowUserTags: form.elements.allowUserTags.checked,
        };

        if (!values.name || values.name.length < 2) {
            return FormKit.showFieldError(
                form.elements.name,
                'The name must contain at least 2 characters.'
            );
        }

        FormKit.clearAllErrors(form);

        modalSubmit.disabled = true;

        const originalText = modalSubmit.textContent;
        modalSubmit.textContent = 'Saving...';

        try {
            const isEdit = Boolean(state.editingId);
            const url = isEdit
                ? `/api/tag-types/${state.editingId}`
                : '/api/tag-types';
            const method = isEdit ? 'PUT' : 'POST';

            await api(url, {
                method,
                body: JSON.stringify(values),
            });

            toast(
                isEdit ? 'Category updated successfully.' : 'Category created successfully.',
                'success'
            );

            closeModal();
            await loadAll();
        } catch (err) {
            if (err.details || err.field) {
                FormKit.applyServerErrors(form, err);
            }

            toast(err.message || 'Failed to save the category.', 'error');
        } finally {
            modalSubmit.disabled = false;
            modalSubmit.textContent = originalText;
        }
    });

    /* ============================================================
       Delete / Approve Categories
       ============================================================ */

    async function remove(id) {
        const source = state.view === 'pending'
            ? state.pendingTypes
            : state.types;

        const type = source.find((item) => item._id === id);
        const isPending = state.view === 'pending';

        const confirmed = await confirmDialog({
            title: isPending ? 'Reject Category' : 'Delete Category',
            message: isPending
                ? `Are you sure you want to reject "${type?.name}"?`
                : `Are you sure you want to delete "${type?.name}"? Categories can only be deleted if they have no associated tags.`,
            confirmText: isPending ? 'Yes, Reject' : 'Yes, Delete',
            danger: true,
        });

        if (!confirmed) return;

        try {
            await api(`/api/tag-types/${id}`, { method: 'DELETE' });

            toast(
                isPending ? 'Category rejected successfully.' : 'Category deleted successfully.',
                'success'
            );

            await loadAll();
        } catch (err) {
            toast(err.message || 'An error occurred.', 'error');
        }
    }

    async function approve(id) {
        try {
            await api(`/api/tag-types/${id}/approve`, { method: 'POST' });

            toast('Category approved successfully.', 'success');
            await loadAll();
        } catch (err) {
            toast(err.message || 'Failed to approve the category.', 'error');
        }
    }

    /* ============================================================
       Category Details Modal
       ============================================================ */

    function openDetail(id) {
        const type = state.types.find((item) => item._id === id);
        if (!type) return;

        detailTitle.textContent = `${type.icon || '🏷'} ${type.name}`;
        detailSubtitle.textContent = type.description || type.slug;
        detailTags.innerHTML = `<div class="dash-loading">Loading...</div>`;

        detailModal.classList.add('open');
        detailBackdrop.classList.add('open');
        document.body.style.overflow = 'hidden';

        loadDetailTags(id);
    }

    function closeDetail() {
        detailModal.classList.remove('open');
        detailBackdrop.classList.remove('open');
        document.body.style.overflow = '';
    }

    detailClose.addEventListener('click', closeDetail);
    detailCloseBtn.addEventListener('click', closeDetail);
    detailBackdrop.addEventListener('click', closeDetail);

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && detailModal.classList.contains('open')) {
            closeDetail();
        }
    });

    async function loadDetailTags(id) {
        try {
            const data = await api(`/api/tag-types/${id}`);
            const tags = data.tags || [];

            if (!tags.length) {
                detailTags.innerHTML = `
                    <div class="panel-empty">
                        No tags belong to this category yet.
                    </div>
                `;

                return;
            }

            detailTags.innerHTML = tags.map((tag) => `
                <div class="detail-tag-row">
                    <span class="detail-tag-row__swatch" style="background:${tag.color}"></span>
                    <span class="detail-tag-row__name">${escapeHtml(tag.name)}</span>
                    <span class="detail-tag-row__usage">${tag.usageCount || 0} uses</span>
                </div>
            `).join('');
        } catch {
            detailTags.innerHTML = `
                <div class="panel-empty">Failed to load tags.</div>
            `;
        }
    }

    /* ============================================================
       Search and Sorting
       ============================================================ */

    let searchTimer;

    searchInput.addEventListener('input', () => {
        clearTimeout(searchTimer);

        searchTimer = setTimeout(() => {
            state.search = searchInput.value.trim();
            render();
        }, 250);
    });

    sortSelect.addEventListener('change', () => {
        state.sort = sortSelect.value;
        render();
    });

    /* ============================================================
       Helpers
       ============================================================ */

    /**
     * Escapes HTML-sensitive characters to prevent markup injection.
     *
     * @param {unknown} value - The value to escape.
     * @returns {string} The HTML-safe string.
     */
    function escapeHtml(value) {
        if (value == null) return '';

        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    /* ============================================================
       Initialization
       ============================================================ */

    setView('approved');
    loadAll();
});

/**
 * Copyright (c) 2026 Sobhan Rasoulzadeh Asl (Sobhan-SRZA / Mr. Sinre)
 *
 * Licensed under the BSD 3-Clause License.
 * See the LICENSE file in the project root for license information.
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */