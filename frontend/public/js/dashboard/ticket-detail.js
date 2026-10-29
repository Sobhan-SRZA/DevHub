/* ============================================================
   Dashboard — Ticket Detail
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
    const $ = (s) => document.querySelector(s);
    const pageEl = $('.dash-main');
    const ticketId = pageEl?.dataset.ticketId;

    if (!ticketId) return;

    const container = $('#ticketDetail');
    const subjectEl = $('#ticketSubject');

    let ticket = null;

    async function api(path, opts = {}) {
        const res = await fetch(path, {
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            ...opts
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
            const err = new Error(data.message || 'Request failed.');
            err.payload = data;
            err.status = res.status;
            throw err;
        }

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

    function relativeTime(d) {
        if (!d) return '';
        const diff = Date.now() - new Date(d).getTime();
        const m = Math.floor(diff / 60000);

        if (m < 1) return 'just now';
        if (m < 60) return `${m}m ago`;

        const h = Math.floor(m / 60);
        if (h < 24) return `${h}h ago`;

        const days = Math.floor(h / 24);
        if (days < 30) return `${days}d ago`;

        return formatDate(d);
    }

    function renderMessage(m) {
        return `
            <article class="ticket-message ${m.author === 'staff' ? 'ticket-message--staff' : ''}">
                <div class="ticket-message__head">
                    <span class="ticket-message__author">${escapeHtml(m.authorName)}</span>
                    ${m.author === 'staff' ? '<span class="ticket-message__badge">Staff</span>' : ''}
                    <span class="ticket-message__date" title="${formatDate(m.createdAt)}">
                        ${relativeTime(m.createdAt)}
                    </span>
                </div>
                <div class="ticket-message__body">${escapeHtml(m.body)}</div>
            </article>
        `;
    }

    function render() {
        subjectEl.textContent = ticket.subject;

        container.innerHTML = `
            <section class="ticket-detail__header">
                <div class="ticket-detail__title-row">
                    <div>
                        <h1 class="ticket-detail__title">${escapeHtml(ticket.subject)}</h1>
                        <span class="ticket-detail__number">${escapeHtml(ticket.ticketNumber)}</span>
                    </div>

                    <div class="ticket-detail__actions">
                        <select class="dash-select" id="tStatus">
                            <option value="open"     ${ticket.status === 'open' ? 'selected' : ''}>Open</option>
                            <option value="pending"  ${ticket.status === 'pending' ? 'selected' : ''}>Pending</option>
                            <option value="resolved" ${ticket.status === 'resolved' ? 'selected' : ''}>Resolved</option>
                            <option value="closed"   ${ticket.status === 'closed' ? 'selected' : ''}>Closed</option>
                        </select>

                        <select class="dash-select" id="tPriority">
                            <option value="low"    ${ticket.priority === 'low' ? 'selected' : ''}>Low</option>
                            <option value="normal" ${ticket.priority === 'normal' ? 'selected' : ''}>Normal</option>
                            <option value="high"   ${ticket.priority === 'high' ? 'selected' : ''}>High</option>
                            <option value="urgent" ${ticket.priority === 'urgent' ? 'selected' : ''}>Urgent</option>
                        </select>
                    </div>
                </div>

                <div class="ticket-detail__meta">
                    <span><strong>${escapeHtml(ticket.name)}</strong></span>
                    <span>${escapeHtml(ticket.email)}</span>
                    <span>Category: <strong>${escapeHtml(ticket.category)}</strong></span>
                    <span>Submitted: <strong>${formatDate(ticket.createdAt)}</strong></span>
                </div>
            </section>

            <section class="ticket-thread">
                ${ticket.messages.map(renderMessage).join('')}
            </section>

            <section class="ticket-reply">
                <label for="replyBody" class="ticket-reply__label">Reply to this ticket</label>
                <textarea id="replyBody" class="ticket-reply__textarea"
                          placeholder="Write your response…" maxlength="5000"></textarea>
                <div class="ticket-reply__actions">
                    <button type="button" class="btn-primary" id="sendReply">Send Reply</button>
                </div>
            </section>
        `;

        bindControls();
    }

    function bindControls() {
        const statusSel = $('#tStatus');
        const prioritySel = $('#tPriority');
        const replyBtn = $('#sendReply');
        const replyBody = $('#replyBody');

        async function updateTicket(payload) {
            try {
                const data = await api(`/api/tickets/${ticketId}`, {
                    method: 'PATCH',
                    body: JSON.stringify(payload)
                });

                ticket.status = data.ticket.status;
                ticket.priority = data.ticket.priority;

                if (typeof toast === 'function') {
                    toast('Ticket updated.', 'success');
                }
            } catch (err) {
                if (typeof toast === 'function') {
                    toast(err.message, 'error');
                }
            }
        }

        statusSel.addEventListener('change', () => updateTicket({ status: statusSel.value }));
        prioritySel.addEventListener('change', () => updateTicket({ priority: prioritySel.value }));

        replyBtn.addEventListener('click', async () => {
            const body = replyBody.value.trim();
            if (!body) return;

            replyBtn.disabled = true;
            const original = replyBtn.textContent;
            replyBtn.textContent = 'Sending…';

            try {
                const data = await api(`/api/tickets/${ticketId}/reply`, {
                    method: 'POST',
                    body: JSON.stringify({ body })
                });

                ticket = data.ticket;
                render();

                if (typeof toast === 'function') {
                    toast('Reply posted.', 'success');
                }
            } catch (err) {
                if (typeof toast === 'function') {
                    toast(err.message, 'error');
                }

                replyBtn.disabled = false;
                replyBtn.textContent = original;
            }
        });
    }

    async function load() {
        try {
            const data = await api(`/api/tickets/${ticketId}`);
            ticket = data.ticket;
            render();
        } catch (err) {
            container.innerHTML = `<div class="dash-empty">
                <div class="dash-empty__icon">⚠️</div>
                <h3 class="dash-empty__title">Failed to load ticket</h3>
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