/* ============================================================
   System Page
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
    const $ = (s) => document.querySelector(s);

    const state = {
        autoRefresh: true,
        interval: null,
        lastData: null,
    };

    /* ---------------- formatters ---------------- */
    function bytes(b) {
        b = Number(b) || 0;
        if (b < 1024) return b + ' B';
        if (b < 1024 * 1024) return (b / 1024).toFixed(1) + ' KB';
        if (b < 1024 * 1024 * 1024) return (b / 1024 / 1024).toFixed(1) + ' MB';
        return (b / 1024 / 1024 / 1024).toFixed(2) + ' GB';
    }

    function pct(used, total) {
        if (!total) return 0;
        return Math.min(100, Math.round((used / total) * 100));
    }

    function uptimeHuman(sec) {
        sec = Number(sec) || 0;
        const d = Math.floor(sec / 86400);
        const h = Math.floor((sec % 86400) / 3600);
        const m = Math.floor((sec % 3600) / 60);
        const s = Math.floor(sec % 60);
        if (d > 0) return `${d} روز، ${h} ساعت`;
        if (h > 0) return `${h} ساعت، ${m} دقیقه`;
        if (m > 0) return `${m} دقیقه، ${s} ثانیه`;
        return `${s} ثانیه`;
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

    /* ---------------- memory bar ---------------- */
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

    /* ---------------- renderers ---------------- */
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
        let statusLabel = 'سالم';
        let statusIcon = '✓';
        let detail = 'همه سرویس‌ها فعال هستند';

        if (!dbOk) {
            status = 'danger';
            statusLabel = 'خطا';
            statusIcon = '✕';
            detail = 'اتصال به دیتابیس قطع است';
        } else if (memHeapPct > 85 || memSysPct > 90) {
            status = 'warn';
            statusLabel = 'هشدار';
            statusIcon = '!';
            detail = 'مصرف حافظه بالا است';
        }

        banner.dataset.status = status;
        icon.textContent = statusIcon;
        title.textContent = `وضعیت سرور: ${statusLabel}`;
        sub.textContent = detail;
        lastUpdate.textContent = new Date().toLocaleTimeString('fa-IR');
    }

    function renderProcess(p) {
        const el = $('#processList');
        el.innerHTML = [
            infoRow('Node.js', p.nodeVersion, { mono: true }),
            infoRow('PID', p.pid, { mono: true }),
            infoRow('Uptime', uptimeHuman(p.uptime)),
            infoRow('محیط', p.env),
            infoRow('پلتفرم', `${p.platform} / ${p.arch}`, { mono: true }),
            infoRow('V8', p.versions.v8, { mono: true }),
        ].join('');
    }

    function renderOS(o) {
        const el = $('#osList');
        el.innerHTML = [
            infoRow('Hostname', o.hostname, { mono: true }),
            infoRow('Platform', o.platform, { mono: true }),
            infoRow('Type', o.type, { mono: true }),
            infoRow('Release', o.release, { mono: true }),
        ].join('');
    }

    function renderMemory(m) {
        const el = $('#memoryPanel');
        const heapPct = pct(m.heapUsed, m.heapTotal);
        const sysPct = pct(m.systemUsed, m.systemTotal);

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

    function renderDB(db) {
        const badge = $('#dbBadge');
        const el = $('#dbPanel');

        if (!db?.connected) {
            badge.textContent = 'قطع';
            badge.className = 'sys-card__badge sys-card__badge--danger';
            el.innerHTML = `
                <div class="sys-info-list">
                    ${infoRow('وضعیت', 'قطع', { cls: 'danger' })}
                    ${db?.error ? infoRow('خطا', db.error, { mono: true }) : ''}
                </div>
            `;
            return;
        }

        badge.textContent = 'متصل';
        badge.className = 'sys-card__badge sys-card__badge--ok';

        el.innerHTML = `
            <div class="sys-info-list">
                ${infoRow('وضعیت', 'متصل ✓', { cls: 'ok' })}
                ${infoRow('نام دیتابیس', db.name, { mono: true })}
                ${infoRow('Host', `${db.host}:${db.port}`, { mono: true })}
                ${infoRow('تعداد Collection', db.collections)}
                ${infoRow('تعداد Documents', db.documents.toLocaleString('fa-IR'))}
                ${infoRow('تعداد Index', db.indexes)}
                ${infoRow('حجم داده', bytes(db.dataSize))}
                ${infoRow('حجم روی دیسک', bytes(db.storageSize))}
                ${infoRow('میانگین سایز سند', bytes(db.avgObjSize))}
            </div>
        `;
    }

    /* ---------------- fetch + update ---------------- */
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
            $('#healthTitle').textContent = 'خطا در دریافت داده';
            $('#healthSub').textContent = err.message || 'اتصال برقرار نشد';
        }
    }

    /* ---------------- auto refresh ---------------- */
    function startAuto() {
        stopAuto();
        state.interval = setInterval(load, 5000);
    }

    function stopAuto() {
        if (state.interval) {
            clearInterval(state.interval);
            state.interval = null;
        }
    }

    /* ---------------- events ---------------- */
    $('#autoRefreshToggle').addEventListener('change', (e) => {
        state.autoRefresh = e.target.checked;
        if (state.autoRefresh) startAuto();
        else stopAuto();
    });

    $('#refreshBtn').addEventListener('click', load);

    /* ---------------- init ---------------- */
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