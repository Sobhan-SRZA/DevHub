/* ============================================================
   Public projects list
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
    const $ = (s, r = document) => r.querySelector(s);

    const state = {
        search: '',
        sort: 'recent',
        page: 1,
        limit: 20,
        totalPages: 1,
        total: 0,
    };

    const grid = $('#projectsGrid');
    const meta = $('#projectsMeta');
    const pagination = $('#pagination');
    const searchEl = $('#searchProjects');
    const sortEl = $('#sortProjects');

    let searchTimer = null;

    async function api(path) {
        const res = await fetch(path, { credentials: 'include' });
        let data = null;
        try { data = await res.json(); } catch { /* ignore */ }
        if (!res.ok) throw new Error(data?.message || 'خطا');
        return data;
    }

    function escapeHtml(s) {
        if (s == null) return '';
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function formatNumber(n) {
        n = Number(n) || 0;
        if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
        if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
        return String(n);
    }

    function hexA(hex, a) {
        if (!hex) return `rgba(96,165,250,${a})`;
        const h = String(hex).replace('#', '');
        if (h.length < 6) return `rgba(96,165,250,${a})`;
        const r = parseInt(h.slice(0, 2), 16);
        const g = parseInt(h.slice(2, 4), 16);
        const b = parseInt(h.slice(4, 6), 16);
        return `rgba(${r},${g},${b},${a})`;
    }

    function renderCard(p) {
        const cover = p.images?.[0]?.url;
        const coverStyle = cover
            ? `background-image:url('${escapeHtml(cover)}')`
            : '';
        const owner = p.owner || {};
        const ownerName = owner.name || owner.username || '—';
        const tags = (p.tags || []).slice(0, 3);
        const moreTags = Math.max(0, (p.tags || []).length - 3);
        const stats = [];
        if (p.githubData?.stars) stats.push(`<span class="pc__stat">⭐ ${formatNumber(p.githubData.stars)}</span>`);
        if (p.downloads) stats.push(`<span class="pc__stat">⬇ ${formatNumber(p.downloads)}</span>`);
        if (p.rating) stats.push(`<span class="pc__stat">★ ${Number(p.rating).toFixed(1)}</span>`);

        return `
        <article class="pc" data-href="/projects/${escapeHtml(p.slug)}" role="link" tabindex="0">
            <div class="pc__cover" style="${coverStyle}">
                ${!cover ? `<span class="pc__cover-initial">${escapeHtml((p.title || '?')[0])}</span>` : ''}
            </div>
            <div class="pc__body">
                <h3 class="pc__title">${escapeHtml(p.title)}</h3>
                <p class="pc__desc">${escapeHtml(p.shortDescription || '')}</p>
                ${tags.length ? `<div class="pc__tags">${tags.map((t) =>
                    `<span class="pc__tag" style="background:${hexA(t.color, 0.1)};color:${t.color || 'var(--accent)'};border-color:${hexA(t.color, 0.25)}">${escapeHtml(t.name)}</span>`
                ).join('')}${moreTags ? `<span class="pc__tag pc__tag--more">+${moreTags}</span>` : ''}</div>` : ''}
                <div class="pc__footer">
                    <div class="pc__owner">
                        <span class="pc__owner-name">${escapeHtml(ownerName)}</span>
                    </div>
                    ${stats.length ? `<div class="pc__stats">${stats.join('')}</div>` : ''}
                </div>
            </div>
        </article>`;
    }

    function bindCards() {
        grid.querySelectorAll('.pc[data-href]').forEach((card) => {
            const go = () => { location.href = card.dataset.href; };
            card.addEventListener('click', (e) => {
                if (e.target.closest('a, button')) return;
                go();
            });
            card.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    go();
                }
            });
        });
    }

    function renderPagination() {
        if (!pagination) return;
        if (state.totalPages <= 1) {
            pagination.innerHTML = '';
            return;
        }
        const pages = [];
        const maxBtn = 7;
        let start = Math.max(1, state.page - 3);
        let end = Math.min(state.totalPages, start + maxBtn - 1);
        start = Math.max(1, end - maxBtn + 1);

        if (state.page > 1) {
            pages.push(`<button type="button" data-page="${state.page - 1}">قبلی</button>`);
        }
        for (let i = start; i <= end; i++) {
            pages.push(`<button type="button" data-page="${i}" class="${i === state.page ? 'active' : ''}">${i}</button>`);
        }
        if (state.page < state.totalPages) {
            pages.push(`<button type="button" data-page="${state.page + 1}">بعدی</button>`);
        }
        pagination.innerHTML = pages.join('');
        pagination.querySelectorAll('button').forEach((btn) => {
            btn.addEventListener('click', () => {
                state.page = Number(btn.dataset.page);
                load();
                window.scrollTo({ top: 0, behavior: 'smooth' });
            });
        });
    }

    async function load() {
        grid.innerHTML = `<div class="home-loading" style="grid-column:1/-1"><div class="home-loading__spinner"></div></div>`;
        try {
            const params = new URLSearchParams({
                sort: state.sort,
                page: String(state.page),
                limit: String(state.limit),
            });
            if (state.search) params.set('search', state.search);

            const data = await api(`/api/projects?${params}`);
            const projects = data.projects || [];
            state.totalPages = data.pagination?.pages || 1;
            state.total = data.pagination?.total || projects.length;

            if (meta) {
                meta.textContent = state.total
                    ? `${state.total.toLocaleString('fa-IR')} پروژه`
                    : 'پروژه‌ای یافت نشد';
            }

            if (!projects.length) {
                grid.innerHTML = `<div class="list-empty">پروژه‌ای با این فیلتر پیدا نشد</div>`;
            } else {
                grid.innerHTML = projects.map(renderCard).join('');
                bindCards();
            }
            renderPagination();
        } catch (err) {
            grid.innerHTML = `<div class="list-empty">خطا: ${escapeHtml(err.message || '')}</div>`;
        }
    }

    searchEl?.addEventListener('input', () => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => {
            state.search = searchEl.value.trim();
            state.page = 1;
            load();
        }, 320);
    });

    sortEl?.addEventListener('change', () => {
        state.sort = sortEl.value;
        state.page = 1;
        load();
    });

    load();
});
