/* ============================================================
   Tag Picker — GitHub-style
   ============================================================
   - کتگوری‌ها رو به‌صورت گروه نشون می‌ده
   - هر کتگوری تگ‌هاش رو داره
   - جستجو + ساخت سریع تگ
   - ساخت کتگوری جدید
   ============================================================ */

class TagPicker {
    constructor(rootEl, options = {}) {
        this.root = rootEl;
        this.selected = new Set(options.selected || []);
        this.maxTags = options.maxTags || 20;
        this.onChange = options.onChange || (() => { });

        this.types = [];           // [{ _id, name, slug, color, icon, tagCount }]
        this.tagsByType = {};      // { typeId: [tag, ...] }
        this.allTags = [];         // همه تگ‌ها برای جستجو
        this.activeType = null;    // کتگوری فعال در UI

        this._buildUI();
        this._bindEvents();
        this._load();
    }

    /* ============================================================
       UI
       ============================================================ */
    _buildUI() {
        this.root.innerHTML = `
            <div class="tp">
                <div class="tp__selected" data-role="selected"></div>

                <div class="tp__controls">
                    <div class="tp__search">
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="11" cy="11" r="8"></circle>
                            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                        </svg>
                        <input type="text" class="tp__input" placeholder="جستجو یا ساخت تگ..." data-role="search">
                    </div>

                    <button type="button" class="tp__new-type-btn" data-role="new-type" title="کتگوری جدید">
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M12 2v20M2 12h20"></path>
                        </svg>
                    </button>
                </div>

                <div class="tp__types" data-role="types"></div>

                <div class="tp__dropdown" data-role="dropdown"></div>
            </div>
        `;

        this.els = {
            selected: this.root.querySelector('[data-role="selected"]'),
            search: this.root.querySelector('[data-role="search"]'),
            dropdown: this.root.querySelector('[data-role="dropdown"]'),
            types: this.root.querySelector('[data-role="types"]'),
            newType: this.root.querySelector('[data-role="new-type"]'),
        };
    }

    _bindEvents() {
        // جستجو
        this.els.search.addEventListener('focus', () => this._renderDropdown(this.els.search.value));
        this.els.search.addEventListener('input', () => this._renderDropdown(this.els.search.value));

        // بستن dropdown با کلیک بیرون
        document.addEventListener('click', (e) => {
            if (!this.root.contains(e.target)) this._closeDropdown();
        });

        // کتگوری جدید
        this.els.newType.addEventListener('click', (e) => {
            e.stopPropagation();
            this._openNewTypeDialog();
        });
    }

    /* ============================================================
       Load data
       ============================================================ */
    async _load() {
        try {
            const res = await fetch('/api/tag-types');
            const data = await res.json();
            this.types = data.types || [];
            this._renderTypes();
            this._renderSelected();
        } catch (err) {
            console.error('TagPicker: failed to load types', err);
        }
    }

    async _loadTagsForType(typeId) {
        if (this.tagsByType[typeId]) return this.tagsByType[typeId];

        const res = await fetch(`/api/tag-types/${typeId}`);
        const data = await res.json();
        this.tagsByType[typeId] = data.tags || [];

        // اضافه به allTags برای جستجوی سراسری
        for (const t of this.tagsByType[typeId]) {
            if (!this.allTags.find((x) => x._id === t._id)) this.allTags.push(t);
        }
        return this.tagsByType[typeId];
    }

