/**
 * Ticket lifecycle helpers: token generation, email delivery, and
 * user-account linking.
 */

import {
    ticketCreatedTemplate,
    ticketReplyTemplate
} from "./mail/templates/ticketEmails";
import { Ticket } from "../models/Ticket";
import { mailer } from "./mail";
import crypto from "crypto";

/* -------------------- Constants -------------------- */

/** Tracking tokens remain valid for 30 days after issuance. */
const TRACKING_TTL_DAYS = 30;

/** Application URL, used to build absolute links inside emails. */
const APP_URL = (process.env.APP_URL || "").replace(/\/+$/, "");

/* -------------------- Token Helpers -------------------- */

function hashToken(raw: string): string {
    return crypto.createHash("sha256").update(raw).digest("hex");
}

/**
 * Issues a fresh tracking token for the ticket. The raw token is
 * returned to the caller (for email delivery) while only its hash
 * is stored on the ticket.
 */
export async function issueTrackingToken(ticketId: string): Promise<string> {
    const raw = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(
        Date.now() + TRACKING_TTL_DAYS * 24 * 60 * 60 * 1000
    );

    await Ticket.updateOne(
        { _id: ticketId },
        {
            $set: {
                trackingTokenHash: hashToken(raw),
                trackingExpiresAt: expiresAt,
                trackingRevoked: false
            }
        }
    );

    return raw;
}

/**
 * Resolves a ticket by its raw tracking token. Returns null when the
 * token is invalid, expired, revoked, or does not match any ticket.
 */
export async function findTicketByTrackingToken(rawToken: string) {
    if (!rawToken || rawToken.length < 32) return null;

    const ticket = await Ticket.findOne({
        trackingTokenHash: hashToken(rawToken),
        trackingExpiresAt: { $gt: new Date() },
        trackingRevoked: { $ne: true }
    })
        .select("+trackingTokenHash")
        .lean();

    return ticket || null;
}

/** Revokes any active tracking token on the ticket. */
export async function revokeTrackingToken(ticketId: string): Promise<void> {
    await Ticket.updateOne(
        { _id: ticketId },
        {
            $set: { trackingRevoked: true },
            $unset: { trackingTokenHash: "" }
        }
    );
}

/* -------------------- Email Notifications -------------------- */

/**
 * Sends the initial confirmation email with the tracking link.
 * Failures are logged but never propagated — the ticket has been
 * created, and delivery is best-effort.
 */
export async function sendTicketCreatedEmail(ticket: any, rawToken: string) {
    try {
        const trackUrl = `${APP_URL}/tickets/track/${rawToken}`;

        await mailer.send({
            to: ticket.email,
            subject: `[${ticket.ticketNumber}] We received your message`,
            html: ticketCreatedTemplate({
                name: ticket.name,
                ticketNumber: ticket.ticketNumber,
                subject: ticket.subject,
                category: ticket.category,
                trackUrl
            })
        });
    } catch (err: any) {
        console.error(
            `[ticketService] Failed to send creation email for ${ticket.ticketNumber}:`,
            err?.message
        );
    }
}

/**
 * Notifies the ticket author when staff posts a reply. Includes a
 * short preview and a tracking link. Silent on failure.
 */
export async function sendTicketReplyEmail(
    ticket: any,
    reply: { body: string; authorName: string },
    rawToken: string | null
) {
    try {
        // If the token is no longer available, issue a fresh one so
        // the recipient can always reach the ticket.
        const token =
            rawToken ||
            (await issueTrackingToken(String(ticket._id)));

        const trackUrl = `${APP_URL}/tickets/track/${token}`;

        const preview =
            reply.body.length > 400
                ? reply.body.slice(0, 400) + "…"
                : reply.body;

        await mailer.send({
            to: ticket.email,
            subject: `[${ticket.ticketNumber}] New reply from DevHub support`,
            html: ticketReplyTemplate({
                name: ticket.name,
                ticketNumber: ticket.ticketNumber,
                subject: ticket.subject,
                replyAuthor: reply.authorName,
                replyPreview: preview,
                trackUrl
            })
        });
    } catch (err: any) {
        console.error(
            `[ticketService] Failed to send reply email for ${ticket.ticketNumber}:`,
            err?.message
        );
    }
}

/* -------------------- Account Linking -------------------- */

/**
 * Links all existing tickets with the given email to the user account.
 * Called on registration and on login when the user's email changes.
 *
 * Idempotent — already-linked tickets are not modified. Returns the
 * number of newly-linked tickets.
 */
export async function linkTicketsToUser(
    userId: any,
    email: string
): Promise<number> {
    if (!userId || !email) return 0;

    const normalized = String(email).trim().toLowerCase();

    const result = await Ticket.updateMany(
        {
            email: normalized,
            userId: null
        },
        {
            $set: { userId }
        }
    );

    if (result.modifiedCount > 0) {
        console.log(
            `[ticketService] Linked ${result.modifiedCount} ticket(s) to user ${userId}`
        );
    }

    return result.modifiedCount;
}

/* -------------------- Email-based Lookup -------------------- */

/**
 * Generates a 6-digit OTP for email-based ticket lookup, storing only
 * its hash. Replaces any prior OTP on any of the user's tickets.
 */
export async function issueLookupOtp(email: string): Promise<void> {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const hash = crypto
        .createHash("sha256")
        .update(email + ":" + code)
        .digest("hex");

    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await Ticket.updateMany(
        { email: email.toLowerCase() },
        {
            $set: {
                lookupOtpHash: hash,
                lookupOtpExpiresAt: expiresAt,
                lookupOtpAttempts: 0
            }
        }
    );

    // OTP is sent via the template below; caller should not log it.
    return code as any;
}

/**
 * Verifies an OTP against any of the user's tickets. On success,
 * returns the list of tickets and clears all OTP state for that email.
 */
export async function verifyLookupOtp(
    email: string,
    code: string
): Promise<{ ok: boolean; tickets?: any[] }> {
    const normalized = email.toLowerCase();
    const hash = crypto
        .createHash("sha256")
        .update(normalized + ":" + code)
        .digest("hex");

    const ticket = await Ticket.findOne({
        email: normalized,
        lookupOtpHash: hash,
        lookupOtpExpiresAt: { $gt: new Date() },
        lookupOtpAttempts: { $lt: 5 }
    }).select("+lookupOtpHash");

    if (!ticket) {
        await Ticket.updateMany(
            { email: normalized },
            { $inc: { lookupOtpAttempts: 1 } }
        );
        return { ok: false };
    }

    const tickets = await Ticket.find({ email: normalized })
        .sort({ createdAt: -1 })
        .select("ticketNumber subject status priority category createdAt lastReplyAt")
        .lean();

    await Ticket.updateMany(
        { email: normalized },
        {
            $unset: {
                lookupOtpHash: "",
                lookupOtpExpiresAt: "",
                lookupOtpAttempts: ""
            }
        }
    );

    return { ok: true, tickets };
}

/**
 * Copyright (c) 2026 Sobhan Rasoulzadeh Asl (Sobhan-SRZA / Mr. Sinre)
 *
 * Licensed under the BSD 3-Clause License.
 * See the LICENSE file in the project root for license information.
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */