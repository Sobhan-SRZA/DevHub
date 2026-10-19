/* ============================================================
   Dashboard — Tag Types (Categories)
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
    /* ---------------- State ---------------- */
    const state = {
        view: 'approved',       // 'approved' | 'pending'
        types: [],
        pendingTypes: [],
        search: '',
        sort: 'order',
    };

    const $ = (s, r = document) => r.querySelector(s);
    const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

    /* ---------------- Refs ---------------- */
    const grid = $('#typesGrid');
    const searchInput = $('#ttSearch');
    const sortSelect = $('#ttSort');
    const btnNew = $('#btnNewType');
    const filtersRow = $('#filtersRow');
    const pageTitle = $('#pageTitle');
    const pageSub = $('#pageSub');
    const tabs = $$('.tt-tab');

    /* Modal */
    const modal = $('#typeModal');
    const modalBackdrop = $('#typeModalBackdrop');
    const modalTitle = $('#typeModalTitle');
    const modalSubtitle = $('#typeModalSubtitle');
    const modalClose = $('#typeModalClose');
    const modalCancel = $('#typeModalCancel');
    const modalSubmit = $('#typeModalSubmit');
    const form = $('#typeForm');

    /* Detail modal */
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

    /* ============================================================
       Load data
       ============================================================ */
    async function loadAll() {
        grid.innerHTML = `<div class="dash-loading">در حال بارگذاری…</div>`;

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
            grid.innerHTML = `<div class="tt-empty">
                <div class="tt-empty__icon">⚠️</div>
                <h3 class="tt-empty__title">خطا در بارگذاری</h3>
                <p class="tt-empty__sub">${escapeHtml(err.message || '')}</p>
                <button class="btn-primary" onclick="location.reload()">تلاش مجدد</button>
            </div>`;
        }
    }

    function updateCounts() {
        $('#approvedCount').textContent = state.types.length;
        $('#pendingCount').textContent = state.pendingTypes.length;

        // مخفی کردن تب pending اگه خالی
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
       View switching
       ============================================================ */
    tabs.forEach((tab) => {
        tab.addEventListener('click', () => setView(tab.dataset.view));
    });

    function setView(view) {
        state.view = view;
        tabs.forEach((t) => t.classList.toggle('active', t.dataset.view === view));

        if (view === 'pending') {
            pageTitle.textContent = 'در انتظار تایید';
            pageSub.textContent = 'کتگوری‌هایی که کاربران ساخته‌اند و نیاز به تایید دارند';
            btnNew.style.display = 'none';
            filtersRow.style.display = 'none';
        } else {
            pageTitle.textContent = 'کتگوری‌های تگ';
            pageSub.textContent = 'مدیریت دسته‌بندی تگ‌ها (مثل GitHub Topics)';
            btnNew.style.display = '';
            filtersRow.style.display = '';
        }

        render();
    }

    /* ============================================================
       Render
       ============================================================ */
    function render() {
        const source = state.view === 'pending' ? state.pendingTypes : state.types;

        /* filter */
        let items = source.slice();
        if (state.search && state.view !== 'pending') {
            const q = state.search.toLowerCase();
            items = items.filter(
                (t) =>
                    t.name.toLowerCase().includes(q) ||
                    t.slug.toLowerCase().includes(q)
            );
        }

        /* sort (فقط در approved) */
        if (state.view === 'approved') {
            const sortMap = {
                order: (a, b) => (a.order || 0) - (b.order || 0) || a.name.localeCompare(b.name),
                name: (a, b) => a.name.localeCompare(b.name),
                usage: (a, b) => (b.tagCount || 0) - (a.tagCount || 0),
                recent: (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
            };
            items.sort(sortMap[state.sort] || sortMap.order);
        }

        if (!items.length) {
            const isPending = state.view === 'pending';
            grid.innerHTML = `<div class="tt-empty">
                <div class="tt-empty__icon">${isPending ? '✅' : '🏷️'}</div>
                <h3 class="tt-empty__title">${isPending ? 'همه تایید شده‌اند' : 'هیچ کتگوری‌ای وجود ندارد'}</h3>
                <p class="tt-empty__sub">${isPending ? 'کتگوری در انتظار تایید نیست' : 'اولین کتگوری را بسازید'}</p>
                ${!isPending ? `<button class="btn-primary" onclick="document.getElementById('btnNewType').click()">ساخت کتگوری</button>` : ''}
            </div>`;
            return;
        }

        grid.innerHTML = items.map(renderCard).join('');
        bindCardActions();
    }

    function renderCard(t) {
        const isPending = state.view === 'pending';
        const isSystem = !!t.isSystem;
        const canEdit = true; // سرور چک می‌کنه
        const canDelete = !isSystem || true; // سرور چک می‌کنه

        return `
            <div class="tt-card" style="--tt-color:${t.color}" data-id="${t._id}">
                <div class="tt-card__head">
                    <div class="tt-card__icon">${escapeHtml(t.icon || '🏷')}</div>
                    <div class="tt-card__title-wrap">
                        <h3 class="tt-card__title">${escapeHtml(t.name)}</h3>
                        <div class="tt-card__slug">${escapeHtml(t.slug)}</div>
                    </div>
                </div>

                <p class="tt-card__desc">
                    ${escapeHtml(t.description || 'بدون توضیح')}
                </p>

                <div class="tt-card__meta">
                    <span class="tt-chip">
                        <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path>
                        </svg>
                        ${t.tagCount || 0} تگ
                    </span>

                    ${isSystem ? `
                        <span class="tt-chip tt-chip--system">
                            <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                            </svg>
                            سیستمی
                        </span>
                    ` : ''}

                    ${isPending ? `
                        <span class="tt-chip tt-chip--pending">
                            <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                <circle cx="12" cy="12" r="10"></circle>
                                <polyline points="12 6 12 12 16 14"></polyline>
                            </svg>
                            در انتظار تایید
                        </span>
                    ` : ''}

                    ${!t.allowUserTags ? `
                        <span class="tt-chip tt-chip--locked">
                            <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                            </svg>
                            فقط ادمین
                        </span>
                    ` : ''}
                </div>

                <div class="tt-card__actions">
                    ${isPending ? `
                        <button type="button" class="tt-action tt-action--success" data-action="approve">
                            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                <polyline points="20 6 9 17 4 12"></polyline>
                            </svg>
                            تایید
                        </button>
                        <button type="button" class="tt-action tt-action--danger" data-action="delete">
                            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"></path>
                            </svg>
                            رد
                        </button>
                    ` : `
                        <button type="button" class="tt-action" data-action="view">
                            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                                <circle cx="12" cy="12" r="3"></circle>
                            </svg>
                            تگ‌ها
                        </button>
                        <button type="button" class="tt-action" data-action="edit">
                            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                            </svg>
                            ویرایش
                        </button>
                        <button type="button" class="tt-action tt-action--danger" data-action="delete">
                            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"></path>
                            </svg>
                            حذف
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
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
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
       Modal — create / edit
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
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.classList.contains('open')) closeModal();
    });

    btnNew.addEventListener('click', () => {
        state.editingId = null;
        form.reset();
        form.elements.color.value = '#6ebbff';
        form.elements.order.value = 0;
        form.elements.allowUserTags.checked = true;
        form.elements.icon.value = '';
        modalTitle.textContent = 'کتگوری جدید';
        modalSubtitle.textContent = 'یک کتگوری برای گروه‌بندی تگ‌ها بسازید';
        modalSubmit.textContent = 'ساخت کتگوری';
        updatePreview();
        openModal();
        setTimeout(() => form.elements.name.focus(), 200);
    });

    function openEdit(id) {
        const t = state.types.find((x) => x._id === id);
        if (!t) return;

        state.editingId = id;
        modalTitle.textContent = 'ویرایش کتگوری';
        modalSubtitle.textContent = t.name;
        modalSubmit.textContent = 'ذخیره تغییرات';

        form.elements._id.value = t._id;
        form.elements.name.value = t.name;
        form.elements.slug.value = t.slug;
        form.elements.icon.value = t.icon || '';
        form.elements.color.value = t.color || '#6ebbff';
        form.elements.description.value = t.description || '';
        form.elements.order.value = t.order || 0;
        form.elements.allowUserTags.checked = t.allowUserTags !== false;

        updatePreview();
        openModal();
    }

    /* ============================================================
       Preview
       ============================================================ */
    function updatePreview() {
        const name = form.elements.name.value.trim() || 'نام کتگوری';
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

    /* color presets */
    $$('.tt-color-dot').forEach((btn) => {
        btn.addEventListener('click', () => {
            form.elements.color.value = btn.dataset.color;
            updatePreview();
        });
    });

    /* ============================================================
       Submit
       ============================================================ */
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

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
            return FormKit.showFieldError(form.elements.name, 'نام باید حداقل ۲ کاراکتر باشد');
        }

        FormKit.clearAllErrors(form);
        modalSubmit.disabled = true;
        const originalText = modalSubmit.textContent;
        modalSubmit.textContent = 'در حال ذخیره…';

        try {
            const isEdit = !!state.editingId;
            const url = isEdit ? `/api/tag-types/${state.editingId}` : '/api/tag-types';
            const method = isEdit ? 'PUT' : 'POST';

            await api(url, { method, body: JSON.stringify(values) });

            toast(isEdit ? 'کتگوری ویرایش شد' : 'کتگوری ساخته شد', 'success');
            closeModal();
            await loadAll();
        } catch (err) {
            if (err.details || err.field) FormKit.applyServerErrors(form, err);
            toast(err.message || 'خطا در ذخیره', 'error');
        } finally {
            modalSubmit.disabled = false;
            modalSubmit.textContent = originalText;
        }
    });

    /* ============================================================
       Delete / Approve
       ============================================================ */
    async function remove(id) {
        const source = state.view === 'pending' ? state.pendingTypes : state.types;
        const t = source.find((x) => x._id === id);
        const isPending = state.view === 'pending';

        const ok = await confirmDialog({
            title: isPending ? 'رد کتگوری' : 'حذف کتگوری',
            message: isPending
                ? `کتگوری «${t?.name}» رد شود؟`
                : `کتگوری «${t?.name}» حذف شود؟ (فقط اگه تگی نداشته باشه)`,
            confirmText: isPending ? 'بله، رد کن' : 'بله، حذف کن',
            danger: true,
        });
        if (!ok) return;

        try {
            await api(`/api/tag-types/${id}`, { method: 'DELETE' });
            toast(isPending ? 'کتگوری رد شد' : 'کتگوری حذف شد', 'success');
            await loadAll();
        } catch (err) {
            toast(err.message || 'خطا', 'error');
        }
    }

    async function approve(id) {
        try {
            await api(`/api/tag-types/${id}/approve`, { method: 'POST' });
            toast('کتگوری تایید شد', 'success');
            await loadAll();
        } catch (err) {
            toast(err.message || 'خطا در تایید', 'error');
        }
    }

    /* ============================================================
       Detail modal — show tags in this category
       ============================================================ */
    function openDetail(id) {
        const t = state.types.find((x) => x._id === id);
        if (!t) return;

        detailTitle.textContent = `${t.icon || '🏷'} ${t.name}`;
        detailSubtitle.textContent = t.description || t.slug;
        detailTags.innerHTML = `<div class="dash-loading">در حال بارگذاری…</div>`;

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
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && detailModal.classList.contains('open')) closeDetail();
    });

    async function loadDetailTags(id) {
        try {
            const data = await api(`/api/tag-types/${id}`);
            const tags = data.tags || [];

            if (!tags.length) {
                detailTags.innerHTML = `<div class="panel-empty">هیچ تگی در این کتگوری وجود ندارد</div>`;
                return;
            }

            detailTags.innerHTML = tags.map((t) => `
                <div class="detail-tag-row">
                    <span class="detail-tag-row__swatch" style="background:${t.color}"></span>
                    <span class="detail-tag-row__name">${escapeHtml(t.name)}</span>
                    <span class="detail-tag-row__usage">${t.usageCount || 0} استفاده</span>
                </div>
            `).join('');
        } catch (err) {
            detailTags.innerHTML = `<div class="panel-empty">خطا در بارگذاری</div>`;
        }
    }

    /* ============================================================
       Filters
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