/* ============================================================
   Dashboard — Projects
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
    /* ---------------- State ---------------- */
    const state = {
        page: 1,
        limit: 12,
        search: '',
        status: '',
        sort: 'recent',
        totalPages: 1,
        items: [],
        allTags: [],
        selectedTags: new Set(),
        tagTypes: [],
        editingId: null,
    };

    /* ---------------- Refs ---------------- */
    const $ = (s, r = document) => r.querySelector(s);
    const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

    const grid = $('#projectsGrid');
    const pagination = $('#pagination');
    const countEl = $('#projectsCount');
    const searchInput = $('#filterSearch');
    const statusSelect = $('#filterStatus');
    const sortSelect = $('#filterSort');
    const btnNew = $('#btnNewProject');

    /* Modal */
    const modal = $('#projectModal');
    const modalBackdrop = $('#projectModalBackdrop');
    const modalTitle = $('#projectModalTitle');
    const modalClose = $('#projectModalClose');
    const modalCancel = $('#projectModalCancel');
    const modalSubmit = $('#projectModalSubmit');
    const form = $('#projectForm');

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
       Render list
       ============================================================ */
    function renderProjects() {
        if (!state.items.length) {
            grid.innerHTML = `
                <div class="dash-empty">
                    <div class="dash-empty__icon">📦</div>
                    <h3 class="dash-empty__title">هنوز پروژه‌ای ندارید</h3>
                    <p class="dash-empty__sub">اولین پروژه‌تان را بسازید و با دنیا به اشتراک بگذارید</p>
                    <button type="button" class="btn-primary" onclick="document.getElementById('btnNewProject').click()">
                        ساخت اولین پروژه
                    </button>
                </div>
            `;
            return;
        }

        grid.innerHTML = state.items.map(renderCard).join('');
        bindCardActions();
    }

    function renderCard(p) {
        const statusMap = {
            draft: 'پیش‌نویس',
            published: 'منتشر شده',
            archived: 'آرشیو',
        };
        const gh = p.githubData || {};
        const tags = (p.tags || []).slice(0, 5);
        const moreTags = (p.tags || []).length - tags.length;

        const starIcon = `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>`;
        const forkIcon = `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="18" r="3"></circle><circle cx="6" cy="6" r="3"></circle><circle cx="18" cy="6" r="3"></circle><path d="M18 9v1a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V9"></path><path d="M12 12v3"></path></svg>`;
        const dlIcon = `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>`;
        const rateIcon = `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>`;

        return `
            <article class="p-card" data-id="${p._id}">
                <div class="p-card__head">
                    <h3 class="p-card__title">${escapeHtml(p.title)}</h3>
                    <span class="p-card__status p-card__status--${p.status}">
                        ${statusMap[p.status] || p.status}
                    </span>
                </div>

                <p class="p-card__desc">${escapeHtml(p.shortDescription || '')}</p>

                ${tags.length ? `
                    <div class="p-card__tags">
                        ${tags.map((t) => `
                            <span class="p-tag" style="background:${hexA(t.color, 0.12)}; color:${t.color}; border-color:${hexA(t.color, 0.25)}">
                                ${escapeHtml(t.name)}
                            </span>
                        `).join('')}
                        ${moreTags > 0 ? `<span class="p-tag">+${moreTags}</span>` : ''}
                    </div>
                ` : ''}

                <div class="p-card__stats">
                    ${gh.stars !== undefined ? `<span class="p-stat">${starIcon}<strong>${gh.stars || 0}</strong></span>` : ''}
                    ${gh.forks !== undefined ? `<span class="p-stat">${forkIcon}<strong>${gh.forks || 0}</strong></span>` : ''}
                    <span class="p-stat">${dlIcon}<strong>${p.downloads || 0}</strong></span>
                    <span class="p-stat">${rateIcon}<strong>${(p.rating || 0).toFixed(1)}</strong></span>
                </div>

                <div class="p-card__actions">
                    <button type="button" class="p-icon-btn" data-action="edit">
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                        ویرایش
                    </button>
                    ${p.githubRepo ? `
                        <button type="button" class="p-icon-btn p-icon-btn--sync" data-action="sync" title="سینک با گیت‌هاب">
                            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
                            سینک
                        </button>
                    ` : ''}
                    <button type="button" class="p-icon-btn p-icon-btn--danger" data-action="delete">
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                        حذف
                    </button>
                </div>
            </article>
        `;
    }

    function bindCardActions() {
        $$('.p-card').forEach((card) => {
            const id = card.dataset.id;
            card.querySelectorAll('[data-action]').forEach((btn) => {
                btn.addEventListener('click', () => {
                    const action = btn.dataset.action;
                    if (action === 'edit') openEditModal(id);
                    else if (action === 'delete') deleteProject(id);
                    else if (action === 'sync') syncGithub(id, btn);
                });
            });
        });
    }

    /* ============================================================
       Load
       ============================================================ */
    async function loadProjects() {
        grid.innerHTML = `<div class="dash-loading">در حال بارگذاری…</div>`;
        try {
            const params = new URLSearchParams({
                mine: 'true',
                page: state.page,
                limit: state.limit,
                sort: state.sort,
            });
            if (state.search) params.set('search', state.search);
            if (state.status) params.set('status', state.status);

            const data = await api(`/api/projects?${params}`);

            state.items = data.projects || [];
            state.totalPages = data.pagination?.pages || 1;

            const total = data.pagination?.total || 0;
            countEl.textContent = total === 0
                ? 'هیچ پروژه‌ای ندارید'
                : `${total} پروژه`;

            renderProjects();
            renderPagination();
        } catch (err) {
            grid.innerHTML = `<div class="dash-empty">
                <div class="dash-empty__icon">⚠️</div>
                <h3 class="dash-empty__title">خطا در بارگذاری</h3>
                <p class="dash-empty__sub">${escapeHtml(err.message || '')}</p>
                <button class="btn-primary" onclick="location.reload()">تلاش مجدد</button>
            </div>`;
        }
    }

    function renderPagination() {
        if (state.totalPages <= 1) { pagination.innerHTML = ''; return; }

        const cur = state.page;
        const total = state.totalPages;
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

        pagination.innerHTML = `
            <button class="page-btn" ${cur === 1 ? 'disabled' : ''} data-page="${cur - 1}">قبلی</button>
            ${pages.map((p) => p === '...'
            ? `<span class="page-btn" style="cursor:default;border:none;background:transparent">…</span>`
            : `<button class="page-btn ${p === cur ? 'active' : ''}" data-page="${p}">${p}</button>`
        ).join('')}
            <button class="page-btn" ${cur === total ? 'disabled' : ''} data-page="${cur + 1}">بعدی</button>
        `;

        pagination.querySelectorAll('[data-page]').forEach((btn) => {
            btn.addEventListener('click', () => {
                const p = Number(btn.dataset.page);
                if (p >= 1 && p <= total && p !== cur) {
                    state.page = p;
                    loadProjects();
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                }
            });
        });
    }

    /* ============================================================
       Filters
       ============================================================ */
    let searchTimer;
    searchInput.addEventListener('input', () => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => {
            state.search = searchInput.value.trim();
            state.page = 1;
            loadProjects();
        }, 350);
    });

    statusSelect.addEventListener('change', () => {
        state.status = statusSelect.value;
        state.page = 1;
        loadProjects();
    });

    sortSelect.addEventListener('change', () => {
        state.sort = sortSelect.value;
        state.page = 1;
        loadProjects();
    });

    /* ============================================================
       Modal — open/close
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
        state.selectedTags.clear();
        form.reset();
        $('#tagPickerSelected').innerHTML = '';
    }

    modalClose.addEventListener('click', closeModal);
    modalCancel.addEventListener('click', closeModal);
    modalBackdrop.addEventListener('click', closeModal);
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.classList.contains('open')) closeModal();
    });

    btnNew.addEventListener('click', openCreateModal);

    /* ============================================================
       Load tags & types for picker
       ============================================================ */
    async function loadTags() {
        try {
            const data = await api('/api/tags?limit=100&sort=usage');
            state.allTags = data.tags || [];
        } catch {
            state.allTags = [];
        }
    }

    /* ============================================================
       Tag picker
       ============================================================ */
    const picker = $('#tagPicker');
    const pickerSelected = $('#tagPickerSelected');
    const pickerSearch = $('#tagPickerSearch');
    const pickerDropdown = $('#tagPickerDropdown');

    function renderSelectedTags() {
        pickerSelected.innerHTML = Array.from(state.selectedTags).map((id) => {
            const t = state.allTags.find((x) => x._id === id);
            if (!t) return '';
            return `<span class="tag-picker__chip" style="background:${hexA(t.color, 0.12)}; color:${t.color}; border-color:${hexA(t.color, 0.25)}">
                ${escapeHtml(t.name)}
                <button type="button" data-remove="${t._id}">×</button>
            </span>`;
        }).join('');

        pickerSelected.querySelectorAll('[data-remove]').forEach((b) => {
            b.addEventListener('click', () => {
                state.selectedTags.delete(b.dataset.remove);
                renderSelectedTags();
            });
        });
    }

    function renderTagOptions(query) {
        const q = (query || '').toLowerCase().trim();
        const selected = state.selectedTags;
        const filtered = state.allTags.filter((t) => {
            if (selected.has(t._id)) return false;
            if (!q) return true;
            return t.name.toLowerCase().includes(q) || t.slug.includes(q);
        }).slice(0, 30);

        let html = '';
        if (filtered.length) {
            html += filtered.map((t) => `
                <div class="tag-picker__option" data-id="${t._id}">
                    <span class="tag-picker__option-swatch" style="background:${t.color}"></span>
                    <span>${escapeHtml(t.name)}</span>
                    <span class="tag-picker__option-type">${escapeHtml(t.type?.name || '')}</span>
                </div>
            `).join('');
        }

        if (q) {
            html += `<div class="tag-picker__option tag-picker__create" data-create="${escapeHtml(q)}">
                + ساخت تگ جدید: «${escapeHtml(q)}»
            </div>`;
        }

        if (!html) html = `<div class="tag-picker__empty">تگی یافت نشد</div>`;

        pickerDropdown.innerHTML = html;
        pickerDropdown.classList.add('open');

        pickerDropdown.querySelectorAll('[data-id]').forEach((el) => {
            el.addEventListener('click', () => {
                if (state.selectedTags.size >= 20) {
                    toast('حداکثر ۲۰ تگ', 'error');
                    return;
                }
                state.selectedTags.add(el.dataset.id);
                pickerSearch.value = '';
                renderSelectedTags();
                renderTagOptions('');
            });
        });

        pickerDropdown.querySelectorAll('[data-create]').forEach((el) => {
            el.addEventListener('click', () => createNewTag(el.dataset.create));
        });
    }

    pickerSearch.addEventListener('focus', () => renderTagOptions(pickerSearch.value));
    pickerSearch.addEventListener('input', () => renderTagOptions(pickerSearch.value));

    document.addEventListener('click', (e) => {
        if (!picker.contains(e.target)) {
            pickerDropdown.classList.remove('open');
        }
    });

    async function createNewTag(name) {
        // برای ساخت تگ جدید، باید tagType داشته باشیم
        if (!state.tagTypes.length) {
            try {
                const d = await api('/api/tag-types');
                state.tagTypes = d.types || [];
            } catch { }
        }

        if (!state.tagTypes.length) {
            toast('ابتدا یک نوع تگ بسازید', 'error');
            return;
        }

        // انتخاب نوع (ساده: اولین نوع غیرسیستمی یا اولین)
        const typeId = state.tagTypes[0]._id;

        try {
            const data = await api('/api/tags', {
                method: 'POST',
                body: JSON.stringify({
                    name,
                    type: typeId,
                    color: '#6ebbff',
                }),
            });
            state.allTags.unshift(data.tag);
            state.selectedTags.add(data.tag._id);
            pickerSearch.value = '';
            renderSelectedTags();
            renderTagOptions('');
            toast(`تگ «${name}» ساخته شد`, 'success');
        } catch (err) {
            toast(err.message || 'ساخت تگ ناموفق', 'error');
        }
    }

    /* ============================================================
       Create / Edit modal
       ============================================================ */
    function openCreateModal() {
        state.editingId = null;
        state.selectedTags.clear();
        form.reset();
        modalTitle.textContent = 'پروژه جدید';
        modalSubmit.textContent = 'ساخت پروژه';
        $('#p-status').value = 'draft';
        form.elements.isPublic.checked = true;
        form.elements.autoSync.checked = true;
        renderSelectedTags();
        openModal();
        setTimeout(() => form.elements.title.focus(), 200);
    }

    async function openEditModal(id) {
        try {
            const data = await api(`/api/projects/${id}`);
            const p = data.project;

            state.editingId = p._id;
            state.selectedTags = new Set((p.tags || []).map((t) => t._id));
            modalTitle.textContent = 'ویرایش پروژه';
            modalSubmit.textContent = 'ذخیره تغییرات';

            form.elements._id.value = p._id;
            form.elements.title.value = p.title;
            form.elements.slug.value = p.slug;
            form.elements.githubUrl.value = p.githubUrl || '';
            form.elements.shortDescription.value = p.shortDescription;
            form.elements.fullDescription.value = p.fullDescription;
            form.elements.rating.value = p.rating || 0;
            form.elements.satisfaction.value = p.satisfaction || 0;
            form.elements.downloads.value = p.downloads || 0;
            form.elements.status.value = p.status;
            form.elements.isPublic.checked = !!p.isPublic;
            form.elements.autoSync.checked = !!p.autoSync;

            renderSelectedTags();
            openModal();
        } catch (err) {
            toast(err.message || 'خطا در بارگذاری', 'error');
        }
    }

    /* ============================================================
       Submit form
       ============================================================ */
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const values = {
            title: form.elements.title.value.trim(),
            slug: form.elements.slug.value.trim() || undefined,
            githubUrl: form.elements.githubUrl.value.trim() || null,
            shortDescription: form.elements.shortDescription.value.trim(),
            fullDescription: form.elements.fullDescription.value.trim(),
            rating: Number(form.elements.rating.value) || 0,
            satisfaction: Number(form.elements.satisfaction.value) || 0,
            downloads: Number(form.elements.downloads.value) || 0,
            tags: Array.from(state.selectedTags),
            status: form.elements.status.value,
            isPublic: form.elements.isPublic.checked,
            autoSync: form.elements.autoSync.checked,
        };

        // client validation
        const errors = {};
        if (!values.title) errors.title = 'عنوان الزامی است';
        if (!values.shortDescription) errors.shortDescription = 'توضیح مختصر الزامی است';
        if (!values.fullDescription || values.fullDescription.length < 20) {
            errors.fullDescription = 'شرح کامل باید حداقل ۲۰ کاراکتر باشد';
        }

        if (Object.keys(errors).length) {
            for (const [k, m] of Object.entries(errors)) FormKit.showFieldError(form.elements[k], m);
            const first = Object.keys(errors)[0];
            form.elements[first]?.focus();
            return;
        }

        // clear errors
        FormKit.clearAllErrors(form);

        modalSubmit.disabled = true;
        const originalText = modalSubmit.textContent;
        modalSubmit.classList.add('loading');
        modalSubmit.textContent = 'در حال ذخیره…';

        try {
            const isEdit = !!state.editingId;
            const url = isEdit ? `/api/projects/${state.editingId}` : '/api/projects';
            const method = isEdit ? 'PUT' : 'POST';

            await api(url, { method, body: JSON.stringify(values) });

            toast(isEdit ? 'پروژه ویرایش شد' : 'پروژه ساخته شد', 'success');
            closeModal();
            await loadProjects();
        } catch (err) {
            if (err.details || err.field) {
                FormKit.applyServerErrors(form, err);
            }
            toast(err.message || 'خطا در ذخیره', 'error');
        } finally {
            modalSubmit.disabled = false;
            modalSubmit.classList.remove('loading');
            modalSubmit.textContent = originalText;
        }
    });

    /* ============================================================
       Delete
       ============================================================ */
    async function deleteProject(id) {
        const p = state.items.find((x) => x._id === id);
        const ok = await confirmDialog({
            title: 'حذف پروژه',
            message: `آیا از حذف «${p?.title || 'این پروژه'}» مطمئنید؟ این عمل قابل بازگشت نیست.`,
            confirmText: 'بله، حذف کن',
            cancelText: 'انصراف',
            danger: true,
        });
        if (!ok) return;

        try {
            await api(`/api/projects/${id}`, { method: 'DELETE' });
            toast('پروژه حذف شد', 'success');
            await loadProjects();
        } catch (err) {
            toast(err.message || 'حذف ناموفق', 'error');
        }
    }

    /* ============================================================
       Sync GitHub
       ============================================================ */
    async function syncGithub(id, btn) {
        const originalHTML = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '...';

        try {
            await api(`/api/projects/${id}/sync-github`, { method: 'POST' });
            toast('اطلاعات از گیت‌هاب آپدیت شد', 'success');
            await loadProjects();
        } catch (err) {
            toast(err.message || 'سینک ناموفق', 'error');
            btn.disabled = false;
            btn.innerHTML = originalHTML;
        }
    }

    /* ============================================================
       Helpers
       ============================================================ */
    function escapeHtml(str) {
        if (str == null) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function hexA(hex, alpha) {
        if (!hex) return 'rgba(110,187,255,' + alpha + ')';
        const h = hex.replace('#', '');
        const r = parseInt(h.substr(0, 2), 16);
        const g = parseInt(h.substr(2, 2), 16);
        const b = parseInt(h.substr(4, 2), 16);
        return `rgba(${r},${g},${b},${alpha})`;
    }

    /* ============================================================
       Char counter
       ============================================================ */
    form.elements.shortDescription.addEventListener('input', () => {
        $('#shortCount').textContent = form.elements.shortDescription.value.length;
    });

    /* ============================================================
       Init
       ============================================================ */
    (async () => {
        await Promise.all([loadTags(), loadProjects()]);
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