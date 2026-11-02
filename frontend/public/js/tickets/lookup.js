/* ============================================================
   Ticket Lookup Flow
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
    const emailForm = document.getElementById('emailForm');
    const otpForm = document.getElementById('otpForm');
    const listEl = document.getElementById('ticketsList');
    const container = document.getElementById('ticketsContainer');
    const otpEmailEl = document.getElementById('otpEmail');
    const backBtn = document.getElementById('backBtn');
    const emailInput = document.getElementById('lookupEmail');
    const codeInput = document.getElementById('lookupCode');

    let currentEmail = '';

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
            return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(new Date(d));
        } catch { return '—'; }
    }

    /* ---------- Step 1: request code ---------- */
    emailForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        FormKit.clearAllErrors(emailForm);

        const email = emailInput.value.trim().toLowerCase();

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
            return FormKit.showFieldError(emailInput, 'Please enter a valid email address.');
        }

        const btn = document.getElementById('emailSubmit');
        btn.disabled = true;
        btn.textContent = 'Sending…';

        try {
            const res = await fetch('/api/v1/tickets/lookup', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });

            const data = await res.json().catch(() => ({}));

            if (!res.ok) throw new Error(data.message || 'Failed to send code.');

            currentEmail = email;
            otpEmailEl.textContent = email;
            emailForm.hidden = true;
            otpForm.hidden = false;
            codeInput.focus();

            if (typeof toast === 'function') toast('Code sent. Check your email.', 'success');
        } catch (err) {
            if (typeof toast === 'function') toast(err.message, 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = 'Send access code';
        }
    });

    /* ---------- Step 2: verify code ---------- */
    otpForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        FormKit.clearAllErrors(otpForm);

        const code = codeInput.value.replace(/\D/g, '').slice(0, 6);
        codeInput.value = code;

        if (code.length !== 6) {
            return FormKit.showFieldError(codeInput, 'The code must be 6 digits.');
        }

        const btn = document.getElementById('otpSubmit');
        btn.disabled = true;
        btn.textContent = 'Verifying…';

        try {
            const res = await fetch('/api/v1/tickets/lookup/verify', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: currentEmail, code })
            });

            const data = await res.json().catch(() => ({}));

            if (!res.ok) throw new Error(data.message || 'Invalid code.');

            renderTickets(data.tickets || []);
            otpForm.hidden = true;
            listEl.hidden = false;
        } catch (err) {
            FormKit.showFieldError(codeInput, err.message);
        } finally {
            btn.disabled = false;
            btn.textContent = 'Verify';
        }
    });

    /* ---------- Back ---------- */
    backBtn.addEventListener('click', () => {
        otpForm.hidden = true;
        emailForm.hidden = false;
        codeInput.value = '';
        FormKit.clearAllErrors(otpForm);
        emailInput.focus();
    });

    /* ---------- Step 3: render list ---------- */
    function renderTickets(tickets) {
        if (!tickets.length) {
            container.innerHTML = `<div class="empty-state">
                <div class="empty-state__icon">🎫</div>
                <h3 class="empty-state__title">No tickets found</h3>
                <p class="empty-state__text">No tickets are associated with this email address.</p>
            </div>`;
            return;
        }

        container.innerHTML = tickets.map((t) => `
            <a class="lookup-ticket" href="${escapeHtml(t.trackUrl)}">
                <div class="lookup-ticket__head">
                    <span class="lookup-ticket__number">${escapeHtml(t.ticketNumber)}</span>
                    <span class="ticket-status ticket-status--${escapeHtml(t.status)}">${escapeHtml(t.status)}</span>
                </div>
                <div class="lookup-ticket__subject">${escapeHtml(t.subject)}</div>
                <div class="lookup-ticket__meta">
                    ${formatDate(t.createdAt)} · ${escapeHtml(t.category)}
                </div>
            </a>
        `).join('');
    }
});

/**
 * Copyright (c) 2026 Sobhan Rasoulzadeh Asl (Sobhan-SRZA / Mr. Sinre)
 *
 * Licensed under the BSD 3-Clause License.
 * See the LICENSE file in the project root for license information.
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */