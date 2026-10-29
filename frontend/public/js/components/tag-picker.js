/* ============================================================
   Tag Picker — GitHub-Style
   ============================================================
   Displays tag categories as groups, each containing its own
   tags. Supports search, quick tag creation, and creation of
   new categories.
   ============================================================ */

/* ============================================================
   Tag ID Validation Helpers
   ============================================================ */

/* Matches a 24-character hexadecimal MongoDB ObjectId. */
const OBJECT_ID_RE = /^[a-f\d]{24}$/i;

/**
 * Determine whether the given value is a valid tag identifier.
 */
function isValidTagId(id) {
    return typeof id === 'string' && OBJECT_ID_RE.test(id);
}

/**
 * Normalise a tag identifier into a plain string.
 *
 * Handles populated ObjectId objects by extracting their `_id`
 * or falling back to `toString()`. Returns `null` when the
 * resulting value is not a valid identifier.
 */
function normalizeTagId(id) {
    if (id == null) return null;

    // Extract the raw id from a populated ObjectId reference.
    if (typeof id === 'object' && id._id) id = id._id;
    if (typeof id === 'object' && id.toString) id = id.toString();

    const s = String(id);

    return isValidTagId(s) ? s : null;
}

class TagPicker {
    constructor(rootEl, options = {}) {
        this.root = rootEl;
        this.selected = new Set(options.selected || []);
        this.maxTags = options.maxTags || 20;
        this.onChange = options.onChange || (() => { });

        this.types = [];           // [{ _id, name, slug, color, icon, tagCount }]
        this.tagsByType = {};      // { typeId: [tag, ...] }
        this.allTags = [];         // Flat list of all tags, used for search.
        this.activeType = null;    // Currently active category in the UI.

        this._buildUI();
        this._bindEvents();
        this._load();
    }

    /* ============================================================
       UI Construction
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
                        <input type="text" class="tp__input" placeholder="Search or create a tag…" data-role="search">
                    </div>

                    <button type="button" class="tp__new-type-btn" data-role="new-type" title="New category">
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
            newType: this.root.querySelector('[data-role="new-type"]')
        };
    }

    /* Bind search, outside-click, and category-creation handlers. */
    _bindEvents() {
        // Search input.
        this.els.search.addEventListener('focus', () => this._renderDropdown(this.els.search.value));
        this.els.search.addEventListener('input', () => this._renderDropdown(this.els.search.value));

        // Close the dropdown when clicking outside of the picker.
        document.addEventListener('click', (e) => {
            if (!this.root.contains(e.target))
                this._closeDropdown();
        });

        // Create a new category.
        this.els.newType.addEventListener('click', (e) => {
            e.stopPropagation();
            this._openNewTypeDialog();
        });
    }

    /* ============================================================
       Data Loading
       ============================================================ */

    /* Load all tag categories and render the initial UI. */
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

    /**
     * Load (and cache) the tags belonging to a category. Successfully
     * loaded tags are also merged into the flat `allTags` list used
     * for global search.
     */
    async _loadTagsForType(typeId) {
        if (this.tagsByType[typeId]) return this.tagsByType[typeId];

        const res = await fetch(`/api/tag-types/${typeId}`);
        const data = await res.json();

        this.tagsByType[typeId] = data.tags || [];

        // Merge into the global search index.
        for (const t of this.tagsByType[typeId]) {
            if (!this.allTags.find((x) => x._id === t._id))
                this.allTags.push(t);
        }

        return this.tagsByType[typeId];
    }

    /* ============================================================
       Category Rendering
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

                // Update the active-state styling.
                this.els.types.querySelectorAll('.tp__type').forEach((b) => b.classList.remove('active'));
                btn.classList.add('active');

                // Load the category's tags and open the dropdown.
                await this._loadTagsForType(typeId);
                this._renderDropdown('');
            });
        });
    }

    /* ============================================================
       Selected-Chip Rendering
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

        this.els.selected.innerHTML = chips || '<span class="tp__placeholder">No tags selected yet</span>';

        this.els.selected.querySelectorAll('[data-remove]').forEach((b) => {
            b.addEventListener('click', (e) => {
                e.stopPropagation();
                this._remove(b.dataset.remove);
            });
        });
    }

    /* ============================================================
       Dropdown Rendering
       ============================================================
       When a query is present, searches across all known tags and
       groups the results by category. Otherwise, shows the tags
       belonging to the currently active category.
       ============================================================ */
    _renderDropdown(query) {
        const q = (query || '').toLowerCase().trim();
        const dropdown = this.els.dropdown;

        /* ---------- Search mode: match against all known tags ---------- */
        if (q) {
            const matches = this.allTags
                .filter((t) => !this.selected.has(t._id))
                .filter((t) => t.name.toLowerCase().includes(q) || t.slug.includes(q))
                .slice(0, 15);

            // Group the results by category.
            const grouped = {};
            for (const tag of matches) {
                const typeId = tag.type?._id || tag.type;
                if (!grouped[typeId])
                    grouped[typeId] = [];

                grouped[typeId].push(tag);
            }

            let html = '';

            if (Object.keys(grouped).length === 0) {
                // Offer to create the tag within the active category.
                if (this.activeType) {
                    const type = this.types.find((t) => t._id === this.activeType);

                    html = `
                        <div class="tp__dropdown-empty">
                            No tags found
                        </div>
                        ${type?.allowUserTags || type?.isSystem !== true ? `
                            <button type="button" class="tp__create-tag" data-create="${this._esc(query)}" data-type="${this.activeType}">
                                <span class="tp__create-icon">＋</span>
                                Create tag "${this._esc(query)}" in "${this._esc(type?.name || '')}"
                            </button>
                        ` : ''}
                    `;
                } else {
                    html = `<div class="tp__dropdown-empty">No tags found. Select a category first, or create a new one with the + button.</div>`;
                }
            } else {
                for (const [typeId, tags] of Object.entries(grouped)) {
                    const type = this.types.find((t) => t._id === typeId);

                    html += `
                        <div class="tp__group">
                            <div class="tp__group-title" style="color:${type?.color || '#6ebbff'}">
                                <span>${type?.icon || ''}</span>
                                ${this._esc(type?.name || 'Category')}
                            </div>
                            ${tags.map((t) => this._tagOption(t)).join('')}
                        </div>
                    `;
                }

                // Offer to create a new tag when a category is active.
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
                                Create tag "${this._esc(query)}" in "${this._esc(type?.name || '')}"
                            </button>
                        `;
                    }
                }
            }

            dropdown.innerHTML = html;
            dropdown.classList.add('open');
        }

        /* ---------- No query: show tags in the active category ---------- */
        else if (this.activeType) {
            const tags = this.tagsByType[this.activeType] || [];
            const type = this.types.find((t) => t._id === this.activeType);

            const available = tags.filter((t) => !this.selected.has(t._id));

            let html = '';

            if (available.length === 0) {
                html = `<div class="tp__dropdown-empty">This category has no tags.</div>`;
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
        }

        /* ---------- No category selected yet ---------- */
        else {
            dropdown.innerHTML = `<div class="tp__dropdown-empty">Select a category or start typing to search.</div>`;
            dropdown.classList.add('open');
        }

        this._bindDropdownEvents();
    }

    /* Render a single selectable tag option within the dropdown. */
    _tagOption(tag) {
        return `
            <button type="button" class="tp__option" data-select="${tag._id}">
                <span class="tp__option-swatch" style="background:${tag.color}"></span>
                <span class="tp__option-name">${this._esc(tag.name)}</span>
                ${tag.usageCount > 0 ? `<span class="tp__option-usage">${tag.usageCount}×</span>` : ''}
            </button>
        `;
    }

    /* Bind select and create handlers to the freshly rendered dropdown items. */
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

    /* Collapse the dropdown. */
    _closeDropdown() {
        this.els.dropdown.classList.remove('open');
    }

    /* ============================================================
       Actions
       ============================================================ */

    /* Add a tag to the current selection, respecting the max limit. */
    _add(tagId) {
        const normalized = normalizeTagId(tagId);

        if (!normalized) {
            console.warn('[TagPicker] invalid tag id:', tagId);

            return;
        }

        if (this.selected.has(normalized))
            return;

        if (this.selected.size >= this.maxTags) {
            if (window.toast)
                toast(`Maximum of ${this.maxTags} tags`, 'error');

            return;
        }

        this.selected.add(normalized);
        this._renderSelected();
        this._renderDropdown(this.els.search.value);
        this.onChange(this.getSelected());
    }

    /* Remove a tag from the current selection. */
    _remove(tagId) {
        this.selected.delete(tagId);
        this._renderSelected();
        this._renderDropdown(this.els.search.value);
        this.onChange(Array.from(this.selected));
    }

    /**
     * Create a new tag (or reuse an existing one) via the API, then
     * add it to the current selection and update local caches.
     */
    async _createTag(name, typeId) {
        if (!name.trim()) return;

        try {
            const body = { name: name.trim() };

            // Include the category only when a valid identifier is present.
            if (typeId && isValidTagId(typeId)) {
                body.type = typeId;
            }

            const res = await fetch('/api/tags/find-or-create', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });

            const data = await res.json();

            if (!res.ok) {
                if (window.toast)
                    toast(data.message || 'Failed to create tag', 'error');

                return;
            }

            const tag = data.tag;

            if (!tag || !isValidTagId(tag._id)) {
                if (window.toast)
                    toast('The server returned an invalid response.', 'error');

                return;
            }

            // Merge the new tag into the local caches.
            if (!this.allTags.find((t) => t._id === tag._id)) {
                this.allTags.push(tag);
            }

            const typeKey = tag.type?._id || tag.type;

            if (!this.tagsByType[typeKey])
                this.tagsByType[typeKey] = [];

            if (!this.tagsByType[typeKey].find((t) => t._id === tag._id)) {
                this.tagsByType[typeKey].unshift(tag);
            }

            this._add(tag._id);
            this.els.search.value = '';

            if (window.toast)
                toast(`Tag "${tag.name}" created`, 'success');

            // Increment the category's tag count.
            const type = this.types.find((x) => x._id === typeKey);
            if (type)
                type.tagCount = (type.tagCount || 0) + 1;

            this._renderTypes();
        } catch (err) {
            console.error('[TagPicker._createTag] failed:', err);

            if (window.toast)
                toast('Error creating tag', 'error');
        }
    }

    /**
     * Prompt the user for a name and colour, then create a new
     * category via the API. Categories awaiting approval are
     * reflected in the toast messaging.
     */
    async _openNewTypeDialog() {
        const name = prompt('New category name:');
        if (!name || !name.trim())
            return;

        const color = prompt('Color (hex, e.g. #6ebbff):', '#6ebbff') || '#6ebbff';

        try {
            const res = await fetch('/api/tag-types', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: name.trim(),
                    color,
                    allowUserTags: true
                })
            });

            const data = await res.json();

            if (!res.ok) {
                if (window.toast)
                    toast(data.message || 'Failed to create category', 'error');

                return;
            }

            this.types.push({ ...data.type, tagCount: 0 });
            this.types.sort((a, b) => (a.order || 0) - (b.order || 0));
            this._renderTypes();

            if (data.type.isApproved) {
                if (window.toast)
                    toast(`Category "${data.type.name}" created`, 'success');
            } else if (window.toast) {
                toast('Category created and is awaiting approval.', 'info');
            }
        } catch {
            if (window.toast)
                toast('Error creating category', 'error');
        }
    }

    /* ============================================================
       Public API
       ============================================================ */

    /* Return the currently selected tag ids as an array. */
    getSelected() {
        return Array.from(this.selected).filter(isValidTagId);
    }

    /* Replace the current selection with the given tag ids. */
    setSelected(ids) {
        const clean = new Set();

        for (const id of (ids || [])) {
            const n = normalizeTagId(id);
            if (n)
                clean.add(n);
        }

        this.selected = clean;
        this._renderSelected();
    }

    /* ============================================================
       Helpers
       ============================================================ */

    /* Escape user-supplied strings before interpolating them into HTML. */
    _esc(s) {
        if (s == null)
            return '';

        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    /* Convert a hex colour to an rgba() string with the given alpha. */
    _hexA(hex, a) {
        if (!hex)
            return `rgba(110,187,255,${a})`;

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