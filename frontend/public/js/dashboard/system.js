/* ============================================================
   System Page
   ============================================================
   Renders live server diagnostics — health status, process and
   OS details, memory pressure, CPU load, and database metrics.
   Supports manual refresh and a five-second auto-refresh cycle.
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
    const $ = (selector) => document.querySelector(selector);

    /* --------------------------------------------------------
       View State
       --------------------------------------------------------
       `lastData` retains the most recent server payload for
       potential reuse; `interval` holds the auto-refresh timer.
       -------------------------------------------------------- */
    const state = {
        autoRefresh: true,
        interval: null,
        lastData: null,
    };

    /* --------------------------------------------------------
       Formatters
       -------------------------------------------------------- */

    /* Convert a byte count into a human-readable size string. */
    function bytes(b) {
        b = Number(b) || 0;

        if (b < 1024) return b + ' B';
        if (b < 1024 * 1024) return (b / 1024).toFixed(1) + ' KB';
        if (b < 1024 * 1024 * 1024) return (b / 1024 / 1024).toFixed(1) + ' MB';

        return (b / 1024 / 1024 / 1024).toFixed(2) + ' GB';
    }

    /* Compute the used-to-total percentage, clamped to 0–100. */
    function pct(used, total) {
        if (!total) return 0;

        return Math.min(100, Math.round((used / total) * 100));
    }

    /* Render an uptime in seconds as a human-readable duration. */
    function uptimeHuman(sec) {
        sec = Number(sec) || 0;

        const d = Math.floor(sec / 86400);
        const h = Math.floor((sec % 86400) / 3600);
        const m = Math.floor((sec % 3600) / 60);
        const s = Math.floor(sec % 60);

        if (d > 0) return `${d} day${d === 1 ? '' : 's'}, ${h} hour${h === 1 ? '' : 's'}`;
        if (h > 0) return `${h} hour${h === 1 ? '' : 's'}, ${m} minute${m === 1 ? '' : 's'}`;
        if (m > 0) return `${m} minute${m === 1 ? '' : 's'}, ${s} second${s === 1 ? '' : 's'}`;

        return `${s} second${s === 1 ? '' : 's'}`;
    }

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

    /* Render a label/value row for a system info list. */
    function infoRow(label, value, opts = {}) {
        const cls = opts.cls ? `sys-info-row__value--${opts.cls}` : '';
        const mono = opts.mono ? 'sys-info-row__value--mono' : '';

        return `
            <div class="sys-info-row">
                <span class="sys-info-row__label">${escapeHtml(label)}</span>
                <span class="sys-info-row__value ${cls} ${mono}">${escapeHtml(value)}</span>
            </div>
        `;
    }

    /* --------------------------------------------------------
       Memory Bar
       --------------------------------------------------------
       Renders a labelled progress bar whose colour level is
       derived from the utilisation percentage.
       -------------------------------------------------------- */
    function memBar(label, used, total, metaRight = '') {
        const p = pct(used, total);
        const level = p > 85 ? 'danger' : p > 65 ? 'warn' : 'normal';

        return `
            <div class="sys-mem-bar">
                <div class="sys-mem-bar__head">
                    <span class="sys-mem-bar__label">${escapeHtml(label)}</span>
                    <span class="sys-mem-bar__value">${bytes(used)} / ${bytes(total)} (${p}%)</span>
                </div>
                <div class="sys-mem-bar__track">
                    <div class="sys-mem-bar__fill" data-level="${level}" style="width:${p}%"></div>
                </div>
                ${metaRight ? `<div class="sys-mem-meta"><span>${escapeHtml(metaRight)}</span></div>` : ''}
            </div>
        `;
    }

    /* --------------------------------------------------------
       Renderers
       -------------------------------------------------------- */

    /**
     * Render the top-level health banner. The overall status is
     * derived from database connectivity and memory pressure.
     */
    function renderHealth(data) {
        const banner = $('#healthBanner');
        const icon = $('#healthIcon');
        const title = $('#healthTitle');
        const sub = $('#healthSub');
        const lastUpdate = $('#lastUpdate');

        const dbOk = !!data.database?.connected;
        const memHeapPct = pct(data.memory.heapUsed, data.memory.heapTotal);
        const memSysPct = pct(data.memory.systemUsed, data.memory.systemTotal);

        let status = 'ok';
        let statusLabel = 'Healthy';
        let statusIcon = '✓';
        let detail = 'All services are operational.';

        if (!dbOk) {
            status = 'danger';
            statusLabel = 'Error';
            statusIcon = '✕';
            detail = 'The database connection is down.';
        } else if (memHeapPct > 85 || memSysPct > 90) {
            status = 'warn';
            statusLabel = 'Warning';
            statusIcon = '!';
            detail = 'Memory utilisation is high.';
        }

        banner.dataset.status = status;
        icon.textContent = statusIcon;
        title.textContent = `Server status: ${statusLabel}`;
        sub.textContent = detail;
        lastUpdate.textContent = new Date().toLocaleTimeString('en-US');
    }

    /* Render the process and runtime details. */
    function renderProcess(p) {
        const el = $('#processList');

        el.innerHTML = [
            infoRow('Node.js', p.nodeVersion, { mono: true }),
            infoRow('PID', p.pid, { mono: true }),
            infoRow('Uptime', uptimeHuman(p.uptime)),
            infoRow('Environment', p.env),
            infoRow('Platform', `${p.platform} / ${p.arch}`, { mono: true }),
            infoRow('V8', p.versions.v8, { mono: true }),
        ].join('');
    }

    /* Render the operating system details. */
    function renderOS(o) {
        const el = $('#osList');

        el.innerHTML = [
            infoRow('Hostname', o.hostname, { mono: true }),
            infoRow('Platform', o.platform, { mono: true }),
            infoRow('Type', o.type, { mono: true }),
            infoRow('Release', o.release, { mono: true }),
        ].join('');
    }

    /* Render the heap and system memory bars. */
    function renderMemory(m) {
        const el = $('#memoryPanel');

        el.innerHTML = `
            ${memBar('Heap (Node.js)', m.heapUsed, m.heapTotal)}
            ${memBar('System (OS)', m.systemUsed, m.systemTotal)}
            <div class="sys-mem-meta">
                <span>RSS: <strong>${bytes(m.rss)}</strong></span>
                <span>External: <strong>${bytes(m.external)}</strong></span>
                <span>Free: <strong>${bytes(m.systemFree)}</strong></span>
            </div>
        `;
    }

    /* Render the CPU details and load averages. */
    function renderCPU(c) {
        const el = $('#cpuList');

        el.innerHTML = [
            infoRow('Cores', c.cores, { mono: true }),
            infoRow('Model', c.model, { mono: true }),
            infoRow('Speed', `${c.speed} MHz`),
            infoRow('Load (1m)', (c.loadAvg[0] || 0).toFixed(2), { mono: true }),
            infoRow('Load (5m)', (c.loadAvg[1] || 0).toFixed(2), { mono: true }),
            infoRow('Load (15m)', (c.loadAvg[2] || 0).toFixed(2), { mono: true }),
        ].join('');
    }

    /**
     * Render the database panel. When the connection is down, only
     * the failure state and error message are shown.
     */
    function renderDB(db) {
        const badge = $('#dbBadge');
        const el = $('#dbPanel');

        if (!db?.connected) {
            badge.textContent = 'Disconnected';
            badge.className = 'sys-card__badge sys-card__badge--danger';

            el.innerHTML = `
                <div class="sys-info-list">
                    ${infoRow('Status', 'Disconnected', { cls: 'danger' })}
                    ${db?.error ? infoRow('Error', db.error, { mono: true }) : ''}
                </div>
            `;

            return;
        }

        badge.textContent = 'Connected';
        badge.className = 'sys-card__badge sys-card__badge--ok';

        el.innerHTML = `
            <div class="sys-info-list">
                ${infoRow('Status', 'Connected ✓', { cls: 'ok' })}
                ${infoRow('Database name', db.name, { mono: true })}
                ${infoRow('Host', `${db.host}:${db.port}`, { mono: true })}
                ${infoRow('Collections', db.collections)}
                ${infoRow('Documents', db.documents.toLocaleString('en-US'))}
                ${infoRow('Indexes', db.indexes)}
                ${infoRow('Data size', bytes(db.dataSize))}
                ${infoRow('Storage size', bytes(db.storageSize))}
                ${infoRow('Average document size', bytes(db.avgObjSize))}
            </div>
        `;
    }

    /* --------------------------------------------------------
       Fetch and Update
       --------------------------------------------------------
       Retrieves the latest system statistics and dispatches each
       section to its renderer. Failures update the health banner
       to reflect the error state.
       -------------------------------------------------------- */
    async function load() {
        try {
            const res = await fetch('/api/system/stats', { credentials: 'include' });
            if (!res.ok) throw new Error('HTTP ' + res.status);

            const data = await res.json();
            state.lastData = data;

            renderHealth(data);
            renderProcess(data.process);
            renderOS(data.os);
            renderMemory(data.memory);
            renderCPU(data.cpu);
            renderDB(data.database);
        } catch (err) {
            console.error('[system] load failed:', err);

            const banner = $('#healthBanner');
            banner.dataset.status = 'danger';
            $('#healthIcon').textContent = '✕';
            $('#healthTitle').textContent = 'Failed to retrieve data';
            $('#healthSub').textContent = err.message || 'Could not establish a connection.';
        }
    }

    /* --------------------------------------------------------
       Auto-Refresh
       -------------------------------------------------------- */

    /* Start the periodic refresh cycle, replacing any existing timer. */
    function startAuto() {
        stopAuto();
        state.interval = setInterval(load, 5000);
    }

    /* Stop the periodic refresh cycle, if one is active. */
    function stopAuto() {
        if (state.interval) {
            clearInterval(state.interval);
            state.interval = null;
        }
    }

    /* --------------------------------------------------------
       Event Bindings
       -------------------------------------------------------- */
    $('#autoRefreshToggle').addEventListener('change', (e) => {
        state.autoRefresh = e.target.checked;

        if (state.autoRefresh) startAuto();
        else stopAuto();
    });

    $('#refreshBtn').addEventListener('click', load);

    /* --------------------------------------------------------
       Initialization
       -------------------------------------------------------- */
    load();
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