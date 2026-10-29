/* ============================================================
   Dashboard — Tickets List
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
    const $ = (s) => document.querySelector(s);

    const state = {
        page: 1,
        limit: 30,
        search: '',
        status: '',
        category: ''
    };

    const list = $('#ticketsList');
    const pagination = $('#ticketsPagination');
    const countEl = $('#ticketsCount');
    const searchEl = $('#ticketSearch');
    const statusEl = $('#ticketStatus');
    const categoryEl = $('#ticketCategory');

    let searchTimer;

    async function api(path) {
        const res = await fetch(path, { credentials: 'include' });
        const data = await res.json().catch(() => ({}));

        if (!res.ok) throw new Error(data.message || 'Failed to load.');

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

    function formatDate(d) {
        if (!d) return '—';
        try {
            return new Intl.DateTimeFormat('en-US', {
                dateStyle: 'medium',
                timeStyle: 'short'
            }).format(new Date(d));
        } catch { return '—'; }
    }

    function renderRow(t) {
        return `
            <a class="ticket-row" href="/dashboard/tickets/${escapeHtml(t.id)}">
                <span class="ticket-row__number">${escapeHtml(t.ticketNumber)}</span>

                <div class="ticket-row__body">
                    <span class="ticket-row__subject">${escapeHtml(t.subject)}</span>
                    <span class="ticket-row__meta">
                        <span>${escapeHtml(t.name)}</span>
                        <span>·</span>
                        <span>${escapeHtml(t.email)}</span>
                        <span>·</span>
                        <span>${formatDate(t.createdAt)}</span>
                    </span>
                </div>

                <span class="ticket-row__category">${escapeHtml(t.category)}</span>

                <span class="ticket-row__status ticket-row__status--${escapeHtml(t.status)}">
                    ${escapeHtml(t.status)}
                </span>

                <span class="ticket-row__priority ticket-row__priority--${escapeHtml(t.priority)}"
                      title="Priority: ${escapeHtml(t.priority)}"></span>
            </a>
        `;
    }

    function renderPagination(p) {
        if (!p || p.pages <= 1) {
            pagination.innerHTML = '';
            return;
        }

        const buttons = [];
        for (let i = 1; i <= p.pages; i++) {
            buttons.push(
                `<button class="page-btn ${i === p.page ? 'active' : ''}" data-page="${i}">${i}</button>`
            );
        }

        pagination.innerHTML = buttons.join('');

        pagination.querySelectorAll('button').forEach((b) => {
            b.addEventListener('click', () => {
                state.page = Number(b.dataset.page);
                load();
            });
        });
    }

    async function load() {
        list.innerHTML = `<div class="dash-loading">Loading…</div>`;

        try {
            const params = new URLSearchParams({
                page: state.page,
                limit: state.limit
            });

            if (state.search) params.set('search', state.search);
            if (state.status) params.set('status', state.status);
            if (state.category) params.set('category', state.category);

            const data = await api(`/api/tickets?${params}`);

            if (!data.tickets.length) {
                list.innerHTML = `<div class="dash-empty">
                    <div class="dash-empty__icon">🎫</div>
                    <h3 class="dash-empty__title">No tickets found</h3>
                    <p class="dash-empty__sub">Adjust the filters, or wait for new submissions.</p>
                </div>`;

                countEl.textContent = 'No tickets';
                pagination.innerHTML = '';
                return;
            }

            countEl.textContent = `${data.pagination.total} ticket${data.pagination.total === 1 ? '' : 's'}`;

            list.innerHTML = data.tickets.map(renderRow).join('');
            renderPagination(data.pagination);
        } catch (err) {
            list.innerHTML = `<div class="dash-empty">
                <div class="dash-empty__icon">⚠️</div>
                <h3 class="dash-empty__title">Failed to load</h3>
                <p class="dash-empty__sub">${escapeHtml(err.message)}</p>
            </div>`;
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

    statusEl?.addEventListener('change', () => {
        state.status = statusEl.value;
        state.page = 1;
        load();
    });

    categoryEl?.addEventListener('change', () => {
        state.category = categoryEl.value;
        state.page = 1;
        load();
    });

    load();
});

/**
 * Copyright (c) 2026 Sobhan Rasoulzadeh Asl (Sobhan-SRZA / Mr. Sinre)
 *
 * Licensed under the BSD 3-Clause License.
 * See the LICENSE file in the project root for license information.
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */