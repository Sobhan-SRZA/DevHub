/* ============================================================
   Dashboard — Tags
   ============================================================
   Manages the tag administration view: a paginated, searchable,
   and filterable tag list, plus a modal for creating and editing
   tags. Deletion is guarded by a confirmation prompt.
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
    /* --------------------------------------------------------
       View State
       --------------------------------------------------------
       Centralised state for the list query, the category
       reference data, and the modal's editing context.
       -------------------------------------------------------- */
    const state = {
        page: 1,
        limit: 30,
        search: '',
        type: '',
        sort: 'usage',
        items: [],
        types: [],
        totalPages: 1,
        editingId: null,
    };

    const $ = (selector, root = document) => root.querySelector(selector);
    const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

    /* ---------- List references ---------- */
    const listEl = $('#tagsList');
    const pagEl = $('#tagsPagination');
    const countEl = $('#tagsCount');
    const searchEl = $('#tagSearch');
    const typeFilterEl = $('#tagFilterType');
    const sortEl = $('#tagSort');
    const btnNew = $('#btnNewTag');

    /* ---------- Modal references ---------- */
    const modal = $('#tagModal');
    const modalBg = $('#tagModalBackdrop');
    const modalTitle = $('#tagModalTitle');
    const modalClose = $('#tagModalClose');
    const modalCancel = $('#tagModalCancel');
    const modalSubmit = $('#tagModalSubmit');
    const form = $('#tagForm');

    /* ============================================================
       API Helper
       ============================================================
       Sends credentialed JSON requests and normalises failures
       into Error objects carrying the server payload and status.
       ============================================================ */
    async function api(path, opts = {}) {
        const res = await fetch(path, {
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            ...opts,
        });

        let data = null;
        try {
            data = await res.json();
        } catch { /* Ignore JSON parse failures. */ }

        if (!res.ok) {
            const err = new Error(data?.message || 'Error');
            Object.assign(err, data, { status: res.status });
            throw err;
        }

        return data;
    }

    /* ============================================================
       Category Loading
       ============================================================
       Populates both the filter dropdown and the modal's category
       selector from the available tag categories.
       ============================================================ */
    async function loadTypes() {
        try {
            const d = await api('/api/tag-types');
            state.types = d.types || [];

            // Filter dropdown.
            typeFilterEl.innerHTML = `<option value="">All types</option>` +
                state.types.map((t) => `<option value="${t._id}">${escapeHtml(t.name)}</option>`).join('');

            // Category selector within the modal form.
            const select = form.elements.type;
            select.innerHTML = state.types.map((t) =>
                `<option value="${t._id}">${escapeHtml(t.name)}</option>`
            ).join('');
        } catch { /* Non-critical — the page remains usable without categories. */ }
    }

    /* ============================================================
       Tag List Loading
       ============================================================
       Fetches the current page of tags using the active search,
       category, and sort filters, then renders the list and
       pagination controls.
       ============================================================ */
    async function loadTags() {
        listEl.innerHTML = `<div class="dash-loading">Loading…</div>`;

        try {
            const params = new URLSearchParams({
                page: state.page,
                limit: state.limit,
                sort: state.sort,
            });

            if (state.search) params.set('search', state.search);
            if (state.type) params.set('type', state.type);

            const d = await api(`/api/tags?${params}`);

            state.items = d.tags || [];
            state.totalPages = d.pagination?.pages || 1;

            countEl.textContent = d.pagination?.total === 0
                ? 'No tags exist'
                : `${d.pagination?.total} tag${d.pagination?.total === 1 ? '' : 's'}`;

            render();
            renderPagination();
        } catch (err) {
            listEl.innerHTML = `<div class="dash-empty"><div class="dash-empty__icon">⚠️</div>
                <h3 class="dash-empty__title">Error</h3>
                <p class="dash-empty__sub">${escapeHtml(err.message)}</p></div>`;
        }
    }

    /* Render the tag rows, or an empty state when no tags exist. */
    function render() {
        if (!state.items.length) {
            listEl.innerHTML = `<div class="dash-empty">
                <div class="dash-empty__icon">🏷️</div>
                <h3 class="dash-empty__title">No tags exist</h3>
                <p class="dash-empty__sub">Create the first tag.</p>
            </div>`;

            return;
        }

        listEl.innerHTML = state.items.map((t) => `
            <div class="tag-row" data-id="${t._id}">
                <span class="tag-row__swatch" style="background:${t.color}"></span>
                <div class="tag-row__body">
                    <div class="tag-row__name">${escapeHtml(t.name)}</div>
                    <div class="tag-row__meta">
                        <span class="tag-row__type">${escapeHtml(t.type?.name || '—')}</span>
                        <span>${t.usageCount || 0} use${t.usageCount === 1 ? '' : 's'}</span>
                    </div>
                </div>
                <div class="tag-row__actions">
                    <button class="tag-row__btn" data-action="edit" title="Edit">
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                    </button>
                    <button class="tag-row__btn tag-row__btn--danger" data-action="delete" title="Delete">
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"></path></svg>
                    </button>
                </div>
            </div>
        `).join('');

        listEl.querySelectorAll('.tag-row').forEach((row) => {
            const id = row.dataset.id;

            row.querySelector('[data-action="edit"]')?.addEventListener('click', () => openEdit(id));
            row.querySelector('[data-action="delete"]')?.addEventListener('click', () => remove(id));
        });
    }

    /* Render the pagination controls. */
    function renderPagination() {
        if (state.totalPages <= 1) {
            pagEl.innerHTML = '';
            return;
        }

        pagEl.innerHTML = `
            <button class="page-btn" ${state.page === 1 ? 'disabled' : ''} data-page="${state.page - 1}">Previous</button>
            ${Array.from({ length: state.totalPages }, (_, i) => i + 1).map((p) =>
            `<button class="page-btn ${p === state.page ? 'active' : ''}" data-page="${p}">${p}</button>`
        ).join('')}
            <button class="page-btn" ${state.page === state.totalPages ? 'disabled' : ''} data-page="${state.page + 1}">Next</button>
        `;

        pagEl.querySelectorAll('[data-page]').forEach((b) => {
            b.addEventListener('click', () => {
                const p = Number(b.dataset.page);

                if (p >= 1 && p <= state.totalPages) {
                    state.page = p;
                    loadTags();
                }
            });
        });
    }

    /* ============================================================
       Modal Controls
       ============================================================ */

    /* Open the modal and lock page scrolling. */
    function openModal() {
        modal.classList.add('open');
        modalBg.classList.add('open');
        document.body.style.overflow = 'hidden';
    }

    /* Close the modal, reset the form, and clear the editing context. */
    function closeModal() {
        modal.classList.remove('open');
        modalBg.classList.remove('open');
        document.body.style.overflow = '';

        state.editingId = null;
        form.reset();
        FormKit.clearAllErrors(form);
    }

    modalClose.addEventListener('click', closeModal);
    modalCancel.addEventListener('click', closeModal);
    modalBg.addEventListener('click', closeModal);

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.classList.contains('open')) closeModal();
    });

    /* Open the modal in "create" mode with a default colour. */
    btnNew.addEventListener('click', () => {
        state.editingId = null;
        form.reset();
        $('#t-color').value = '#6ebbff';
        modalTitle.textContent = 'New tag';
        modalSubmit.textContent = 'Create tag';
        openModal();
    });

    /* Open the modal in "edit" mode, populated with the selected tag. */
    function openEdit(id) {
        const t = state.items.find((x) => x._id === id);
        if (!t) return;

        state.editingId = id;
        modalTitle.textContent = 'Edit tag';
        modalSubmit.textContent = 'Save';

        form.elements._id.value = t._id;
        form.elements.name.value = t.name;
        form.elements.type.value = t.type?._id || t.type;
        form.elements.color.value = t.color || '#6ebbff';
        form.elements.description.value = t.description || '';

        openModal();
    }

    /* ============================================================
       Form Submission
       ============================================================
       Validates the required fields, then creates or updates the
       tag. Server-side field errors are applied through FormKit.
       ============================================================ */
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const values = {
            name: form.elements.name.value.trim(),
            type: form.elements.type.value,
            color: form.elements.color.value,
            description: form.elements.description.value.trim() || undefined,
        };

        if (!values.name) return FormKit.showFieldError(form.elements.name, 'Name is required.');
        if (!values.type) return FormKit.showFieldError(form.elements.type, 'Category is required.');

        FormKit.clearAllErrors(form);

        modalSubmit.disabled = true;
        const old = modalSubmit.textContent;
        modalSubmit.textContent = 'Saving…';

        try {
            const isEdit = !!state.editingId;
            const url = isEdit ? `/api/tags/${state.editingId}` : '/api/tags';
            const method = isEdit ? 'PUT' : 'POST';

            await api(url, { method, body: JSON.stringify(values) });

            toast(isEdit ? 'The tag has been updated.' : 'The tag has been created.', 'success');

            closeModal();
            await loadTags();
        } catch (err) {
            if (err.field || err.details) FormKit.applyServerErrors(form, err);

            toast(err.message || 'An error occurred.', 'error');
        } finally {
            modalSubmit.disabled = false;
            modalSubmit.textContent = old;
        }
    });

    /* ============================================================
       Deletion
       ============================================================
       Requests confirmation, then deletes the tag and refreshes
       the list.
       ============================================================ */
    async function remove(id) {
        const t = state.items.find((x) => x._id === id);

        const ok = await confirmDialog({
            title: 'Delete tag',
            message: `Delete the tag "${t?.name}"?`,
            confirmText: 'Delete',
            danger: true,
        });

        if (!ok) return;

        try {
            await api(`/api/tags/${id}`, { method: 'DELETE' });

            toast('The tag has been deleted.', 'success');

            await loadTags();
        } catch (err) {
            toast(err.message || 'Deletion failed.', 'error');
        }
    }

    /* ============================================================
       Filters
       ============================================================ */

    /* Debounce the search input to avoid excessive requests. */
    let timer;

    searchEl.addEventListener('input', () => {
        clearTimeout(timer);
        timer = setTimeout(() => {
            state.search = searchEl.value.trim();
            state.page = 1;
            loadTags();
        }, 300);
    });

    typeFilterEl.addEventListener('change', () => {
        state.type = typeFilterEl.value;
        state.page = 1;

        loadTags();
    });

    sortEl.addEventListener('change', () => {
        state.sort = sortEl.value;
        state.page = 1;

        loadTags();
    });

    /* ============================================================
       Helpers
       ============================================================ */

    /* Escape user-supplied strings before interpolating them into HTML. */
    function escapeHtml(s) {
        if (s == null) return '';

        return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    /* ============================================================
       Initialization
       ============================================================ */
    (async () => {
        await loadTypes();
        await loadTags();
    })();
});

/**
 * Copyright (c) 2026 Sobhan Rasoulzadeh Asl (Sobhan-SRZA / Mr. Sinre)
 *
 * Licensed under the BSD 3-Clause License.
 * See the LICENSE file in the project root for license information.
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */