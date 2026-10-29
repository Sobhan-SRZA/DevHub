/* ============================================================
   Project Detail Page
   ============================================================
   Handles the full project detail view: metadata rendering,
   image gallery with lightbox, reviews (including the current
   user's own review), threaded comments, related projects,
   and the share modal.
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
    /* ============================================================
       View State
       ============================================================
       Centralised state for the project, the current user, the
       user's own review, review/comment pagination, and gallery.
       ============================================================ */
    const state = {
        projectId: null,
        project: null,
        currentUser: null,
        myReview: null,
        reviews: { page: 1, sort: 'recent', distribution: {} },
        comments: { page: 1, sort: 'recent' },
        gallery: { items: [], index: 0 },
    };

    const $ = (selector, root = document) => root.querySelector(selector);
    const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

    const pageEl = $('#projectPage');
    const idOrSlug = pageEl.dataset.projectId;

    /* ============================================================
       API Helper
       ============================================================
       Sends credentialed JSON requests and normalises failures
       into Error objects that preserve the server payload.
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
       Helpers
       ============================================================ */

    /* Escape user-supplied strings before interpolating them into HTML. */
    function escapeHtml(s) {
        if (s == null) return '';

        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    /* Abbreviate large numbers using K/M suffixes. */
    function formatNumber(n) {
        n = Number(n) || 0;

        if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
        if (n >= 1000) return (n / 1000).toFixed(1) + 'K';

        return String(n);
    }

    /* Format an ISO date as a medium-length English date. */
    function formatDate(d) {
        if (!d) return '—';

        try {
            return new Intl.DateTimeFormat('en-US', {
                dateStyle: 'medium',
            }).format(new Date(d));
        } catch {
            return '—';
        }
    }

    /* Render a human-friendly relative time string (e.g. "3 days ago"). */
    function relativeTime(d) {
        if (!d) return '';

        const diff = Date.now() - new Date(d).getTime();
        const s = Math.floor(diff / 1000);

        if (s < 60) return 'just now';

        const m = Math.floor(s / 60);
        if (m < 60) return `${m} minute${m === 1 ? '' : 's'} ago`;

        const h = Math.floor(m / 60);
        if (h < 24) return `${h} hour${h === 1 ? '' : 's'} ago`;

        const days = Math.floor(h / 24);
        if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;

        const months = Math.floor(days / 30);
        if (months < 12) return `${months} month${months === 1 ? '' : 's'} ago`;

        const years = Math.floor(months / 12);
        return `${years} year${years === 1 ? '' : 's'} ago`;
    }

    /* Convert a byte count into a human-readable size string. */
    function humanSize(bytes) {
        bytes = Number(bytes) || 0;

        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;

        return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
    }

    /* Convert a hex colour to an rgba() string with the given alpha. */
    function hexA(hex, a) {
        if (!hex) return `rgba(110,187,255,${a})`;

        const h = hex.replace('#', '');
        const r = parseInt(h.substr(0, 2), 16);
        const g = parseInt(h.substr(2, 2), 16);
        const b = parseInt(h.substr(4, 2), 16);

        return `rgba(${r},${g},${b},${a})`;
    }

    /* ============================================================
       Project Loading
       ============================================================
       Fetch the project and the current user in parallel, then
       render the view and trigger the dependent sub-loads.
       ============================================================ */
    async function loadProject() {
        try {
            const [projectRes, userRes] = await Promise.allSettled([
                api(`/api/projects/${idOrSlug}`),
                api('/api/auth/me'),
            ]);

            if (projectRes.status === 'rejected') {
                showError(projectRes.reason);
                return;
            }

            state.project = projectRes.value.project;
            state.projectId = state.project._id;

            if (userRes.status === 'fulfilled') {
                state.currentUser = userRes.value.user;
            }

            render();
            $('#pageLoading').style.display = 'none';
            $('#pageContent').style.display = 'block';

            // Load dependent sections after the main view is rendered.
            loadReviews();
            loadComments();
            loadRelated();
        } catch (err) {
            showError(err);
        }
    }

    /* Show the error panel with messaging appropriate to the status code. */
    function showError(err) {
        $('#pageLoading').style.display = 'none';
        $('#pageError').style.display = 'flex';

        if (err.status === 403) {
            $('#errorTitle').textContent = 'Access denied';
            $('#errorSub').textContent = 'This project is not public.';
        } else if (err.status === 404) {
            $('#errorTitle').textContent = 'Project not found';
            $('#errorSub').textContent = 'It may have been removed.';
        } else {
            $('#errorTitle').textContent = 'Failed to load';
            $('#errorSub').textContent = err.message || 'Please try again.';
        }
    }

    /* ============================================================
       Project Rendering
       ============================================================
       Populates every section of the project page from the loaded
       project payload, adapting the view to the viewer's role.
       ============================================================ */
    function render() {
        const p = state.project;
        const owner = p.owner || {};
        const gh = p.githubData || {};
        const isOwner = state.currentUser && String(state.currentUser.id) === String(owner._id || owner);

        document.title = `${p.title} — Project`;

        /* Breadcrumb */
        $('#breadcrumbName').textContent = p.title;

        /* Avatar / Cover */
        const cover = p.images?.[0]?.url;
        const avatarEl = $('#projectAvatar');

        if (cover) {
            avatarEl.style.backgroundImage = `url('${cover}')`;
            avatarEl.textContent = '';
        } else {
            avatarEl.textContent = (p.title || '?').charAt(0).toUpperCase();
        }

        /* Title / Status / Short Description */
        $('#projectTitle').textContent = p.title;

        const statusMap = { draft: 'Draft', published: 'Published', archived: 'Archived' };
        const statusEl = $('#projectStatus');
        statusEl.textContent = statusMap[p.status] || p.status;
        statusEl.className = `proj-status proj-status--${p.status}`;

        $('#projectShort').textContent = p.shortDescription || '';

        /* Owner */
        $('#ownerName').textContent = owner.name || owner.username || 'User';

        const ownerLink = document.getElementById('ownerLink');
        if (ownerLink && owner.username) {
            ownerLink.href = `/users/${encodeURIComponent(owner.username)}`;
        } else if (ownerLink) {
            ownerLink.removeAttribute('href');
            ownerLink.style.pointerEvents = 'none';
        }

        const ownerAvatar = document.getElementById('ownerAvatar');
        if (owner.avatar?.url) {
            ownerAvatar.style.backgroundImage = `url('${owner.avatar.url}')`;
            ownerAvatar.textContent = '';
        } else {
            ownerAvatar.textContent = (owner.name || '?').charAt(0).toUpperCase();
        }

        /* Actions */
        if (p.githubUrl) {
            const ghBtn = $('#btnGithub');
            ghBtn.href = p.githubUrl;
            ghBtn.style.display = '';
        }

        if (isOwner) {
            const editBtn = $('#btnEdit');
            editBtn.href = `/dashboard/projects?edit=${p._id}`;
            editBtn.style.display = '';
        }

        /* Tags */
        const tags = p.tags || [];

        $('#projectTags').innerHTML = tags.map((t) => `
            <a href="/projects?tag=${t._id}" class="proj-tag"
               style="background:${hexA(t.color, 0.12)}; color:${t.color}; border-color:${hexA(t.color, 0.3)}">
                ${escapeHtml(t.name)}
            </a>
        `).join('');

        $('#sideTags').innerHTML = tags.length
            ? tags.map((t) => `
                <a href="/projects?tag=${t._id}" class="side-tag"
                   style="background:${hexA(t.color, 0.1)}; color:${t.color}; border-color:${hexA(t.color, 0.25)}">
                    ${escapeHtml(t.name)}
                </a>
              `).join('')
            : '<div style="color:#666;font-size:0.82rem">No tags</div>';

        /* Stats */
        $('#statStars').textContent = formatNumber(gh.stars);
        $('#statForks').textContent = formatNumber(gh.forks);
        $('#statDownloads').textContent = formatNumber(p.downloads);
        $('#statRating').textContent = (p.rating || 0).toFixed(1);
        $('#statViews').textContent = formatNumber(p.views);
        $('#statRatingCount').textContent = p.reviewCount
            ? `${p.reviewCount} review${p.reviewCount === 1 ? '' : 's'}`
            : 'No ratings';

        /* Gallery */
        renderGallery(p.images || []);

        /* Description */
        const descriptionHtml = (window.parseMarkdown
            ? window.parseMarkdown(p.fullDescription || '')
            : escapeHtml(p.fullDescription || '').replace(/\n/g, '<br>'));
        $('#projectDescription').innerHTML = descriptionHtml || '<em style="color:#666">No description</em>';

        /* Video */
        if (p.demoVideo?.url) {
            $('#videoSection').style.display = '';
            $('#videoContainer').innerHTML = `
                <video src="${escapeHtml(p.demoVideo.url)}" controls preload="metadata"></video>
            `;
        }

        /* Download */
        if (p.downloadFile?.url) {
            $('#downloadCard').style.display = '';
            $('#fileVersion').textContent = p.downloadFile.version
                ? `Version ${p.downloadFile.version}`
                : 'Download project';
            $('#fileSize').textContent = humanSize(p.downloadFile.size);
            $('#downloadBtn').href = `/api/projects/${p._id}/download`;

            const metaParts = [];
            if (p.downloadFile.filename) metaParts.push(`<span>📄 ${escapeHtml(p.downloadFile.filename)}</span>`);
            if (p.downloadFile.downloads != null) metaParts.push(`<span>⬇ ${p.downloadFile.downloads} downloads</span>`);
            $('#fileMeta').innerHTML = metaParts.join('');
        }

        /* Info list */
        const statusLabel = { draft: 'Draft', published: 'Published', archived: 'Archived' };
        $('#infoStatus').textContent = statusLabel[p.status] || p.status;
        $('#infoCreated').textContent = formatDate(p.createdAt);
        $('#infoUpdated').textContent = relativeTime(p.updatedAt);

        if (gh.license) {
            $('#infoLicenseRow').style.display = '';
            $('#infoLicense').textContent = gh.license;
        }

        if (gh.language) {
            $('#infoLanguageRow').style.display = '';
            $('#infoLanguage').textContent = gh.language;
        }

        /* Reviews summary */
        updateReviewsSummary(p);

        /* Comment form visibility */
        if (state.currentUser) {
            $('#commentForm').style.display = '';
            $('#commentLogin').style.display = 'none';

            const name = state.currentUser.name || state.currentUser.username || '?';
            $('#myAvatar').textContent = name.charAt(0).toUpperCase();
        } else {
            $('#commentForm').style.display = 'none';
            $('#commentLogin').style.display = 'flex';
        }

        /* Review box visibility */
        if (!state.currentUser) {
            $('#reviewCta').style.display = 'none';
            $('#reviewForm').style.display = 'none';
        } else if (isOwner) {
            // Project owners cannot review their own project.
            $('#reviewCta').innerHTML = `
                <div class="review-box__cta-icon">👑</div>
                <div class="review-box__cta-text">
                    <strong>You own this project</strong>
                    <small>You cannot rate your own project.</small>
                </div>
            `;
        }
    }

    /* ============================================================
       Gallery
       ============================================================ */
    function renderGallery(images) {
        if (!images.length) {
            $('#gallerySection').style.display = 'none';
            return;
        }

        $('#gallerySection').style.display = '';
        $('#imagesCount').textContent = images.length;
        state.gallery.items = images;

        $('#gallery').innerHTML = images.map((img, i) => `
            <div class="gallery-item" data-index="${i}">
                <img src="${escapeHtml(img.url)}" alt="${escapeHtml(img.alt || '')}" loading="lazy">
                <div class="gallery-item__overlay">
                    <span>${escapeHtml(img.filename || `Image ${i + 1}`)}</span>
                </div>
            </div>
        `).join('');

        $$('#gallery .gallery-item').forEach((el) => {
            el.addEventListener('click', () => {
                openLightbox(Number(el.dataset.index));
            });
        });
    }

    /* ============================================================
       Lightbox
       ============================================================ */
    const lightbox = $('#lightbox');
    const lightboxImg = $('#lightboxImage');
    const lightboxCounter = $('#lightboxCounter');

    function openLightbox(index) {
        state.gallery.index = index;
        updateLightbox();
        lightbox.classList.add('open');
        document.body.style.overflow = 'hidden';
    }

    function closeLightbox() {
        lightbox.classList.remove('open');
        document.body.style.overflow = '';
    }

    function updateLightbox() {
        const items = state.gallery.items;
        if (!items.length) return;

        const i = state.gallery.index;
        lightboxImg.src = items[i].url;
        lightboxImg.alt = items[i].alt || '';
        lightboxCounter.textContent = `${i + 1} / ${items.length}`;
    }

    $('#lightboxClose').addEventListener('click', closeLightbox);

    $('#lightboxPrev').addEventListener('click', () => {
        const n = state.gallery.items.length;
        if (!n) return;

        state.gallery.index = (state.gallery.index - 1 + n) % n;
        updateLightbox();
    });

    $('#lightboxNext').addEventListener('click', () => {
        const n = state.gallery.items.length;
        if (!n) return;

        state.gallery.index = (state.gallery.index + 1) % n;
        updateLightbox();
    });

    lightbox.addEventListener('click', (e) => {
        if (e.target === lightbox || e.target.classList.contains('lightbox__image-wrap')) {
            closeLightbox();
        }
    });

    document.addEventListener('keydown', (e) => {
        if (!lightbox.classList.contains('open')) return;

        if (e.key === 'Escape') closeLightbox();
        else if (e.key === 'ArrowLeft') $('#lightboxNext').click();
        else if (e.key === 'ArrowRight') $('#lightboxPrev').click();
    });

    /* ============================================================
       Reviews
       ============================================================ */
    async function loadReviews() {
        try {
            const data = await api(`/api/projects/${state.projectId}/reviews?sort=${state.reviews.sort}&limit=50`);

            state.reviews.distribution = data.distribution || {};
            state.myReview = data.myReview || null;

            updateReviewsSummary(data.summary || {});
            renderMyReview();
            renderReviews(data.reviews || []);
        } catch (err) {
            $('#reviewsList').innerHTML = `<div class="panel-empty">Failed to load reviews.</div>`;
        }
    }

    /* Render the average rating, star row, and rating distribution bars. */
    function updateReviewsSummary(summary) {
        const p = state.project || {};
        const rating = summary.rating ?? p.rating ?? 0;
        const count = summary.reviewCount ?? p.reviewCount ?? 0;

        $('#avgRating').textContent = rating.toFixed(1);
        $('#avgCount').textContent = count === 0
            ? 'No ratings'
            : `${count} review${count === 1 ? '' : 's'}`;
        $('#reviewsCount').textContent = count;

        const starsHtml = Array.from({ length: 5 }, (_, i) => {
            const filled = i < Math.round(rating);

            return filled
                ? '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>'
                : '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>';
        }).join('');

        $('#avgStars').innerHTML = starsHtml;

        const dist = state.reviews.distribution || {};
        const total = Object.values(dist).reduce((a, b) => a + b, 0) || 1;

        $('#reviewsDist').innerHTML = [5, 4, 3, 2, 1].map((star) => {
            const c = dist[star] || 0;
            const pct = (c / total) * 100;

            return `
                <div class="dist-row">
                    <span class="dist-row__label">${star} ★</span>
                    <div class="dist-row__bar">
                        <div class="dist-row__fill" style="width:${pct}%"></div>
                    </div>
                    <span class="dist-row__count">${c}</span>
                </div>
            `;
        }).join('');
    }

    /* Render the current user's own review, or reveal the write-review CTA. */
    function renderMyReview() {
        const mine = $('#reviewMine');
        const cta = $('#reviewCta');
        const form = $('#reviewForm');

        if (!state.myReview) {
            mine.style.display = 'none';

            if (state.currentUser && state.project &&
                String(state.currentUser.id) !== String(state.project.owner?._id || state.project.owner)) {
                cta.style.display = '';
            }

            form.style.display = 'none';
            return;
        }

        cta.style.display = 'none';
        form.style.display = 'none';
        mine.style.display = '';

        const r = state.myReview;
        const starsHtml = Array.from({ length: 5 }, (_, i) =>
            i < Math.round(r.rating)
                ? '<span style="color:#fbbf24">★</span>'
                : '<span style="color:#2a2a2a">★</span>'
        ).join('');

        mine.innerHTML = `
            <div class="my-review__head">
                <span class="my-review__badge">
                    <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                    Your review
                </span>
                <div class="my-review__actions">
                    <button type="button" class="my-review__btn" id="editMyReview">Edit</button>
                    <button type="button" class="my-review__btn my-review__btn--danger" id="deleteMyReview">Delete</button>
                </div>
            </div>

            <div class="my-review__rating">${starsHtml}</div>

            ${r.title ? `<h4 class="my-review__title">${escapeHtml(r.title)}</h4>` : ''}
            ${r.body ? `<p class="my-review__body">${escapeHtml(r.body)}</p>` : ''}

            <div class="my-review__meta">
                <span>Satisfaction: ${r.satisfaction}%</span>
                <span>${relativeTime(r.createdAt)}</span>
                ${r.isEdited ? '<span>Edited</span>' : ''}
            </div>
        `;

        $('#editMyReview')?.addEventListener('click', () => openReviewForm(r));
        $('#deleteMyReview')?.addEventListener('click', deleteMyReview);
    }

    /* Render other users' reviews, excluding the current user's own review. */
    function renderReviews(reviews) {
        if (!reviews.length) {
            $('#reviewsList').innerHTML = `<div class="panel-empty">No reviews yet — be the first!</div>`;
            return;
        }

        // Exclude the user's own review; it is rendered separately above.
        const filtered = state.myReview
            ? reviews.filter((r) => r._id !== state.myReview._id)
            : reviews;

        if (!filtered.length) {
            $('#reviewsList').innerHTML = `<div class="panel-empty">Only your review has been submitted.</div>`;
            return;
        }

        $('#reviewsList').innerHTML = filtered.map((r) => {
            const u = r.user || {};
            const name = u.name || u.username || 'User';
            const initial = name.charAt(0).toUpperCase();

            const starsHtml = Array.from({ length: 5 }, (_, i) =>
                i < Math.round(r.rating)
                    ? '<span style="color:#fbbf24">★</span>'
                    : '<span style="color:#2a2a2a">★</span>'
            ).join('');

            const avatarStyle = u.avatar?.url
                ? `background-image:url('${escapeHtml(u.avatar.url)}')`
                : '';

            const userLink = u.username
                ? `<a href="/users/${encodeURIComponent(u.username)}" class="review-item__avatar-link" onclick="event.stopPropagation();">
                   <div class="review-item__avatar" style="${avatarStyle}">${!u.avatar?.url ? escapeHtml(initial) : ''}</div>
               </a>`
                : `<div class="review-item__avatar">${escapeHtml(initial)}</div>`;

            const nameHtml = u.username
                ? `<a href="/users/${encodeURIComponent(u.username)}" class="review-item__name-link">${escapeHtml(name)}</a>`
                : `<span>${escapeHtml(name)}</span>`;

            return `
                <article class="review-item" data-id="${r._id}">
                    <div class="review-item__head">
                        ${userLink}
                        <div class="review-item__author">
                            <span class="review-item__name">${nameHtml}</span>
                            <span class="review-item__date">${relativeTime(r.createdAt)}</span>
                        </div>
                        <div class="review-item__stars">${starsHtml}</div>
                    </div>

                    ${r.title ? `<h4 class="review-item__title">${escapeHtml(r.title)}</h4>` : ''}
                    ${r.body ? `<p class="review-item__body">${escapeHtml(r.body)}</p>` : ''}

                    <div class="review-item__footer">
                        <div class="review-item__satisfaction">
                            <span>Satisfaction</span>
                            <div class="review-item__satisfaction-bar">
                                <div class="review-item__satisfaction-fill" style="width:${r.satisfaction}%"></div>
                            </div>
                            <span>${r.satisfaction}%</span>
                        </div>

                        <button type="button" class="review-item__helpful" data-helpful="${r._id}">
                            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path>
                            </svg>
                            Helpful (${r.helpfulCount || 0})
                        </button>
                    </div>
                </article>
            `;
        }).join('');

        $$('[data-helpful]').forEach((btn) => {
            btn.addEventListener('click', () => markHelpful(btn.dataset.helpful, btn));
        });
    }

    /* Mark a review as helpful and refresh the displayed count. */
    async function markHelpful(id, btn) {
        btn.disabled = true;

        try {
            const data = await api(`/api/projects/${state.projectId}/reviews/${id}/helpful`, { method: 'POST' });
            btn.innerHTML = btn.innerHTML.replace(/\(\d+\)/, `(${data.helpfulCount})`);
        } catch (err) {
            if (err.status === 401) {
                toast('Sign in to do this', 'info');
            }
        } finally {
            btn.disabled = false;
        }
    }

    /* ---------- Review Form ---------- */
    const reviewForm = $('#reviewForm');
    const starRating = $('#starRating');
    const satisfactionSlider = $('#reviewSatisfaction');

    let reviewRating = 0;

    $('#btnWriteReview')?.addEventListener('click', () => openReviewForm(null));
    $('#reviewFormClose')?.addEventListener('click', closeReviewForm);
    $('#reviewCancel')?.addEventListener('click', closeReviewForm);

    /**
     * Reveal the review form and prefill it when editing an existing
     * review, or reset it when composing a new one.
     */
    function openReviewForm(existing) {
        reviewForm.style.display = '';
        $('#reviewCta').style.display = 'none';

        if (existing) {
            $('#reviewFormTitle').textContent = 'Edit review';
            $('#reviewSubmit').textContent = 'Save changes';
            reviewRating = existing.rating;
            $('#reviewTitle').value = existing.title || '';
            $('#reviewBody').value = existing.body || '';
            satisfactionSlider.value = existing.satisfaction;
        } else {
            $('#reviewFormTitle').textContent = 'New review';
            $('#reviewSubmit').textContent = 'Submit review';
            reviewRating = 0;
            $('#reviewTitle').value = '';
            $('#reviewBody').value = '';
            satisfactionSlider.value = 80;
        }

        updateStars(reviewRating);
        updateSatisfaction();

        setTimeout(() => reviewForm.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
    }

    /* Hide the review form and restore the appropriate prior state. */
    function closeReviewForm() {
        reviewForm.style.display = 'none';

        if (state.myReview) {
            $('#reviewMine').style.display = '';
        } else if (state.currentUser) {
            $('#reviewCta').style.display = '';
        }
    }

    /* Reflect the selected rating on the star buttons and label. */
    function updateStars(v) {
        $$('#starRating button').forEach((b) => {
            b.classList.toggle('active', Number(b.dataset.star) <= v);
        });

        $('#starValue').textContent = v;
    }

    /* Update the satisfaction percentage label. */
    function updateSatisfaction() {
        $('#satisfactionValue').textContent = `${satisfactionSlider.value}%`;
    }

    $$('#starRating button').forEach((btn) => {
        btn.addEventListener('click', () => {
            reviewRating = Number(btn.dataset.star);
            updateStars(reviewRating);
        });

        btn.addEventListener('mouseenter', () => {
            const hoverValue = Number(btn.dataset.star);
            $$('#starRating button').forEach((b) => {
                b.classList.toggle('hover', Number(b.dataset.star) <= hoverValue);
            });
        });

        btn.addEventListener('mouseleave', () => {
            $$('#starRating button').forEach((b) => b.classList.remove('hover'));
        });
    });

    satisfactionSlider.addEventListener('input', updateSatisfaction);

    reviewForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        if (reviewRating < 1) {
            toast('Please provide a rating', 'error');
            return;
        }

        const payload = {
            rating: reviewRating,
            satisfaction: Number(satisfactionSlider.value),
            title: $('#reviewTitle').value.trim() || undefined,
            body: $('#reviewBody').value.trim() || undefined,
        };

        const submitBtn = $('#reviewSubmit');
        submitBtn.disabled = true;
        const original = submitBtn.textContent;
        submitBtn.textContent = 'Saving…';

        try {
            const isEdit = !!state.myReview;

            await api(`/api/projects/${state.projectId}/reviews`, {
                method: isEdit ? 'PUT' : 'POST',
                body: JSON.stringify(payload),
            });

            toast(isEdit ? 'Review updated' : 'Review submitted', 'success');

            await loadReviews();

            // Refresh the project to pick up the new aggregate rating.
            const p = await api(`/api/projects/${state.projectId}`);
            state.project = p.project;

            updateReviewsSummary({
                rating: p.project.rating,
                reviewCount: p.project.reviewCount,
            });
        } catch (err) {
            toast(err.message || 'Failed to save', 'error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = original;
        }
    });

    /* Delete the current user's own review after confirmation. */
    async function deleteMyReview() {
        const ok = await confirmDialog({
            title: 'Delete review',
            message: 'Are you sure you want to delete your review?',
            confirmText: 'Delete',
            danger: true,
        });
        if (!ok) return;

        try {
            await api(`/api/projects/${state.projectId}/reviews`, { method: 'DELETE' });

            toast('Review deleted', 'success');
            state.myReview = null;

            await loadReviews();
        } catch (err) {
            toast(err.message || 'Failed to delete', 'error');
        }
    }

    /* ============================================================
       Comments
       ============================================================ */
    async function loadComments() {
        try {
            const data = await api(`/api/projects/${state.projectId}/comments?sort=${state.comments.sort}&limit=100`);
            renderComments(data.comments || []);
        } catch (err) {
            $('#commentsList').innerHTML = `<div class="panel-empty">Failed to load comments.</div>`;
        }
    }

    /* Render the full comment tree and bind per-comment actions. */
    function renderComments(comments) {
        $('#commentsCount').textContent = countAll(comments);

        if (!comments.length) {
            $('#commentsList').innerHTML = `<div class="panel-empty">No comments yet — be the first!</div>`;
            return;
        }

        $('#commentsList').innerHTML = comments.map((c) => renderComment(c, 0)).join('');
        bindCommentActions();
    }

    /* Count comments recursively, including nested replies. */
    function countAll(comments) {
        let n = comments.length;

        for (const c of comments) {
            if (c.replies) n += countAll(c.replies);
        }

        return n;
    }

    /**
     * Produce the markup for a single comment, including its replies.
     * Nesting is capped at MAX_DEPTH; deeper levels cannot be replied to.
     */
    function renderComment(c, depth) {
        const u = c.user || {};
        const name = u.name || u.username || 'User';
        const initial = name.charAt(0).toUpperCase();

        const isMyComment = state.currentUser && String(state.currentUser.id) === String(u._id);
        const isProjectOwner = state.currentUser && state.project &&
            String(state.currentUser.id) === String(state.project.owner?._id || state.project.owner);

        const liked = state.currentUser &&
            (c.likes || []).some((id) => String(id) === String(state.currentUser.id));

        const MAX_DEPTH = 5;
        const canReply = depth < MAX_DEPTH;

        const replies = c.replies || [];
        const replyCount = replies.length;

        const bodyHtml = c.isDeleted
            ? `<div class="comment__text comment__text--deleted">${escapeHtml(c.body || '[This comment has been deleted]')}</div>`
            : `<div class="comment__text">${escapeHtml(c.body)}</div>`;

        return `
            <div class="comment ${c.isDeleted ? 'comment--deleted' : ''}" data-comment-id="${c._id}" data-depth="${depth}">
                <div class="comment__avatar">${escapeHtml(initial)}</div>
                <div class="comment__body">
                    <div class="comment__head">
                        <span class="comment__author">${escapeHtml(name)}</span>
                        ${isProjectOwner ? '<span class="comment__badge">Project owner</span>' : ''}
                        <span class="comment__date">${relativeTime(c.createdAt)}</span>
                        ${c.isEdited ? '<span class="comment__edited">(edited)</span>' : ''}
                    </div>

                    ${bodyHtml}

                    <div class="comment__actions">
                        ${!c.isDeleted && state.currentUser ? `
                            <button type="button" class="comment__action ${liked ? 'liked' : ''}" data-action="like">
                                <svg viewBox="0 0 24 24" width="13" height="13" fill="${liked ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                                </svg>
                                <span class="comment__likes-count">${(c.likes || []).length}</span>
                            </button>
                        ` : ''}

                        ${!c.isDeleted && state.currentUser && canReply ? `
                            <button type="button" class="comment__action" data-action="reply">
                                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <polyline points="9 17 4 12 9 7"></polyline>
                                    <path d="M20 18v-2a4 4 0 0 0-4-4H4"></path>
                                </svg>
                                Reply
                            </button>
                        ` : ''}

                        ${isMyComment && !c.isDeleted ? `
                            <button type="button" class="comment__action" data-action="edit">
                                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                </svg>
                                Edit
                            </button>
                            <button type="button" class="comment__action" data-action="delete">
                                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <polyline points="3 6 5 6 21 6"></polyline>
                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"></path>
                                </svg>
                                Delete
                            </button>
                        ` : ''}
                    </div>

                    ${replyCount > 0 ? `
                        <div class="comment__replies">
                            ${replies.map((r) => renderComment(r, depth + 1)).join('')}
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }

    /* Bind like / reply / edit / delete handlers to each rendered comment. */
    function bindCommentActions() {
        $$('.comment').forEach((el) => {
            const id = el.dataset.commentId;

            el.querySelectorAll('[data-action]').forEach((btn) => {
                btn.addEventListener('click', () => {
                    const action = btn.dataset.action;

                    if (action === 'like') toggleLike(id, btn, el);
                    else if (action === 'reply') showReplyForm(id, el);
                    else if (action === 'edit') showEditForm(id, el);
                    else if (action === 'delete') deleteComment(id);
                });
            });
        });
    }

    /* Toggle the current user's like on a comment. */
    async function toggleLike(id, btn, el) {
        btn.disabled = true;

        try {
            const data = await api(`/api/projects/${state.projectId}/comments/${id}/like`, { method: 'POST' });

            btn.classList.toggle('liked', data.liked);

            const countEl = btn.querySelector('.comment__likes-count');
            if (countEl) countEl.textContent = data.likesCount;

            const svg = btn.querySelector('svg');
            if (svg) svg.setAttribute('fill', data.liked ? 'currentColor' : 'none');
        } catch (err) {
            if (err.status === 401) toast('Sign in to like comments', 'info');
        } finally {
            btn.disabled = false;
        }
    }

    /* Render an inline reply form beneath the target comment. */
    function showReplyForm(id, el) {
        // Remove any previously opened reply form in this comment.
        el.querySelectorAll('.comment__reply-form').forEach((f) => f.remove());

        const form = document.createElement('div');
        form.className = 'comment__reply-form';
        form.innerHTML = `
            <textarea placeholder="Write your reply…" maxlength="2000"></textarea>
            <div class="comment__reply-actions">
                <button type="button" class="btn-ghost" data-cancel>Cancel</button>
                <button type="button" class="btn-primary" data-send>Send</button>
            </div>
        `;

        el.querySelector('.comment__body').appendChild(form);

        const ta = form.querySelector('textarea');
        ta.focus();

        form.querySelector('[data-cancel]').addEventListener('click', () => form.remove());

        form.querySelector('[data-send]').addEventListener('click', async () => {
            const body = ta.value.trim();
            if (!body) return;

            const sendBtn = form.querySelector('[data-send]');
            sendBtn.disabled = true;
            sendBtn.textContent = '…';

            try {
                await api(`/api/projects/${state.projectId}/comments`, {
                    method: 'POST',
                    body: JSON.stringify({ body, parent: id }),
                });

                toast('Reply posted', 'success');
                await loadComments();
            } catch (err) {
                toast(err.message || 'Failed to send', 'error');

                sendBtn.disabled = false;
                sendBtn.textContent = 'Send';
            }
        });
    }

    /* Render an inline edit form in place of the comment's text. */
    function showEditForm(id, el) {
        const textEl = el.querySelector('.comment__text');
        const oldBody = textEl.textContent;

        const form = document.createElement('div');
        form.className = 'comment__reply-form';
        form.innerHTML = `
            <textarea maxlength="2000">${escapeHtml(oldBody)}</textarea>
            <div class="comment__reply-actions">
                <button type="button" class="btn-ghost" data-cancel>Cancel</button>
                <button type="button" class="btn-primary" data-save>Save</button>
            </div>
        `;

        textEl.style.display = 'none';
        textEl.parentNode.insertBefore(form, textEl.nextSibling);

        const ta = form.querySelector('textarea');
        ta.focus();
        ta.setSelectionRange(ta.value.length, ta.value.length);

        form.querySelector('[data-cancel]').addEventListener('click', () => {
            form.remove();
            textEl.style.display = '';
        });

        form.querySelector('[data-save]').addEventListener('click', async () => {
            const body = ta.value.trim();
            if (!body) return;

            const saveBtn = form.querySelector('[data-save]');
            saveBtn.disabled = true;

            try {
                await api(`/api/projects/${state.projectId}/comments/${id}`, {
                    method: 'PUT',
                    body: JSON.stringify({ body }),
                });

                toast('Comment updated', 'success');
                await loadComments();
            } catch (err) {
                toast(err.message || 'Failed to update', 'error');
                saveBtn.disabled = false;
            }
        });
    }

    /* Delete a comment after confirmation. */
    async function deleteComment(id) {
        const ok = await confirmDialog({
            title: 'Delete comment',
            message: 'Delete this comment?',
            confirmText: 'Delete',
            danger: true,
        });
        if (!ok) return;

        try {
            await api(`/api/projects/${state.projectId}/comments/${id}`, { method: 'DELETE' });

            toast('Comment deleted', 'success');
            await loadComments();
        } catch (err) {
            toast(err.message || 'Failed to delete', 'error');
        }
    }

    /* ---------- New Comment Form ---------- */
    const commentInput = $('#commentInput');
    const commentSubmit = $('#commentSubmit');

    commentInput?.addEventListener('input', () => {
        commentSubmit.disabled = !commentInput.value.trim();
    });

    // Ctrl/Cmd + Enter submits the comment.
    commentInput?.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();

            if (!commentSubmit.disabled) $('#commentForm').requestSubmit();
        }
    });

    $('#commentForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();

        const body = commentInput.value.trim();
        if (!body) return;

        commentSubmit.disabled = true;
        const original = commentSubmit.textContent;
        commentSubmit.textContent = 'Sending…';

        try {
            await api(`/api/projects/${state.projectId}/comments`, {
                method: 'POST',
                body: JSON.stringify({ body }),
            });

            commentInput.value = '';

            toast('Comment posted', 'success');
            await loadComments();
        } catch (err) {
            toast(err.message || 'Failed to send', 'error');
        } finally {
            commentSubmit.disabled = !commentInput.value.trim();
            commentSubmit.textContent = original;
        }
    });

    /* ============================================================
       Related Projects
       ============================================================ */
    async function loadRelated() {
        const p = state.project;
        const tagIds = (p.tags || []).map((t) => t._id);

        if (!tagIds.length) return;

        try {
            const data = await api(`/api/projects?tag=${tagIds[0]}&limit=5`);
            const items = (data.projects || []).filter((x) => x._id !== p._id).slice(0, 4);

            if (!items.length) return;

            $('#relatedCard').style.display = '';

            $('#sideRelated').innerHTML = items.map((x) => {
                const cover = x.images?.[0]?.url;
                const style = cover ? `background-image:url('${escapeHtml(cover)}')` : '';
                const initial = !cover ? escapeHtml((x.title || '?')[0]) : '';
                const stars = x.githubData?.stars;

                return `
                    <a href="/projects/${x.slug}" class="related-item">
                        <div class="related-item__thumb" style="${style}">${initial}</div>
                        <div class="related-item__body">
                            <div class="related-item__title">${escapeHtml(x.title)}</div>
                            <div class="related-item__meta">
                                ${stars != null ? `<span>⭐ ${formatNumber(stars)}</span>` : ''}
                                <span>⬇ ${formatNumber(x.downloads || 0)}</span>
                            </div>
                        </div>
                    </a>
                `;
            }).join('');
        } catch { /* Non-critical — silently ignore failures. */ }
    }

    /* ============================================================
       Share Modal
       ============================================================ */
    const shareModal = $('#shareModal');
    const shareBackdrop = $('#shareBackdrop');
    const shareInput = $('#shareUrlInput');

    $('#btnShare')?.addEventListener('click', () => {
        const url = location.href;
        shareInput.value = url;

        const text = encodeURIComponent(`${state.project.title} — ${state.project.shortDescription}`);
        const encodedUrl = encodeURIComponent(url);

        $('#shareTwitter').href = `https://twitter.com/intent/tweet?text=${text}&url=${encodedUrl}`;
        $('#shareTelegram').href = `https://t.me/share/url?url=${encodedUrl}&text=${text}`;
        $('#shareWhatsapp').href = `https://wa.me/?text=${text}%20${encodedUrl}`;

        shareModal.classList.add('open');
        shareBackdrop.classList.add('open');
        document.body.style.overflow = 'hidden';
    });

    function closeShareModal() {
        shareModal.classList.remove('open');
        shareBackdrop.classList.remove('open');
        document.body.style.overflow = '';
    }

    $('#shareClose')?.addEventListener('click', closeShareModal);
    shareBackdrop?.addEventListener('click', closeShareModal);

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && shareModal.classList.contains('open')) closeShareModal();
    });

    /* Copy the share URL to the clipboard, with a legacy fallback. */
    $('#copyShareUrl')?.addEventListener('click', async () => {
        try {
            await navigator.clipboard.writeText(shareInput.value);
            toast('Link copied', 'success');
        } catch {
            shareInput.select();
            document.execCommand('copy');
            toast('Link copied', 'success');
        }
    });

    /* ============================================================
       Initialization
       ============================================================ */
    loadProject();
});

/**
 * Copyright (c) 2026 Sobhan Rasoulzadeh Asl (Sobhan-SRZA / Mr. Sinre)
 *
 * Licensed under the BSD 3-Clause License.
 * See the LICENSE file in the project root for license information.
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */