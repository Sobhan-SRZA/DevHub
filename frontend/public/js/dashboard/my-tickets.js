/* ============================================================
   Dashboard — My Tickets
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
    const list = document.getElementById('myTicketsList');
    const countEl = document.getElementById('ticketsCount');

    function escapeHtml(s) {
        if (s == null) return '';
        return String(s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function formatDate(d) {
        if (!d) return '—';
        try {
            return new Intl.DateTimeFormat('en-US', {
                dateStyle: 'medium'
            }).format(new Date(d));
        } catch { return '—'; }
    }

    function render(tickets) {
        if (!tickets.length) {
            list.innerHTML = `<div class="dash-empty">
                <div class="dash-empty__icon">🎫</div>
                <h3 class="dash-empty__title">No tickets yet</h3>
                <p class="dash-empty__sub">When you contact us through the contact form, your tickets appear here.</p>
                <a href="/contact" class="btn-primary">Send us a message</a>
            </div>`;
            countEl.textContent = 'No tickets';
            return;
        }

        countEl.textContent = `${tickets.length} ticket${tickets.length === 1 ? '' : 's'}`;

        list.innerHTML = tickets.map((t) => `
            <a class="ticket-row" href="${escapeHtml(t.trackUrl)}">
                <span class="ticket-row__number">${escapeHtml(t.ticketNumber)}</span>
                <div class="ticket-row__body">
                    <span class="ticket-row__subject">${escapeHtml(t.subject)}</span>
                    <span class="ticket-row__meta">
                        <span>${formatDate(t.createdAt)}</span>
                        <span>·</span>
                        <span>${escapeHtml(t.category)}</span>
                        ${t.lastReplyBy ? `<span>·</span><span>Last reply: ${escapeHtml(t.lastReplyBy)}</span>` : ''}
                    </span>
                </div>
                <span class="ticket-row__category">${escapeHtml(t.category)}</span>
                <span class="ticket-row__status ticket-row__status--${escapeHtml(t.status)}">
                    ${escapeHtml(t.status)}
                </span>
                <span class="ticket-row__priority ticket-row__priority--${escapeHtml(t.priority)}"></span>
            </a>
        `).join('');
    }

    async function load() {
        try {
            const res = await fetch('/api/tickets/my', { credentials: 'include' });
            const data = await res.json().catch(() => ({}));

            if (!res.ok) throw new Error(data.message || 'Failed to load tickets.');

            render(data.tickets || []);
        } catch (err) {
            list.innerHTML = `<div class="dash-empty">
                <div class="dash-empty__icon">⚠️</div>
                <h3 class="dash-empty__title">Failed to load</h3>
                <p class="dash-empty__sub">${escapeHtml(err.message)}</p>
            </div>`;
        }
    }

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