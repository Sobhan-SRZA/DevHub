/**
 * HTML email templates for ticket lifecycle notifications.
 * Self-contained inline styles for maximum email-client compatibility.
 */

interface CreatedProps {
    name: string;
    ticketNumber: string;
    subject: string;
    category: string;
    trackUrl: string;
}

interface ReplyProps {
    name: string;
    ticketNumber: string;
    subject: string;
    replyAuthor: string;
    replyPreview: string;
    trackUrl: string;
}

const BASE_STYLE = `
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: #f4f5f7;
    padding: 32px 16px;
    color: #1f2937;
`;

const CARD_STYLE = `
    max-width: 560px;
    margin: 0 auto;
    background: #ffffff;
    border-radius: 12px;
    padding: 32px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
`;

const BADGE_STYLE = `
    display: inline-block;
    padding: 4px 10px;
    background: #eff6ff;
    color: #1d4ed8;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.02em;
`;

const BUTTON_STYLE = `
    display: inline-block;
    padding: 12px 24px;
    background: #2563eb;
    color: #ffffff !important;
    text-decoration: none;
    border-radius: 8px;
    font-weight: 600;
    font-size: 14px;
`;

const MUTED = "color: #6b7280; font-size: 13px; line-height: 1.6;";

/* -------------------- Ticket Created -------------------- */

export function ticketCreatedTemplate(p: CreatedProps): string {
    return `
<!DOCTYPE html>
<html><body style="${BASE_STYLE}">
  <div style="${CARD_STYLE}">
    <div style="${BADGE_STYLE}">Ticket ${p.ticketNumber}</div>

    <h1 style="margin: 16px 0 8px; font-size: 22px; line-height: 1.3; color: #111827;">
      Hi ${escapeHtml(p.name)},
    </h1>

    <p style="margin: 0 0 16px; font-size: 15px; line-height: 1.6;">
      We've received your message and our team is reviewing it.
      You can track the conversation and reply any time using the
      button below.
    </p>

    <div style="background: #f9fafb; border-radius: 8px; padding: 16px; margin: 20px 0;">
      <p style="margin: 0 0 4px; ${MUTED}">Subject</p>
      <p style="margin: 0 0 12px; font-weight: 600; font-size: 15px;">${escapeHtml(p.subject)}</p>

      <p style="margin: 0 0 4px; ${MUTED}">Category</p>
      <p style="margin: 0; font-weight: 600; font-size: 15px; text-transform: capitalize;">${escapeHtml(p.category)}</p>
    </div>

    <a href="${p.trackUrl}" style="${BUTTON_STYLE}">View ticket</a>

    <p style="margin: 24px 0 0; ${MUTED}">
      Or copy this link into your browser:<br>
      <span style="word-break: break-all; font-family: monospace; font-size: 12px;">${p.trackUrl}</span>
    </p>

    <p style="margin: 24px 0 0; padding-top: 24px; border-top: 1px solid #e5e7eb; ${MUTED}">
      This link remains valid for 30 days. If you have a DevHub
      account with this email address, you'll also find the ticket
      under <strong>My Tickets</strong> in your dashboard.
    </p>
  </div>
</body></html>`;
}

/* -------------------- Staff Reply Notification -------------------- */

export function ticketReplyTemplate(p: ReplyProps): string {
    return `
<!DOCTYPE html>
<html><body style="${BASE_STYLE}">
  <div style="${CARD_STYLE}">
    <div style="${BADGE_STYLE}">Ticket ${p.ticketNumber}</div>

    <h1 style="margin: 16px 0 8px; font-size: 22px; line-height: 1.3; color: #111827;">
      Hi ${escapeHtml(p.name)},
    </h1>

    <p style="margin: 0 0 16px; font-size: 15px; line-height: 1.6;">
      <strong>${escapeHtml(p.replyAuthor)}</strong> from DevHub support
      replied to your ticket "<em>${escapeHtml(p.subject)}</em>":
    </p>

    <div style="background: #eff6ff; border-left: 3px solid #2563eb; padding: 16px; border-radius: 6px; margin: 20px 0;">
      <p style="margin: 0; font-size: 14px; line-height: 1.65; white-space: pre-wrap;">${escapeHtml(p.replyPreview)}</p>
    </div>

    <a href="${p.trackUrl}" style="${BUTTON_STYLE}">Reply to ticket</a>

    <p style="margin: 24px 0 0; ${MUTED}">
      Or copy this link into your browser:<br>
      <span style="word-break: break-all; font-family: monospace; font-size: 12px;">${p.trackUrl}</span>
    </p>

    <p style="margin: 24px 0 0; padding-top: 24px; border-top: 1px solid #e5e7eb; ${MUTED}">
      Replies from this address are monitored. Please use the ticket
      page for a tracked conversation.
    </p>
  </div>
</body></html>`;
}

/* -------------------- Lookup OTP -------------------- */

export function ticketLookupOtpTemplate(opts: {
    code: string;
    email: string;
}): string {
    return `
<!DOCTYPE html>
<html><body style="${BASE_STYLE}">
  <div style="${CARD_STYLE}">
    <div style="${BADGE_STYLE}">Sign-in code</div>

    <h1 style="margin: 16px 0 8px; font-size: 22px; line-height: 1.3; color: #111827;">
      Verify your email
    </h1>

    <p style="margin: 0 0 16px; font-size: 15px; line-height: 1.6;">
      You requested access to tickets associated with
      <strong>${escapeHtml(opts.email)}</strong>. Enter the code
      below to continue.
    </p>

    <div style="background: #f9fafb; border-radius: 8px; padding: 24px; text-align: center; margin: 20px 0;">
      <p style="margin: 0 0 8px; ${MUTED}">Your code</p>
      <p style="margin: 0; font-family: ui-monospace, monospace; font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #111827;">
        ${opts.code}
      </p>
    </div>

    <p style="margin: 24px 0 0; ${MUTED}">
      This code expires in 15 minutes. If you did not request it,
      you can safely ignore this email.
    </p>
  </div>
</body></html>`;
}

function escapeHtml(s: string): string {
    return String(s || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

/**
 * Copyright (c) 2026 Sobhan Rasoulzadeh Asl (Sobhan-SRZA / Mr. Sinre)
 *
 * Licensed under the BSD 3-Clause License.
 * See the LICENSE file in the project root for license information.
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */