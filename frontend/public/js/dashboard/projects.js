/* ============================================================
   Dashboard — Projects (Full CRUD + Media + Tags)
   ============================================================
   Manages the project list, the multi-step create/edit modal,
   media uploads (images, video, archive), tag selection, and
   GitHub synchronisation. All user-facing strings are rendered
   in English, with comments preserved for maintainability.
   ============================================================ */

document.addEventListener("DOMContentLoaded", () => {
    /* ============================================================
       State
       ============================================================
       Centralised view state for the list, the modal, staged
       media files, and the embedded tag picker.
       ============================================================ */
    const state = {
        // List
        page: 1,
        limit: 12,
        search: "",
        status: "",
        sort: "recent",
        totalPages: 1,
        items: [],

        // Modal
        editingId: null,
        currentStep: 0,
        steps: ["basic", "content", "media", "tags", "settings"],

        // Media
        newImages: [],          // Newly selected files, not yet uploaded.
        existingImages: [],     // Images already stored on the server (edit mode).
        imagesToDelete: [],     // IDs of images flagged for deletion.
        newVideo: null,         // Newly selected video file.
        existingVideo: null,    // Video already stored on the server.
        videoToDelete: false,
        newFile: null,          // Newly selected archive file.
        existingFile: null,
        fileToDelete: false,

        // Picker
        tagPicker: null
    };

    const $ = (selector, root = document) => root.querySelector(selector);
    const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

    /* ============================================================
       Element References — List
       ============================================================ */
    const grid = $("#projectsGrid");
    const pagination = $("#pagination");
    const countEl = $("#projectsCount");
    const searchInput = $("#filterSearch");
    const statusSelect = $("#filterStatus");
    const sortSelect = $("#filterSort");
    const btnNew = $("#btnNewProject");

    /* ============================================================
       Element References — Modal
       ============================================================ */
    const modal = $("#projectModal");
    const modalBackdrop = $("#projectModalBackdrop");
    const modalTitle = $("#projectModalTitle");
    const modalSubtitle = $("#projectModalSubtitle");
    const modalClose = $("#projectModalClose");
    const modalCancel = $("#projectModalCancel");
    const modalPrev = $("#projectModalPrev");
    const modalNext = $("#projectModalNext");
    const modalSubmit = $("#projectModalSubmit");
    const form = $("#projectForm");
    const tabs = $$(".pm-tab");

    /* ============================================================
       API Helper
       ============================================================
       Sends credentialed requests. JSON bodies are serialised
       automatically; FormData bodies are passed through. Non-2xx
       responses are converted into Error objects carrying the
       server payload and status.
       ============================================================ */
    async function api(path, opts = {}) {
        const res = await fetch(path, {
            credentials: "include",
            headers: opts.body instanceof FormData ? {} : { "Content-Type": "application/json" },
            ...opts
        });

        let data = null;
        const ct = res.headers.get("content-type") || "";

        if (ct.includes("application/json")) {
            try {
                data = await res.json();
            } catch { /* Ignore JSON parse failures. */ }
        }

        if (!res.ok) {
            const err = new Error(data?.message || "Error");
            Object.assign(err, data || {}, { status: res.status });

            throw err;
        }

        return data;
    }

    /* ============================================================
       ================= LIST PAGE ================================
       ============================================================ */

    /* Render the project grid, or an empty state when no items exist. */
    function renderProjects() {
        if (!state.items.length) {
            grid.innerHTML = `
                <div class="dash-empty">
                    <div class="dash-empty__icon">📦</div>
                    <h3 class="dash-empty__title">You have no projects yet</h3>
                    <p class="dash-empty__sub">Create your first project and share it with the world.</p>
                    <button type="button" class="btn-primary" onclick="document.getElementById('btnNewProject').click()">
                        Create your first project
                    </button>
                </div>
            `;

            return;
        }

        grid.innerHTML = state.items.map(renderCard).join("");

        bindCardActions();
    }

    /* Produce the markup for a single project card. */
    function renderCard(p) {
        const statusMap = {
            draft: "Draft",
            published: "Published",
            archived: "Archived"
        };

        const gh = p.githubData || {};
        const tags = (p.tags || []).slice(0, 5);
        const moreTags = (p.tags || []).length - tags.length;
        const cover = p.images?.[0]?.url;

        const starIcon = `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>`;
        const forkIcon = `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="18" r="3"></circle><circle cx="6" cy="6" r="3"></circle><circle cx="18" cy="6" r="3"></circle><path d="M18 9v1a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V9"></path><path d="M12 12v3"></path></svg>`;
        const dlIcon = `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>`;
        const rateIcon = `<svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>`;

        const mediaIcons = `
            ${p.images?.length ? `<span class="p-stat" title="Images">🖼️ ${p.images.length}</span>` : ""}
            ${p.demoVideo ? `<span class="p-stat" title="Video">🎬</span>` : ""}
            ${p.downloadFile ? `<span class="p-stat" title="File">📦</span>` : ""}
        `;

        return `
            <article class="p-card" data-id="${p._id}">
                ${cover ? `
                    <div class="p-card__cover" style="background-image:url('${escapeHtml(cover)}')"></div>
                ` : ""}

                <div class="p-card__head">
                    <h3 class="p-card__title"><a href="/projects/${p.slug || p._id}">${escapeHtml(p.title)}</a></h3>
                    <span class="p-card__status p-card__status--${p.status}">
                        ${statusMap[p.status] || p.status}
                    </span>
                </div>

                <p class="p-card__desc">${escapeHtml(p.shortDescription || "")}</p>

                ${tags.length ? `
                    <div class="p-card__tags">
                        ${tags.map((t) => `
                            <span class="p-tag" style="background:${hexA(t.color, 0.12)}; color:${t.color}; border-color:${hexA(t.color, 0.25)}">
                                ${escapeHtml(t.name)}
                            </span>
                        `).join("")}
                        ${moreTags > 0 ? `<span class="p-tag">+${moreTags}</span>` : ""}
                    </div>
                ` : ""}

                <div class="p-card__stats">
                    ${gh.stars !== undefined ? `<span class="p-stat">${starIcon}<strong>${gh.stars || 0}</strong></span>` : ""}
                    ${gh.forks !== undefined ? `<span class="p-stat">${forkIcon}<strong>${gh.forks || 0}</strong></span>` : ""}
                    <span class="p-stat">${dlIcon}<strong>${p.downloads || 0}</strong></span>
                    <span class="p-stat">${rateIcon}<strong>${(p.rating || 0).toFixed(1)}</strong>${p.reviewCount ? ` <small>(${p.reviewCount})</small>` : ""}</span>
                    ${mediaIcons}
                </div>

                <div class="p-card__actions">
                    <button type="button" class="p-icon-btn" data-action="edit">
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                        Edit
                    </button>
                    ${p.githubRepo ? `
                        <button type="button" class="p-icon-btn p-icon-btn--sync" data-action="sync" title="Sync with GitHub">
                            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
                            Sync
                        </button>
                    ` : ""}
                    <button type="button" class="p-icon-btn p-icon-btn--danger" data-action="delete">
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                        Delete
                    </button>
                </div>
            </article>
        `;
    }

    /* Bind edit, delete, and sync handlers to each rendered card. */
    function bindCardActions() {
        $$(".p-card").forEach((card) => {
            const id = card.dataset.id;

            card.querySelectorAll("[data-action]").forEach((btn) => {
                btn.addEventListener("click", () => {
                    const action = btn.dataset.action;

                    if (action === "edit")
                        openEditModal(id);

                    else if (action === "delete")
                        deleteProject(id);

                    else if (action === "sync")
                        syncGithub(id, btn);
                });
            });
        });
    }

    /* ============================================================
       List Loading
       ============================================================ */

    /* Fetch and render the current page of the user's projects. */
    async function loadProjects() {
        grid.innerHTML = `<div class="dash-loading">Loading…</div>`;

        try {
            const params = new URLSearchParams({
                mine: "true",
                page: state.page,
                limit: state.limit,
                sort: state.sort
            });

            if (state.search)
                params.set("search", state.search);

            if (state.status)
                params.set("status", state.status);

            const data = await api(`/api/projects?${params}`);

            state.items = data.projects || [];
            state.totalPages = data.pagination?.pages || 1;

            const total = data.pagination?.total || 0;
            countEl.textContent = total === 0 ? "No projects" : `${total} project${total === 1 ? "" : "s"}`;

            renderProjects();
            renderPagination();
        } catch (err) {
            grid.innerHTML = `<div class="dash-empty">
                <div class="dash-empty__icon">⚠️</div>
                <h3 class="dash-empty__title">Failed to load</h3>
                <p class="dash-empty__sub">${escapeHtml(err.message || "")}</p>
                <button class="btn-primary" onclick="location.reload()">Retry</button>
            </div>`;
        }
    }

    /* Render the pagination controls with a sliding page window. */
    function renderPagination() {
        if (state.totalPages <= 1) {
            pagination.innerHTML = "";

            return;
        }

        const cur = state.page;
        const total = state.totalPages;
        const pages = [];

        if (total <= 7) {
            for (let i = 1; i <= total; i++)
                pages.push(i);
        } else {
            pages.push(1);
            if (cur > 3)
                pages.push("...");

            for (let i = Math.max(2, cur - 1); i <= Math.min(total - 1, cur + 1); i++)
                pages.push(i);

            if (cur < total - 2)
                pages.push("...");

            pages.push(total);
        }

        pagination.innerHTML = `
            <button class="page-btn" ${cur === 1 ? "disabled" : ""} data-page="${cur - 1}">Previous</button>
            ${pages.map((p) => p === "..."
            ? `<span class="page-btn" style="cursor:default;border:none;background:transparent">…</span>`
            : `<button class="page-btn ${p === cur ? "active" : ""}" data-page="${p}">${p}</button>`
        ).join("")}
            <button class="page-btn" ${cur === total ? "disabled" : ""} data-page="${cur + 1}">Next</button>
        `;

        pagination.querySelectorAll("[data-page]").forEach((btn) => {
            btn.addEventListener("click", () => {
                const p = Number(btn.dataset.page);

                if (p >= 1 && p <= total && p !== cur) {
                    state.page = p;
                    loadProjects();
                    window.scrollTo({ top: 0, behavior: "smooth" });
                }
            });
        });
    }

    /* ---------- Filters ---------- */

    /* Debounce the search input to avoid excessive requests. */
    let searchTimer;

    searchInput.addEventListener("input", () => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => {
            state.search = searchInput.value.trim();
            state.page = 1;
            loadProjects();
        }, 350);
    });

    statusSelect.addEventListener("change", () => {
        state.status = statusSelect.value;
        state.page = 1;

        loadProjects();
    });

    sortSelect.addEventListener("change", () => {
        state.sort = sortSelect.value;
        state.page = 1;

        loadProjects();
    });

    /* ============================================================
       ================= MODAL — Step Navigation ==================
       ============================================================ */

    /**
     * Move the modal to the given step index, updating the tabs,
     * panels, and footer buttons accordingly.
     */
    function goToStep(index) {
        if (index < 0 || index >= state.steps.length)
            return;

        state.currentStep = index;

        // Tabs
        tabs.forEach((t, i) => t.classList.toggle("active", i === index));

        // Panels
        $$(".pm-panel").forEach((p) => {
            p.classList.toggle("active", p.dataset.panel === state.steps[index]);
        });

        // Footer buttons
        modalPrev.style.display = index === 0 ? "none" : "";
        modalNext.style.display = index === state.steps.length - 1 ? "none" : "";
        modalSubmit.style.display = index === state.steps.length - 1 ? "" : "none";
    }

    tabs.forEach((tab, i) => {
        tab.addEventListener("click", () => goToStep(i));
    });

    modalNext.addEventListener("click", () => goToStep(state.currentStep + 1));
    modalPrev.addEventListener("click", () => goToStep(state.currentStep - 1));

    /* ============================================================
       Modal Open / Close
       ============================================================ */
    function openModal() {
        modal.classList.add("open");
        modalBackdrop.classList.add("open");
        document.body.style.overflow = "hidden";
    }

    function closeModal() {
        modal.classList.remove("open");
        modalBackdrop.classList.remove("open");
        document.body.style.overflow = "";

        resetModal();
    }

    /**
     * Reset the modal and all staged media state to its initial
     * conditions, ready for a fresh create or edit session.
     */
    function resetModal() {
        state.editingId = null;
        state.currentStep = 0;
        state.newImages = [];
        state.existingImages = [];
        state.imagesToDelete = [];
        state.newVideo = null;
        state.existingVideo = null;
        state.videoToDelete = false;
        state.newFile = null;
        state.existingFile = null;
        state.fileToDelete = false;

        form.reset();
        FormKit.clearAllErrors(form);

        renderImages();
        renderVideo();
        renderFile();
        updateBadges();
        goToStep(0);

        mdEditor.setValue("");
        form.elements.fullDescription.value = "";

        if (state.tagPicker)
            state.tagPicker.setSelected([]);
    }

    modalClose.addEventListener("click", closeModal);
    modalCancel.addEventListener("click", closeModal);
    modalBackdrop.addEventListener("click", closeModal);

    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && modal.classList.contains("open"))
            closeModal();
    });

    /* ============================================================
       Email Verification Guard
       ============================================================
       Prevents unverified users from creating projects. The current
       user record is cached for 30 seconds to avoid repeated API
       calls during a session.
       ============================================================ */
    let _cachedUser = null;
    let _userCacheTime = 0;

    async function ensureEmailVerified() {
        // Reuse the cached user record for up to 30 seconds.
        if (_cachedUser && Date.now() - _userCacheTime < 30_000) {
            return _cachedUser.emailVerified;
        }

        try {
            const res = await fetch('/api/auth/me', { credentials: 'include' });

            if (!res.ok) {
                location.href = '/login';
                return false;
            }

            const data = await res.json();
            _cachedUser = data.user;
            _userCacheTime = Date.now();

            return !!data.user?.emailVerified;
        } catch {
            return false;
        }
    }

    /**
     * Present the verification gate: display a dialog, attempt to
     * obtain a fresh verification token, and redirect the user to
     * the email verification page.
     */
    async function showVerifyEmailGate() {
        if (typeof openDialogError === 'function') {
            openDialogError(
                'Email not verified',
                'You must verify your email before creating a project.'
            );
        } else {
            alert('You must verify your email before creating a project.');
        }

        // Attempt to obtain a fresh verification token.
        try {
            const res = await fetch('/api/auth/resend-verification', {
                method: 'POST',
                credentials: 'include',
            });

            if (res.ok) {
                const data = await res.json();

                sessionStorage.setItem('verify_email_state', JSON.stringify({
                    verifyToken: data.verifyToken,
                    email: data.email,
                }));
            }
        } catch { /* Non-critical — redirect proceeds regardless. */ }

        setTimeout(() => {
            location.href = '/auth/verify-email';
        }, 2000);
    }

    /* ============================================================
       "New Project" Button — With Verification Guard
       ============================================================ */
    btnNew.addEventListener('click', async () => {
        const verified = await ensureEmailVerified();

        if (!verified) {
            return showVerifyEmailGate();
        }

        resetModal();

        modalTitle.textContent = 'New project';
        modalSubtitle.textContent = 'Enter the project details across five steps.';
        modalSubmit.textContent = 'Create project';

        openModal();
        setTimeout(() => form.elements.title.focus(), 200);
    });

    /* ============================================================
       Edit — Load Project Data Into the Modal
       ============================================================ */
    async function openEditModal(id) {
        resetModal();

        try {
            const data = await api(`/api/projects/${id}`);
            const p = data.project;

            state.editingId = p._id;
            modalTitle.textContent = "Edit project";
            modalSubtitle.textContent = p.title;
            modalSubmit.textContent = "Save changes";

            /* Basic step */
            form.elements._id.value = p._id;
            form.elements.title.value = p.title;
            form.elements.slug.value = p.slug;
            form.elements.githubUrl.value = p.githubUrl || "";
            form.elements.autoSync.checked = !!p.autoSync;

            /* Content step */
            form.elements.shortDescription.value = p.shortDescription || "";
            form.elements.fullDescription.value = p.fullDescription || "";
            updateCounters();

            /* Media step */
            state.existingImages = (p.images || []).slice();
            state.existingVideo = p.demoVideo || null;
            state.existingFile = p.downloadFile || null;

            renderImages();
            renderVideo();
            renderFile();
            updateBadges();

            /* Tags step — retain only valid ObjectId references. */
            if (state.tagPicker) {
                const OBJECT_ID_RE = /^[a-f\d]{24}$/i;
                const tagIds = (p.tags || [])
                    .map((t) => (t && typeof t === 'object' ? t._id : t))
                    .filter((id) => id && OBJECT_ID_RE.test(String(id)));

                state.tagPicker.setSelected(tagIds);
            }

            /* Settings step */
            const status = p.status || "published";
            const radio = form.querySelector(`input[name="status"][value="${status}"]`);

            if (radio)
                radio.checked = true;

            form.elements.isPublic.checked = !!p.isPublic;

            openModal();
            validateGithubUrl();
            mdEditor.setValue(p.fullDescription || "");
        } catch (err) {
            console.error("[openEditModal] failed:", err);

            toast(
                err.message || "Failed to load the project.",
                "error"
            );
        }
    }

    /* ============================================================
       ================= IMAGES ===================================
       ============================================================ */
    const imagesDropzone = $("#imagesDropzone");
    const imagesInput = $("#imagesInput");
    const imagesGrid = $("#imagesGrid");

    imagesDropzone.addEventListener("click", () => imagesInput.click());

    imagesDropzone.addEventListener("dragover", (e) => {
        e.preventDefault();
        imagesDropzone.classList.add("dragover");
    });

    imagesDropzone.addEventListener("dragleave", () => {
        imagesDropzone.classList.remove("dragover");
    });

    imagesDropzone.addEventListener("drop", (e) => {
        e.preventDefault();
        imagesDropzone.classList.remove("dragover");
        handleImageFiles(e.dataTransfer.files);
    });

    imagesInput.addEventListener("change", (e) => {
        handleImageFiles(e.target.files);
        imagesInput.value = "";
    });

    /**
     * Validate and stage newly selected image files. Enforces the
     * accepted MIME types, per-file size limit, and total count cap.
     */
    function handleImageFiles(fileList) {
        const files = Array.from(fileList);
        const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];

        const currentTotal = state.existingImages.length + state.newImages.length;
        const remaining = 10 - currentTotal;

        if (remaining <= 0) {
            toast("A maximum of 10 images is allowed.", "error");

            return;
        }

        for (const f of files.slice(0, remaining)) {
            if (!allowed.includes(f.type)) {
                toast(`The ${f.type} format is not supported.`, "error");

                continue;
            }

            if (f.size > 5 * 1024 * 1024) {
                toast(`"${f.name}" exceeds the 5 MB limit.`, "error");

                continue;
            }

            state.newImages.push({
                file: f,
                previewUrl: URL.createObjectURL(f),
                filename: f.name,
            });
        }

        renderImages();
        updateBadges();
    }

    /* Render the combined image grid of existing and newly staged images. */
    function renderImages() {
        const total = state.existingImages.length + state.newImages.length;

        const all = [
            ...state.existingImages.map((img) => ({ ...img, source: "existing" })),
            ...state.newImages.map((img, i) => ({ ...img, source: "new", newIndex: i, url: img.previewUrl }))
        ];

        imagesGrid.innerHTML = all.map((img, idx) => `
            <div class="pm-image" data-source="${img.source}"
                 data-id="${img._id || ""}"
                 data-new-index="${img.newIndex ?? ""}"
                 draggable="true">
                <img src="${escapeHtml(img.url)}" alt="">

                ${idx === 0 ? `<span class="pm-image__cover">Cover</span>` : ""}

                <span class="pm-image__index">${idx + 1}</span>

                <div class="pm-image__actions">
                    <button type="button" class="pm-image__btn pm-image__btn--danger" data-remove title="Remove">
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>
            </div>
        `).join("");

        imagesGrid.querySelectorAll("[data-remove]").forEach((btn) => {
            btn.addEventListener("click", (e) => {
                e.stopPropagation();

                const wrap = btn.closest(".pm-image");
                removeImage(wrap);
            });
        });

        bindImageDragAndDrop();
    }

    /**
     * Remove an image from the grid. Existing images are queued for
     * server-side deletion; staged images are dropped from the queue.
     */
    function removeImage(wrap) {
        const source = wrap.dataset.source;
        const id = wrap.dataset.id;
        const newIndex = wrap.dataset.newIndex;

        if (source === "existing" && id) {
            state.imagesToDelete.push(id);
            state.existingImages = state.existingImages.filter((i) => i._id !== id);
        } else if (source === "new" && newIndex !== "") {
            state.newImages.splice(Number(newIndex), 1);
        }

        renderImages();
        updateBadges();
    }

    let draggedImage = null;

    /**
     * Enable drag-to-reorder for the image grid. Reordering is
     * reflected in both the existing and newly staged image arrays
     * so the server receives the updated sequence on submission.
     */
    function bindImageDragAndDrop() {
        imagesGrid.querySelectorAll(".pm-image").forEach((el) => {
            el.addEventListener("dragstart", (e) => {
                draggedImage = el;
                el.classList.add("dragging");
                e.dataTransfer.effectAllowed = "move";
            });

            el.addEventListener("dragend", () => {
                el.classList.remove("dragging");
                imagesGrid.querySelectorAll(".pm-image").forEach((x) => x.classList.remove("drag-over"));
                draggedImage = null;
            });

            el.addEventListener("dragover", (e) => {
                e.preventDefault();

                if (draggedImage && draggedImage !== el) {
                    el.classList.add("drag-over");
                }
            });

            el.addEventListener("dragleave", () => {
                el.classList.remove("drag-over");
            });

            el.addEventListener("drop", (e) => {
                e.preventDefault();

                if (!draggedImage || draggedImage === el)
                    return;

                // Reconstruct the current ordering of all images.
                const all = [
                    ...state.existingImages.map((img) => ({ type: "existing", data: img })),
                    ...state.newImages.map((img) => ({ type: "new", data: img }))
                ];

                const dragIdx = Number(draggedImage.dataset.newIndex ?? -1);
                const dragIsExisting = draggedImage.dataset.source === "existing";
                const dragId = draggedImage.dataset.id;

                const dropIdx = Number(el.dataset.newIndex ?? -1);
                const dropIsExisting = el.dataset.source === "existing";
                const dropId = el.dataset.id;

                // Resolve the source and destination indices in `all`.
                const findIdx = (source, id, nIdx) =>
                    all.findIndex((x) =>
                        source === "existing"
                            ? x.type === "existing" && String(x.data._id) === String(id)
                            : x.type === "new" && state.newImages.indexOf(x.data) === nIdx
                    );

                const from = findIdx(dragIsExisting ? "existing" : "new", dragId, dragIdx);
                const to = findIdx(dropIsExisting ? "existing" : "new", dropId, dropIdx);

                if (from < 0 || to < 0)
                    return;

                const [moved] = all.splice(from, 1);
                all.splice(to, 0, moved);

                // Rebuild the state from the new ordering.
                state.existingImages = all.filter((x) => x.type === "existing").map((x) => x.data);
                state.newImages = all.filter((x) => x.type === "new").map((x) => x.data);

                renderImages();
            });
        });
    }

    /* ============================================================
       ================= VIDEO ====================================
       ============================================================ */
    const videoDropzone = $("#videoDropzone");
    const videoInput = $("#videoInput");
    const videoContainer = $("#videoContainer");

    videoDropzone.addEventListener("click", () => videoInput.click());

    videoDropzone.addEventListener("dragover", (e) => {
        e.preventDefault();
        videoDropzone.classList.add("dragover");
    });

    videoDropzone.addEventListener("dragleave", () => {
        videoDropzone.classList.remove("dragover");
    });

    videoDropzone.addEventListener("drop", (e) => {
        e.preventDefault();
        videoDropzone.classList.remove("dragover");
        handleVideoFile(e.dataTransfer.files[0]);
    });

    videoInput.addEventListener("change", (e) => {
        handleVideoFile(e.target.files[0]);
        videoInput.value = "";
    });

    /* Validate and stage a demo video file. */
    function handleVideoFile(file) {
        if (!file) return;

        const allowed = ["video/mp4", "video/webm", "video/quicktime"];

        if (!allowed.includes(file.type)) {
            toast("The video format is not supported.", "error");

            return;
        }

        if (file.size > 200 * 1024 * 1024) {
            toast("The video exceeds the 200 MB limit.", "error");

            return;
        }

        state.newVideo = { file, previewUrl: URL.createObjectURL(file), filename: file.name };
        state.existingVideo = null;
        state.videoToDelete = false;

        renderVideo();
    }

    /* Render the video dropzone or the staged video preview. */
    function renderVideo() {
        const video = state.newVideo
            ? { url: state.newVideo.previewUrl, filename: state.newVideo.filename, size: state.newVideo.file.size, isNew: true }
            : state.existingVideo
                ? { url: state.existingVideo.url, filename: state.existingVideo.filename, size: state.existingVideo.size, isNew: false }
                : null;

        if (!video) {
            videoContainer.innerHTML = `
                <div class="pm-dropzone pm-dropzone--video" id="videoDropzone">
                    <input type="file" id="videoInput" accept="video/mp4,video/webm,video/quicktime" hidden>
                    <div class="pm-dropzone__inner">
                        <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                            <polygon points="23 7 16 12 23 17 23 7"></polygon>
                            <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
                        </svg>
                        <p class="pm-dropzone__title">Drop the video here or click to browse.</p>
                        <p class="pm-dropzone__sub">MP4, WebM, MOV</p>
                    </div>
                </div>
            `;

            reinitVideoDropzone();

            return;
        }

        videoContainer.innerHTML = `
            <video src="${escapeHtml(video.url)}" controls class="pm-video-player"></video>

            <div class="pm-media-preview">
                <div class="pm-media-preview__icon" style="color:#a78bfa">
                    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polygon points="23 7 16 12 23 17 23 7"></polygon>
                        <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
                    </svg>
                </div>
                <div class="pm-media-preview__body">
                    <div class="pm-media-preview__name">${escapeHtml(video.filename)}</div>
                    <div class="pm-media-preview__meta">
                        <span>${humanSize(video.size)}</span>
                        ${video.isNew ? `<span style="color:#fbbf24">Pending upload</span>` : ""}
                    </div>
                </div>
                <div class="pm-media-preview__actions">
                    <button type="button" class="pm-media-preview__btn pm-media-preview__btn--danger" data-remove-video>
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"></path>
                        </svg>
                    </button>
                </div>
            </div>
        `;

        videoContainer.querySelector("[data-remove-video]")?.addEventListener("click", () => {
            if (state.existingVideo)
                state.videoToDelete = true;

            state.newVideo = null;
            state.existingVideo = null;

            renderVideo();
        });
    }

    /* Re-bind the dropzone handlers after the container is re-rendered. */
    function reinitVideoDropzone() {
        const dz = $("#videoDropzone");
        const inp = $("#videoInput");
        if (!dz || !inp)
            return;

        dz.addEventListener("click", () => inp.click());
        dz.addEventListener("dragover", (e) => { e.preventDefault(); dz.classList.add("dragover"); });
        dz.addEventListener("dragleave", () => dz.classList.remove("dragover"));
        dz.addEventListener("drop", (e) => {
            e.preventDefault();
            dz.classList.remove("dragover");
            handleVideoFile(e.dataTransfer.files[0]);
        });
        inp.addEventListener("change", (e) => {
            handleVideoFile(e.target.files[0]);
            inp.value = "";
        });
    }

    /* ============================================================
       ================= FILE (ARCHIVE) ===========================
       ============================================================ */
    const fileDropzone = $("#fileDropzone");
    const fileInput = $("#fileInput");
    const fileContainer = $("#fileContainer");
    const fileVersionField = $("#fileVersionField");

    fileDropzone.addEventListener("click", () => fileInput.click());

    fileDropzone.addEventListener("dragover", (e) => {
        e.preventDefault();
        fileDropzone.classList.add("dragover");
    });

    fileDropzone.addEventListener("dragleave", () => {
        fileDropzone.classList.remove("dragover");
    });

    fileDropzone.addEventListener("drop", (e) => {
        e.preventDefault();
        fileDropzone.classList.remove("dragover");
        handleZipFile(e.dataTransfer.files[0]);
    });

    fileInput.addEventListener("change", (e) => {
        handleZipFile(e.target.files[0]);
        fileInput.value = "";
    });

    /* Validate and stage an archive file. */
    function handleZipFile(file) {
        if (!file)
            return;

        const allowed = ["application/zip", "application/x-zip-compressed", "application/x-rar-compressed", "application/gzip", "application/x-7z-compressed", "application/x-tar"];

        const ext = file.name.split(".").pop()?.toLowerCase();
        const allowedExts = ["zip", "rar", "7z", "tar", "gz"];

        if (!allowed.includes(file.type) && !allowedExts.includes(ext || "")) {
            toast("The file format is not supported.", "error");

            return;
        }

        if (file.size > 500 * 1024 * 1024) {
            toast("The file exceeds the 500 MB limit.", "error");

            return;
        }

        state.newFile = { file, filename: file.name, size: file.size };
        state.existingFile = null;
        state.fileToDelete = false;

        renderFile();
    }

    /* Render the archive dropzone or the staged archive preview. */
    function renderFile() {
        const f = state.newFile || state.existingFile;

        if (!f) {
            fileContainer.innerHTML = `
                <div class="pm-dropzone pm-dropzone--file" id="fileDropzone">
                    <input type="file" id="fileInput" accept=".zip,.rar,.7z,.tar,.gz" hidden>
                    <div class="pm-dropzone__inner">
                        <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                            <polyline points="7 10 12 15 17 10"></polyline>
                            <line x1="12" y1="15" x2="12" y2="3"></line>
                        </svg>
                        <p class="pm-dropzone__title">Drop the archive here or click to browse.</p>
                        <p class="pm-dropzone__sub">ZIP, RAR, 7Z, TAR, GZ</p>
                    </div>
                </div>
            `;

            fileVersionField.style.display = "none";

            reinitFileDropzone();

            return;
        }

        const isNew = !!state.newFile;

        fileContainer.innerHTML = `
            <div class="pm-media-preview">
                <div class="pm-media-preview__icon" style="color:#34d399">
                    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                        <polyline points="14 2 14 8 20 8"></polyline>
                    </svg>
                </div>
                <div class="pm-media-preview__body">
                    <div class="pm-media-preview__name">${escapeHtml(f.filename)}</div>
                    <div class="pm-media-preview__meta">
                        <span>${humanSize(f.size || 0)}</span>
                        ${isNew ? `<span style="color:#fbbf24">Pending upload</span>` : ""}
                        ${!isNew && f.downloads ? `<span>${f.downloads} downloads</span>` : ""}
                    </div>
                </div>
                <div class="pm-media-preview__actions">
                    <button type="button" class="pm-media-preview__btn pm-media-preview__btn--danger" data-remove-file>
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"></path>
                        </svg>
                    </button>
                </div>
            </div>
        `;

        fileContainer.querySelector("[data-remove-file]")?.addEventListener("click", () => {
            if (state.existingFile)
                state.fileToDelete = true;

            state.newFile = null;
            state.existingFile = null;

            renderFile();
        });

        fileVersionField.style.display = "";

        if (!isNew && f.version)
            $("#p-fileVersion").value = f.version;
    }

    /* Re-bind the dropzone handlers after the container is re-rendered. */
    function reinitFileDropzone() {
        const dz = $("#fileDropzone");
        const inp = $("#fileInput");
        if (!dz || !inp)
            return;

        dz.addEventListener("click", () => inp.click());
        dz.addEventListener("dragover", (e) => { e.preventDefault(); dz.classList.add("dragover"); });
        dz.addEventListener("dragleave", () => dz.classList.remove("dragover"));
        dz.addEventListener("drop", (e) => {
            e.preventDefault();
            dz.classList.remove("dragover");
            handleZipFile(e.dataTransfer.files[0]);
        });
        inp.addEventListener("change", (e) => {
            handleZipFile(e.target.files[0]);
            inp.value = "";
        });
    }

    /* ============================================================
       Counters and Badges
       ============================================================ */

    /* Update the short-description character counter with colour cues. */
    function updateCounters() {
        const shortEl = $("#shortCount");

        if (shortEl) {
            const len = form.elements.shortDescription.value.length;
            shortEl.textContent = len.toLocaleString('en-US');

            // Colour cues based on proximity to the 500-character limit.
            if (len > 500) shortEl.style.color = '#fb923c';
            else if (len > 400) shortEl.style.color = '#fbbf24';
            else shortEl.style.color = '';
        }
    }

    form.elements.shortDescription?.addEventListener("input", updateCounters);
    form.elements.fullDescription?.addEventListener("input", updateCounters);

    /* Refresh the image count badge. */
    function updateBadges() {
        const imgCount = state.existingImages.length + state.newImages.length;

        $("#imagesCount").textContent = `${imgCount}/10`;
    }

    /* ============================================================
       GitHub URL — Inline Validation
       ============================================================ */
    const githubInput = form.elements.githubUrl;
    const githubHint = $("#githubHint");

    /* Validate the GitHub URL field and display an inline hint. */
    function validateGithubUrl() {
        const val = githubInput.value.trim();

        githubHint.className = "field-hint";
        githubHint.textContent = "";

        if (!val)
            return;

        const re = /^(https?:\/\/)?(www\.)?github\.com\/[\w.-]+\/[\w.-]+\/?$/i;

        if (re.test(val)) {
            githubHint.textContent = "✓ The URL is valid.";
            githubHint.classList.add("success");
        } else {
            githubHint.textContent = "✗ The GitHub URL is invalid.";
            githubHint.classList.add("error");
        }
    }

    githubInput?.addEventListener("blur", validateGithubUrl);
    githubInput?.addEventListener("input", () => {
        githubHint.className = "field-hint";
        githubHint.textContent = "";
    });

    /* ============================================================
       ================= SUBMISSION ===============================
       ============================================================ */
    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        /* ---------- Collect and sanitise tag identifiers ---------- */
        const rawTags = state.tagPicker ? state.tagPicker.getSelected() : [];

        const OBJECT_ID_RE = /^[a-f\d]{24}$/i;
        const tags = [...new Set(rawTags)]
            .filter((id) => typeof id === "string" && OBJECT_ID_RE.test(id));

        if (rawTags.length !== tags.length) {
            console.warn(
                `[submit] sanitized tags: ${rawTags.length} → ${tags.length}`,
                "removed:", rawTags.filter((id) => !tags.includes(id))
            );
        }

        const values = {
            title: form.elements.title.value.trim(),
            slug: form.elements.slug.value.trim() || undefined,
            githubUrl: form.elements.githubUrl.value.trim() || null,
            autoSync: form.elements.autoSync.checked,
            shortDescription: form.elements.shortDescription.value.trim(),
            fullDescription: form.elements.fullDescription.value.trim(),
            tags,   // Sanitised array of tag identifiers.
            status: form.querySelector(`input[name="status"]:checked`)?.value || "published",
            isPublic: form.elements.isPublic.checked
        };

        /* ---------- Client-side validation ---------- */
        const errors = {};

        if (!values.title || values.title.length < 2) {
            errors.title = "The title must be at least 2 characters long.";

            goToStep(0);
        }

        if (!values.shortDescription) {
            errors.shortDescription = "A short description is required.";

            if (!errors.title)
                goToStep(1);
        }

        if (!values.fullDescription || values.fullDescription.length < 20) {
            errors.fullDescription = "The full description must be at least 20 characters long.";

            if (!errors.title && !errors.shortDescription)
                goToStep(1);
        }

        if (Object.keys(errors).length) {
            FormKit.clearAllErrors(form);

            for (const [k, m] of Object.entries(errors)) {
                const input = form.querySelector(`[name="${k}"]`);

                if (input)
                    FormKit.showFieldError(input, m);
            }

            const first = Object.keys(errors)[0];
            form.querySelector(`[name="${first}"]`)?.focus();

            return;
        }

        FormKit.clearAllErrors(form);

        modalSubmit.disabled = true;
        const originalText = modalSubmit.textContent;
        modalSubmit.textContent = "Saving…";

        values.fullDescription = mdEditor.getValue();

        try {
            const isEdit = !!state.editingId;
            const url = isEdit ? `/api/projects/${state.editingId}` : "/api/projects";
            const method = isEdit ? "PUT" : "POST";

            /* ---------- 1) Persist the project core ---------- */
            const saved = await api(url, { method, body: JSON.stringify(values) });
            const projectId = saved.project._id;

            /* ---------- 2) Upload associated media ---------- */
            await uploadAllMedia(projectId);

            /* ---------- Completion ---------- */
            toast(isEdit ? "The project has been updated." : "The project has been created.", "success");
            closeModal();

            await loadProjects();
        } catch (err) {
            if (err.details || err.field) {
                FormKit.applyServerErrors(form, err);
            }

            toast(err.message || "Failed to save the project.", "error");
        } finally {
            modalSubmit.disabled = false;
            modalSubmit.textContent = originalText;
        }
    });

    /* ============================================================
       Media Upload — Orchestration
       ============================================================
       Uploads staged media and processes pending deletions for the
       given project. All operations run in parallel where possible.
       ============================================================ */
    async function uploadAllMedia(projectId) {
        const tasks = [];

        // 1) New images
        if (state.newImages.length) {
            tasks.push(uploadImages(projectId));
        }

        // 2) Images flagged for deletion (edit mode only)
        for (const imgId of state.imagesToDelete) {
            tasks.push(
                api(`/api/projects/${projectId}/images/${imgId}`, { method: "DELETE" }).catch(() => { })
            );
        }

        // 3) Image ordering (idempotent)
        tasks.push(reorderImages(projectId));

        // 4) Video
        if (state.newVideo) {
            tasks.push(uploadVideo(projectId));
        } else if (state.videoToDelete) {
            tasks.push(
                api(`/api/projects/${projectId}/video`, { method: "DELETE" }).catch(() => { })
            );
        }

        // 5) Archive file
        if (state.newFile) {
            tasks.push(uploadFile(projectId));
        } else if (state.fileToDelete) {
            tasks.push(
                api(`/api/projects/${projectId}/file`, { method: "DELETE" }).catch(() => { })
            );
        }

        await Promise.all(tasks);
    }

    /* Upload all staged images in a single multipart request. */
    async function uploadImages(projectId) {
        const fd = new FormData();

        for (const img of state.newImages) {
            fd.append("images", img.file);
        }

        await api(`/api/projects/${projectId}/images`, {
            method: "POST",
            body: fd,
        });
    }

    /* Persist the current ordering of existing images. */
    async function reorderImages(projectId) {
        const existingIds = state.existingImages.map((i) => i._id).filter(Boolean);

        if (existingIds.length === 0)
            return;

        await api(`/api/projects/${projectId}/images/order`, {
            method: "PATCH",
            body: JSON.stringify({ order: existingIds })
        }).catch(() => { });
    }

    /* Upload the staged demo video. */
    async function uploadVideo(projectId) {
        const fd = new FormData();
        fd.append("video", state.newVideo.file);

        await api(`/api/projects/${projectId}/video`, {
            method: "POST",
            body: fd
        });
    }

    /* Upload the staged archive file, optionally with a version label. */
    async function uploadFile(projectId) {
        const fd = new FormData();
        fd.append("file", state.newFile.file);

        const version = $("#p-fileVersion")?.value?.trim();
        if (version)
            fd.append("version", version);

        await api(`/api/projects/${projectId}/file`, {
            method: "POST",
            body: fd,
        });
    }

    /* ============================================================
       ================= CARD ACTIONS =============================
       ============================================================ */

    /* Delete a project after confirmation. */
    async function deleteProject(id) {
        const p = state.items.find((x) => x._id === id);

        const ok = await confirmDialog({
            title: "Delete project",
            message: `Are you sure you want to delete "${p?.title || "this project"}"? All images, the video, the archive, and comments will also be removed.`,
            confirmText: "Yes, delete",
            cancelText: "Cancel",
            danger: true
        });

        if (!ok)
            return;

        try {
            await api(`/api/projects/${id}`, { method: "DELETE" });

            toast("The project has been deleted.", "success");

            await loadProjects();
        } catch (err) {
            toast(err.message || "Deletion failed.", "error");
        }
    }

    /* Synchronise project metadata with the linked GitHub repository. */
    async function syncGithub(id, btn) {
        const originalHTML = btn.innerHTML;

        btn.disabled = true;
        btn.innerHTML = "...";

        try {
            await api(`/api/projects/${id}/sync-github`, { method: "POST" });

            toast("Project metadata has been synchronised with GitHub.", "success");

            await loadProjects();
        } catch (err) {
            toast(err.message || "Synchronisation failed.", "error");

            btn.disabled = false;
            btn.innerHTML = originalHTML;
        }
    }

    /* ============================================================
       ================= HELPERS ==================================
       ============================================================ */

    /* Escape user-supplied strings before interpolating them into HTML. */
    function escapeHtml(str) {
        if (str == null)
            return "";

        return String(str)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    /* Convert a hex colour to an rgba() string with the given alpha. */
    function hexA(hex, alpha) {
        if (!hex) return `rgba(110,187,255,${alpha})`;

        const h = hex.replace("#", "");
        const r = parseInt(h.substr(0, 2), 16);
        const g = parseInt(h.substr(2, 2), 16);
        const b = parseInt(h.substr(4, 2), 16);

        return `rgba(${r},${g},${b},${alpha})`;
    }

    /* Convert a byte count into a human-readable size string. */
    function humanSize(bytes) {
        if (!bytes)
            return "0 B";

        if (bytes < 1024)
            return `${bytes} B`;

        if (bytes < 1024 * 1024)
            return `${(bytes / 1024).toFixed(1)} KB`;

        if (bytes < 1024 * 1024 * 1024)
            return `${(bytes / 1024 / 1024).toFixed(1)} MB`;

        return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
    }

    /* ============================================================
       ================= INITIALIZATION ===========================
       ============================================================
       Instantiate the Markdown editor and tag picker, then load
       the initial page of projects.
       ============================================================ */
    let mdEditor;

    (function init() {
        if (window.MarkdownEditor) {
            mdEditor = new MarkdownEditor("#fullDescriptionEditor", {
                name: "fullDescriptionEditor",
                value: "",
                maxLength: 100000,
                onChange: () => {
                    // Keep the hidden input in sync with the editor value.
                    form.elements.fullDescription.value = mdEditor.getValue();
                }
            });
        }

        // Tag picker
        if (window.TagPicker) {
            state.tagPicker = new TagPicker(document.getElementById("tagPickerRoot"), {
                maxTags: 20,
                onChange: (ids) => {
                    const badge = $("#tagsCountBadge");

                    if (badge)
                        badge.textContent = `${ids.length}/20`;
                }
            });
        }

        // Load list
        loadProjects();
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