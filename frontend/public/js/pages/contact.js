/* ============================================================
   Contact Page
   ============================================================
   Submits the contact form, which creates a ticket, and swaps
   the form for a success panel that displays the ticket number.
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('contactForm');
    const successPanel = document.getElementById('contactSuccess');
    const ticketNumberEl = document.getElementById('ticketNumber');
    const sendAnotherBtn = document.getElementById('sendAnother');
    const submitBtn = document.getElementById('cSubmit');
    const messageInput = document.getElementById('cMessage');
    const messageCount = document.getElementById('cMessageCount');

    /* --------------------------------------------------------
       Character counter
       -------------------------------------------------------- */
    messageInput?.addEventListener('input', () => {
        if (messageCount) {
            messageCount.textContent = messageInput.value.length.toLocaleString('en-US');
        }
    });

    /* --------------------------------------------------------
       Submission
       -------------------------------------------------------- */
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        FormKit.clearAllErrors(form);

        const values = {
            name: form.elements.name.value.trim(),
            email: form.elements.email.value.trim().toLowerCase(),
            subject: form.elements.subject.value.trim(),
            category: form.elements.category.value,
            message: form.elements.message.value.trim()
        };

        /* ---------- Client-side validation ---------- */
        const errors = {};

        if (!values.name || values.name.length < 2) {
            errors.name = 'Name must be at least 2 characters.';
        }

        if (!values.email) {
            errors.email = 'Email is required.';
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(values.email)) {
            errors.email = 'Please enter a valid email address.';
        }

        if (!values.subject || values.subject.length < 3) {
            errors.subject = 'Subject must be at least 3 characters.';
        }

        if (!values.message || values.message.length < 20) {
            errors.message = 'Message must be at least 20 characters.';
        }

        if (Object.keys(errors).length) {
            for (const [field, msg] of Object.entries(errors)) {
                const input = form.querySelector(`[name="${field}"]`);
                if (input) FormKit.showFieldError(input, msg);
            }

            const first = Object.keys(errors)[0];
            form.querySelector(`[name="${first}"]`)?.focus();
            return;
        }

        /* ---------- Submit ---------- */
        submitBtn.disabled = true;
        const original = submitBtn.innerHTML;
        submitBtn.innerHTML = 'Sending…';

        try {
            const res = await fetch('/api/contact', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(values)
            });

            const data = await res.json().catch(() => ({}));

            if (!res.ok) {
                const err = new Error(data.message || 'Failed to send message.');

                // Render field-level errors returned by the server.
                if (data.field) {
                    const input = form.querySelector(`[name="${data.field}"]`);
                    if (input) FormKit.showFieldError(input, data.message);
                } else if (data.details) {
                    for (const [field, msgs] of Object.entries(data.details)) {
                        const input = form.querySelector(`[name="${field}"]`);
                        if (input && Array.isArray(msgs) && msgs[0]) {
                            FormKit.showFieldError(input, msgs[0]);
                        }
                    }
                }

                throw err;
            }

            /* ---------- Success ---------- */
            form.hidden = true;
            successPanel.hidden = false;
            ticketNumberEl.textContent = data.ticket?.ticketNumber || '—';

            toast(data.message || 'Your message has been received.', 'success');

            successPanel.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } catch (err) {
            if (typeof toast === 'function') {
                toast(err.message || 'Failed to send message.', 'error');
            } else {
                alert(err.message || 'Failed to send message.');
            }
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = original;
        }
    });

    /* --------------------------------------------------------
       Reset to allow another submission
       -------------------------------------------------------- */
    sendAnotherBtn?.addEventListener('click', () => {
        form.reset();
        if (messageCount) messageCount.textContent = '0';
        FormKit.clearAllErrors(form);

        successPanel.hidden = true;
        form.hidden = false;

        form.elements.name?.focus();
    });
});

/**
 * Copyright (c) 2026 Sobhan Rasoulzadeh Asl (Sobhan-SRZA / Mr. Sinre)
 *
 * Licensed under the BSD 3-Clause License.
 * See the LICENSE file in the project root for license information.
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */