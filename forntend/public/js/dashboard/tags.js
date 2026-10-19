/* ============================================================
   Dashboard — Tags
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
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

    const $ = (s, r = document) => r.querySelector(s);
    const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

    const listEl = $('#tagsList');
    const pagEl = $('#tagsPagination');
    const countEl = $('#tagsCount');
    const searchEl = $('#tagSearch');
    const typeFilterEl = $('#tagFilterType');
    const sortEl = $('#tagSort');
    const btnNew = $('#btnNewTag');

    /* modal */
    const modal = $('#tagModal');
    const modalBg = $('#tagModalBackdrop');
    const modalTitle = $('#tagModalTitle');
    const modalClose = $('#tagModalClose');
    const modalCancel = $('#tagModalCancel');
    const modalSubmit = $('#tagModalSubmit');
    const form = $('#tagForm');

    /* ---------- API ---------- */
    async function api(path, opts = {}) {
        const res = await fetch(path, {
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            ...opts,
        });
        let data = null;
        try { data = await res.json(); } catch { }
        if (!res.ok) {
            const err = new Error(data?.message || 'خطا');
            Object.assign(err, data, { status: res.status });
            throw err;
        }
        return data;
    }

    /* ---------- Load types ---------- */
    async function loadTypes() {
        try {
            const d = await api('/api/tag-types');
            state.types = d.types || [];
            typeFilterEl.innerHTML = `<option value="">همه نوع‌ها</option>` +
                state.types.map((t) => `<option value="${t._id}">${escapeHtml(t.name)}</option>`).join('');

            const select = form.elements.type;
            select.innerHTML = state.types.map((t) =>
                `<option value="${t._id}">${escapeHtml(t.name)}</option>`
            ).join('');
        } catch { }
    }

    /* ---------- Load tags ---------- */
    async function loadTags() {
        listEl.innerHTML = `<div class="dash-loading">در حال بارگذاری…</div>`;
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
                ? 'هیچ تگی وجود ندارد'
                : `${d.pagination?.total} تگ`;

            render();
            renderPagination();
        } catch (err) {
            listEl.innerHTML = `<div class="dash-empty"><div class="dash-empty__icon">⚠️</div>
                <h3 class="dash-empty__title">خطا</h3>
                <p class="dash-empty__sub">${escapeHtml(err.message)}</p></div>`;
        }
    }

    function render() {
        if (!state.items.length) {
            listEl.innerHTML = `<div class="dash-empty">
                <div class="dash-empty__icon">🏷️</div>
                <h3 class="dash-empty__title">تگی وجود ندارد</h3>
                <p class="dash-empty__sub">اولین تگ را بسازید</p>
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
                        <span>${t.usageCount || 0} استفاده</span>
                    </div>
                </div>
                <div class="tag-row__actions">
                    <button class="tag-row__btn" data-action="edit" title="ویرایش">
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                    </button>
                    <button class="tag-row__btn tag-row__btn--danger" data-action="delete" title="حذف">
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

    function renderPagination() {
        if (state.totalPages <= 1) { pagEl.innerHTML = ''; return; }
        pagEl.innerHTML = `
            <button class="page-btn" ${state.page === 1 ? 'disabled' : ''} data-page="${state.page - 1}">قبلی</button>
            ${Array.from({ length: state.totalPages }, (_, i) => i + 1).map((p) =>
            `<button class="page-btn ${p === state.page ? 'active' : ''}" data-page="${p}">${p}</button>`
        ).join('')}
            <button class="page-btn" ${state.page === state.totalPages ? 'disabled' : ''} data-page="${state.page + 1}">بعدی</button>
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

    /* ---------- Modal ---------- */
    function openModal() {
        modal.classList.add('open');
        modalBg.classList.add('open');
        document.body.style.overflow = 'hidden';
    }
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

    btnNew.addEventListener('click', () => {
        state.editingId = null;
        form.reset();
        $('#t-color').value = '#6ebbff';
        modalTitle.textContent = 'تگ جدید';
        modalSubmit.textContent = 'ساخت تگ';
        openModal();
    });

    function openEdit(id) {
        const t = state.items.find((x) => x._id === id);
        if (!t) return;
        state.editingId = id;
        modalTitle.textContent = 'ویرایش تگ';
        modalSubmit.textContent = 'ذخیره';

        form.elements._id.value = t._id;
        form.elements.name.value = t.name;
        form.elements.type.value = t.type?._id || t.type;
        form.elements.color.value = t.color || '#6ebbff';
        form.elements.description.value = t.description || '';

        openModal();
    }

    /* ---------- Submit ---------- */
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const values = {
            name: form.elements.name.value.trim(),
            type: form.elements.type.value,
            color: form.elements.color.value,
            description: form.elements.description.value.trim() || undefined,
        };

        if (!values.name) return FormKit.showFieldError(form.elements.name, 'نام الزامی است');
        if (!values.type) return FormKit.showFieldError(form.elements.type, 'نوع الزامی است');

        FormKit.clearAllErrors(form);
        modalSubmit.disabled = true;
        const old = modalSubmit.textContent;
        modalSubmit.textContent = 'در حال ذخیره…';

        try {
            const isEdit = !!state.editingId;
            const url = isEdit ? `/api/tags/${state.editingId}` : '/api/tags';
            const method = isEdit ? 'PUT' : 'POST';

            await api(url, { method, body: JSON.stringify(values) });
            toast(isEdit ? 'تگ ویرایش شد' : 'تگ ساخته شد', 'success');
            closeModal();
            await loadTags();
        } catch (err) {
            if (err.field || err.details) FormKit.applyServerErrors(form, err);
            toast(err.message || 'خطا', 'error');
        } finally {
            modalSubmit.disabled = false;
            modalSubmit.textContent = old;
        }
    });

    /* ---------- Delete ---------- */
    async function remove(id) {
        const t = state.items.find((x) => x._id === id);
        const ok = await confirmDialog({
            title: 'حذف تگ',
            message: `تگ «${t?.name}» حذف شود؟`,
            confirmText: 'حذف کن',
            danger: true,
        });
        if (!ok) return;

        try {
            await api(`/api/tags/${id}`, { method: 'DELETE' });
            toast('تگ حذف شد', 'success');
            await loadTags();
        } catch (err) {
            toast(err.message || 'حذف ناموفق', 'error');
        }
    }

    /* ---------- Filters ---------- */
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

    /* ---------- Helpers ---------- */
    function escapeHtml(s) {
        if (s == null) return '';
        return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    /* ---------- Init ---------- */
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