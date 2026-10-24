/* ============================================================
   Logs Page
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
    const $ = (s) => document.querySelector(s);
    const $$ = (s) => Array.from(document.querySelectorAll(s));

    const state = {
        level: 'all',
        search: '',
        file: 'live',
        autoRefresh: true,
        follow: true,
        interval: null,
        lastCount: 0,
        filesLoaded: false,
    };

    /* ---------------- formatters ---------------- */
    function escapeHtml(s) {
        if (s == null) return '';
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function highlight(message, search) {
        const safe = escapeHtml(message);
        if (!search) return safe;
        const re = new RegExp(`(${search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
        return safe.replace(re, '<mark>$1</mark>');
    }

    function formatTime(iso) {
        if (!iso) return '';
        try {
            return new Date(iso).toLocaleTimeString('fa-IR');
        } catch {
            return iso;
        }
    }

    /* ---------------- render ---------------- */
    function renderLogs(entries, stats, source) {
        const terminal = $('#logsTerminal');

        if (!entries.length) {
            terminal.innerHTML = `<div class="logs-empty">هیچ لاگی با این فیلترها یافت نشد</div>`;
        } else {
            terminal.innerHTML = entries.map((e) => `
                <div class="log-line" data-level="${escapeHtml(e.level)}">
                    <span class="log-line__time">${escapeHtml(formatTime(e.timestamp))}</span>
                    <span class="log-line__level">${escapeHtml(e.level)}</span>
                    <span class="log-line__message">${highlight(e.message, state.search)}</span>
                </div>
            `).join('');
        }

        // update stats
        if (stats) {
            $('#statTotal').textContent = Number(stats.total || 0).toLocaleString('fa-IR');
            $('#statInfo').textContent = Number(stats.info || 0).toLocaleString('fa-IR');
            $('#statWarn').textContent = Number(stats.warn || 0).toLocaleString('fa-IR');
            $('#statError').textContent = Number(stats.error || 0).toLocaleString('fa-IR');
            $('#statDebug').textContent = Number(stats.debug || 0).toLocaleString('fa-IR');
        }

        // footer
        $('#logsCount').textContent = `${Number(entries.length).toLocaleString('fa-IR')} لاگ`;
        $('#logsSource').textContent = source === 'live' ? 'منبع: حافظه' : `منبع: ${source}`;
        $('#logsLastUpdate').textContent = `آخرین به‌روزرسانی: ${new Date().toLocaleTimeString('fa-IR')}`;

        // auto scroll
        if (state.follow) {
            terminal.scrollTop = terminal.scrollHeight;
        }
    }

    /* ---------------- load files ---------------- */
    async function loadFiles() {
        try {
            const res = await fetch('/api/system/logs?limit=1', { credentials: 'include' });
            if (!res.ok) return;
            const data = await res.json();
            if (!data.files || !data.files.length) return;

            const select = $('#fileFilter');
            const current = select.value;

            select.innerHTML = `
                <option value="live">زنده (حافظه)</option>
                ${data.files.map((f) => `<option value="${escapeHtml(f)}">${escapeHtml(f)}</option>`).join('')}
            `;
            select.value = current || 'live';
            state.filesLoaded = true;
        } catch { }
    }

    /* ---------------- fetch ---------------- */
    async function load() {
        try {
            const params = new URLSearchParams({
                limit: '300',
                level: state.level,
                search: state.search,
                file: state.file,
            });

            const res = await fetch(`/api/system/logs?${params}`, { credentials: 'include' });
            if (!res.ok) throw new Error('HTTP ' + res.status);

            const data = await res.json();
            renderLogs(data.entries || [], data.stats, data.source);
            state.lastCount = (data.entries || []).length;

            if (!state.filesLoaded) loadFiles();
        } catch (err) {
            console.error('[logs] load failed:', err);
            $('#logsTerminal').innerHTML = `<div class="logs-empty">خطا در دریافت لاگ‌ها: ${escapeHtml(err.message)}</div>`;
        }
    }

    /* ---------------- auto refresh ---------------- */
    function startAuto() {
        stopAuto();
        state.interval = setInterval(load, 3000);
    }

    function stopAuto() {
        if (state.interval) {
            clearInterval(state.interval);
            state.interval = null;
        }
    }

    /* ---------------- debounce ---------------- */
    function debounce(fn, wait = 300) {
        let t;
        return (...args) => {
            clearTimeout(t);
            t = setTimeout(() => fn(...args), wait);
        };
    }

    /* ---------------- events ---------------- */
    // level stats cards
    $$('.log-stat-card').forEach((card) => {
        card.addEventListener('click', () => {
            const level = card.dataset.level;
            state.level = level;
            $('#levelFilter').value = level;
            $$('.log-stat-card').forEach((c) => c.classList.toggle('active', c === card));
            load();
        });
    });

    // level dropdown
    $('#levelFilter').addEventListener('change', (e) => {
        state.level = e.target.value;
        $$('.log-stat-card').forEach((c) => c.classList.toggle('active', c.dataset.level === state.level));
        load();
    });

    // file dropdown
    $('#fileFilter').addEventListener('change', (e) => {
        state.file = e.target.value;
        load();
    });

    // search (debounced)
    const doSearch = debounce(() => load(), 300);
    $('#searchInput').addEventListener('input', (e) => {
        state.search = e.target.value.trim();
        doSearch();
    });

    // auto refresh
    $('#autoRefreshToggle').addEventListener('change', (e) => {
        state.autoRefresh = e.target.checked;
        if (state.autoRefresh) startAuto();
        else stopAuto();
    });

    // follow
    $('#followToggle').addEventListener('change', (e) => {
        state.follow = e.target.checked;
        if (state.follow) {
            const t = $('#logsTerminal');
            t.scrollTop = t.scrollHeight;
        }
    });

    // refresh
    $('#refreshBtn').addEventListener('click', () => {
        loadFiles();
        load();
    });

    // download
    $('#downloadBtn').addEventListener('click', () => {
        if (state.file === 'live') {
            // دانلود فایل امروز
            const today = new Date().toISOString().split('T')[0];
            window.location.href = `/api/system/logs/download?file=app-${today}.log`;
        } else {
            window.location.href = `/api/system/logs/download?file=${encodeURIComponent(state.file)}`;
        }
    });

    // clear
    $('#clearBtn').addEventListener('click', async () => {
        const ok = confirmDialog
            ? await confirmDialog({
                title: 'پاک‌سازی لاگ‌ها',
                message: 'لاگ‌های موجود در حافظه پاک شوند؟ (فایل‌ها دست نمی‌خورند)',
                confirmText: 'بله، پاک کن',
                danger: true,
            })
            : confirm('پاک شوند؟');

        if (!ok) return;

        try {
            await fetch('/api/system/logs/clear', {
                method: 'POST',
                credentials: 'include',
            });
            if (window.toast) toast('لاگ‌ها پاک شدند', 'success');
            load();
        } catch (err) {
            if (window.toast) toast('خطا در پاک‌سازی', 'error');
        }
    });

    /* ---------------- init ---------------- */
    $$('.log-stat-card').forEach((c) => {
        if (c.dataset.level === state.level) c.classList.add('active');
    });

    loadFiles().then(load);
    startAuto();
});

/**
 * Copyright (c) 2026 Sobhan Rasoulzadeh Asl (Sobhan-SRZA / Mr. Sinre)
 *
 * Licensed under the BSD 3-Clause License.
 * See the LICENSE file in the project root for license information.
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */