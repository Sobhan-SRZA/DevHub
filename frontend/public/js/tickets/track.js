/* ============================================================
   Ticket Track Page
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
    const page = document.querySelector('.ticket-page');
    const token = page?.dataset.token;

    if (!token) return;

    const loadingEl = document.getElementById('ticketLoading');
    const errorEl = document.getElementById('ticketError');
    const contentEl = document.getElementById('ticketContent');
    const threadEl = document.getElementById('ticketThread');
    const form = document.getElementById('replyForm');
    const textarea = document.getElementById('replyBody');
    const submitBtn = document.getElementById('replySubmit');

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

    function renderMessage(m) {
        return `
            <div class="ticket-msg ${m.author === 'staff' ? 'ticket-msg--staff' : ''}">
                <div class="ticket-msg__head">
                    <span class="ticket-msg__author">${escapeHtml(m.authorName)}</span>
                    ${m.author === 'staff' ? '<span class="ticket-msg__badge">Support</span>' : ''}
                    <span class="ticket-msg__date">${formatDate(m.createdAt)}</span>
                </div>
                <div class="ticket-msg__body">${escapeHtml(m.body)}</div>
            </div>
        `;
    }

    function render(ticket) {
        document.getElementById('ticketNumber').textContent = ticket.ticketNumber;
        document.getElementById('ticketSubject').textContent = ticket.subject;
        document.getElementById('ticketCategory').textContent = ticket.category;

        const statusEl = document.getElementById('ticketStatus');
        statusEl.textContent = ticket.status;
        statusEl.className = `ticket-status ticket-status--${ticket.status}`;

        threadEl.innerHTML = ticket.messages.map(renderMessage).join('');
        loadingEl.hidden = true;
        contentEl.hidden = false;
    }

    async function load() {
        try {
            const res = await fetch(`/api/v1/tickets/track/${encodeURIComponent(token)}`, {
                credentials: 'include'
            });
            const data = await res.json().catch(() => ({}));

            if (!res.ok) {
                loadingEl.hidden = true;
                errorEl.hidden = false;
                return;
            }

            render(data.ticket);
        } catch (err) {
            loadingEl.hidden = true;
            errorEl.hidden = false;
        }
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const body = textarea.value.trim();
        if (!body) return;

        submitBtn.disabled = true;
        const original = submitBtn.textContent;
        submitBtn.textContent = 'Sending…';

        try {
            const res = await fetch(`/api/v1/tickets/track/${encodeURIComponent(token)}/reply`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ body })
            });

            const data = await res.json().catch(() => ({}));

            if (!res.ok) {
                throw new Error(data.message || 'Failed to send reply.');
            }

            // Append new messages without re-fetching the whole thread.
            const lastMessages = data.ticket.messages.slice(-2);
            lastMessages.forEach((m) => {
                threadEl.insertAdjacentHTML('beforeend', renderMessage(m));
            });

            textarea.value = '';
            if (typeof toast === 'function') toast('Reply sent.', 'success');
        } catch (err) {
            if (typeof toast === 'function') toast(err.message, 'error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = original;
        }
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