    /* ============================================================
       Render types
       ============================================================ */
    _renderTypes() {
        this.els.types.innerHTML = this.types.map((t) => `
            <button type="button" class="tp__type" data-type="${t._id}" style="--tp-color:${t.color}">
                <span class="tp__type-icon">${t.icon || '🏷'}</span>
                <span class="tp__type-name">${this._esc(t.name)}</span>
                <span class="tp__type-count">${t.tagCount || 0}</span>
            </button>
        `).join('');

        this.els.types.querySelectorAll('[data-type]').forEach((btn) => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const typeId = btn.dataset.type;
                this.activeType = typeId;

                // active class
                this.els.types.querySelectorAll('.tp__type').forEach((b) => b.classList.remove('active'));
                btn.classList.add('active');

                // load tags و نمایش dropdown
                await this._loadTagsForType(typeId);
                this._renderDropdown('');
            });
        });
    }

    /* ============================================================
       Render selected chips
       ============================================================ */
    _renderSelected() {
        const chips = Array.from(this.selected).map((id) => {
            const tag = this.allTags.find((t) => t._id === id);
            if (!tag) return '';
            return `
                <span class="tp__chip" style="background:${this._hexA(tag.color, 0.12)}; color:${tag.color}; border-color:${this._hexA(tag.color, 0.3)}">
                    <span class="tp__chip-icon">${tag.type?.icon || ''}</span>
                    ${this._esc(tag.name)}
                    <button type="button" data-remove="${tag._id}">×</button>
                </span>
            `;
        }).join('');

        this.els.selected.innerHTML = chips || '<span class="tp__placeholder">هنوز تگی انتخاب نشده</span>';

        this.els.selected.querySelectorAll('[data-remove]').forEach((b) => {
            b.addEventListener('click', (e) => {
                e.stopPropagation();
                this._remove(b.dataset.remove);
            });
        });
    }

    /* ============================================================
       Render dropdown
       ============================================================ */
    _renderDropdown(query) {
        const q = (query || '').toLowerCase().trim();
        const dropdown = this.els.dropdown;

        // حالت جستجو: از همه تگ‌ها استفاده کن
        if (q) {
            const matches = this.allTags
                .filter((t) => !this.selected.has(t._id))
                .filter((t) => t.name.toLowerCase().includes(q) || t.slug.includes(q))
                .slice(0, 15);

            // گروه‌بندی بر اساس type
            const grouped = {};
            for (const tag of matches) {
                const typeId = tag.type?._id || tag.type;
                if (!grouped[typeId]) grouped[typeId] = [];
                grouped[typeId].push(tag);
            }

            let html = '';
            if (Object.keys(grouped).length === 0) {
                // اگه activeType مشخصه، پیشنهاد ساخت بده
                if (this.activeType) {
                    const type = this.types.find((t) => t._id === this.activeType);
                    html = `
                        <div class="tp__dropdown-empty">
                            تگی پیدا نشد
                        </div>
                        ${type?.allowUserTags || type?.isSystem !== true ? `
                            <button type="button" class="tp__create-tag" data-create="${this._esc(query)}" data-type="${this.activeType}">
                                <span class="tp__create-icon">＋</span>
                                ساخت تگ «${this._esc(query)}» در «${this._esc(type?.name || '')}»
                            </button>
                        ` : ''}
                    `;
                } else {
                    html = `<div class="tp__dropdown-empty">تگی پیدا نشد. اول یک کتگوری انتخاب کنید یا از دکمه + کتگوری جدید بسازید.</div>`;
                }
            } else {
                for (const [typeId, tags] of Object.entries(grouped)) {
                    const type = this.types.find((t) => t._id === typeId);
                    html += `
                        <div class="tp__group">
                            <div class="tp__group-title" style="color:${type?.color || '#6ebbff'}">
                                <span>${type?.icon || ''}</span>
                                ${this._esc(type?.name || 'دسته')}
                            </div>
                            ${tags.map((t) => this._tagOption(t)).join('')}
                        </div>
                    `;
                }

                // دکمه ساخت تگ جدید اگر کتگوری فعال داریم
                if (this.activeType) {
                    const type = this.types.find((t) => t._id === this.activeType);
                    const exists = this.allTags.find(
                        (t) =>
                            (t.type?._id || t.type) === this.activeType &&
                            t.name.toLowerCase() === q
                    );
                    if (!exists) {
                        html += `
                            <button type="button" class="tp__create-tag" data-create="${this._esc(query)}" data-type="${this.activeType}">
                                <span class="tp__create-icon">＋</span>
                                ساخت تگ «${this._esc(query)}» در «${this._esc(type?.name || '')}»
                            </button>
                        `;
                    }
                }
            }

            dropdown.innerHTML = html;
            dropdown.classList.add('open');
        }
        // حالت بدون جستجو: تگ‌های activeType
        else if (this.activeType) {
            const tags = this.tagsByType[this.activeType] || [];
            const type = this.types.find((t) => t._id === this.activeType);

            const available = tags.filter((t) => !this.selected.has(t._id));

            let html = '';
            if (available.length === 0) {
                html = `<div class="tp__dropdown-empty">تگی در این کتگوری وجود ندارد</div>`;
            } else {
                html = `
                    <div class="tp__group">
                        <div class="tp__group-title" style="color:${type?.color || '#6ebbff'}">
                            <span>${type?.icon || ''}</span>
                            ${this._esc(type?.name || '')}
                        </div>
                        ${available.map((t) => this._tagOption(t)).join('')}
                    </div>
                `;
            }

            dropdown.innerHTML = html;
            dropdown.classList.add('open');
        } else {
            dropdown.innerHTML = `<div class="tp__dropdown-empty">یک کتگوری انتخاب کنید یا جستجو کنید</div>`;
            dropdown.classList.add('open');
        }

        this._bindDropdownEvents();
    }

    _tagOption(tag) {
        return `
            <button type="button" class="tp__option" data-select="${tag._id}">
                <span class="tp__option-swatch" style="background:${tag.color}"></span>
                <span class="tp__option-name">${this._esc(tag.name)}</span>
                ${tag.usageCount > 0 ? `<span class="tp__option-usage">${tag.usageCount}×</span>` : ''}
            </button>
        `;
    }

    _bindDropdownEvents() {
        this.els.dropdown.querySelectorAll('[data-select]').forEach((el) => {
            el.addEventListener('click', (e) => {
                e.stopPropagation();
                this._add(el.dataset.select);
            });
        });

        this.els.dropdown.querySelectorAll('[data-create]').forEach((el) => {
            el.addEventListener('click', (e) => {
                e.stopPropagation();
                this._createTag(el.dataset.create, el.dataset.type);
            });
        });
    }

    _closeDropdown() {
        this.els.dropdown.classList.remove('open');
    }

    /* ============================================================
       Actions
       ============================================================ */
    _add(tagId) {
        if (this.selected.size >= this.maxTags) {
            if (window.toast) toast(`حداکثر ${this.maxTags} تگ`, 'error');
            return;
        }
        this.selected.add(tagId);
        this._renderSelected();
        this._renderDropdown(this.els.search.value);
        this.onChange(Array.from(this.selected));
    }

    _remove(tagId) {
        this.selected.delete(tagId);
        this._renderSelected();
        this._renderDropdown(this.els.search.value);
        this.onChange(Array.from(this.selected));
    }

    async _createTag(name, typeId) {
        if (!name.trim()) return;

        try {
            const res = await fetch('/api/tags/find-or-create', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: name.trim(), type: typeId }),
            });

            const data = await res.json();

            if (!res.ok) {
                if (window.toast) toast(data.message || 'ساخت تگ ناموفق', 'error');
                return;
            }

            const tag = data.tag;

            // اضافه به کش
            if (!this.allTags.find((t) => t._id === tag._id)) this.allTags.push(tag);
            if (!this.tagsByType[typeId]) this.tagsByType[typeId] = [];
            if (!this.tagsByType[typeId].find((t) => t._id === tag._id)) {
                this.tagsByType[typeId].unshift(tag);
            }

            // انتخاب خودکار
            this._add(tag._id);
            this.els.search.value = '';

            if (data.pendingApproval && window.toast) {
                toast('تگ ساخته شد و در انتظار تایید است', 'info');
            } else if (window.toast) {
                toast(`تگ «${tag.name}» ساخته شد`, 'success');
            }

            // آپدیت count کتگوری
            const type = this.types.find((t) => t._id === typeId);
            if (type) type.tagCount = (type.tagCount || 0) + 1;
            this._renderTypes();
        } catch (err) {
            if (window.toast) toast('خطا در ساخت تگ', 'error');
        }
    }

    async _openNewTypeDialog() {
        const name = prompt('نام کتگوری جدید:');
        if (!name || !name.trim()) return;

        const color = prompt('رنگ (hex، مثلاً #6ebbff):', '#6ebbff') || '#6ebbff';

        try {
            const res = await fetch('/api/tag-types', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: name.trim(),
                    color,
                    allowUserTags: true,
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                if (window.toast) toast(data.message || 'ساخت کتگوری ناموفق', 'error');
                return;
            }

            this.types.push({ ...data.type, tagCount: 0 });
            this.types.sort((a, b) => (a.order || 0) - (b.order || 0));
            this._renderTypes();

            if (data.type.isApproved) {
                if (window.toast) toast(`کتگوری «${data.type.name}» ساخته شد`, 'success');
            } else if (window.toast) {
                toast('کتگوری ساخته شد و در انتظار تایید است', 'info');
            }
        } catch {
            if (window.toast) toast('خطا در ساخت کتگوری', 'error');
        }
    }

    /* ============================================================
       Public API
       ============================================================ */
    getSelected() {
        return Array.from(this.selected);
    }

    setSelected(ids) {
        this.selected = new Set(ids || []);
        this._renderSelected();
    }

    /* ============================================================
       Helpers
       ============================================================ */
    _esc(s) {
        if (s == null) return '';
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    _hexA(hex, a) {
        if (!hex) return `rgba(110,187,255,${a})`;
        const h = hex.replace('#', '');
        const r = parseInt(h.substr(0, 2), 16);
        const g = parseInt(h.substr(2, 2), 16);
        const b = parseInt(h.substr(4, 2), 16);
        return `rgba(${r},${g},${b},${a})`;
    }
}

window.TagPicker = TagPicker;

/**
 * Copyright (c) 2026 Sobhan Rasoulzadeh Asl (Sobhan-SRZA / Mr. Sinre)
 *
 * Licensed under the BSD 3-Clause License.
 * See the LICENSE file in the project root for license information.
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */