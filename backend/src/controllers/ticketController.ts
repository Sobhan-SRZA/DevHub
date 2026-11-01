/**
 * Admin-side ticket management. All handlers assume the caller has
 * already passed an admin/developer gate.
 */

import type { Response } from "express";
import { Ticket } from "../models/Ticket";
import { User } from "../models/User";
import { asyncHandler } from "../utils/asyncHandler";
import { validate } from "../utils/validate";
import { AppError } from "../utils/AppError";
import { ErrorCodes } from "../utils/errorCodes";
import {
    ticketReplySchema,
    ticketUpdateSchema
} from "../validators/contactValidator";
import { findTicketByTrackingToken, issueLookupOtp, issueTrackingToken, verifyLookupOtp } from "../services/ticketService";
import { ticketLookupOtpTemplate } from "../services/mail/templates/ticketEmails";
import { mailer } from "../services/mail";

/* -------------------- Helpers -------------------- */

function serializeTicket(t: any, opts: { includeMessages?: boolean } = {}) {
    const base = {
        id: t._id,
        ticketNumber: t.ticketNumber,
        name: t.name,
        email: t.email,
        subject: t.subject,
        category: t.category,
        status: t.status,
        priority: t.priority,
        assignedTo: t.assignedTo || null,
        lastReplyAt: t.lastReplyAt || null,
        lastReplyBy: t.lastReplyBy || null,
        resolvedAt: t.resolvedAt || null,
        messageCount: (t.messages || []).length,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt
    };

    if (opts.includeMessages) {
        return {
            ...base,
            message: t.message,
            messages: (t.messages || []).map((m: any) => ({
                id: m._id,
                author: m.author,
                authorId: m.authorId,
                authorName: m.authorName,
                body: m.body,
                createdAt: m.createdAt
            }))
        };
    }

    return base;
}

/* -------------------- Handlers -------------------- */

/**
 * Lists tickets with pagination and filters.
 *
 * Query parameters:
 *   - page:   1-based page index (default 1)
 *   - limit:  page size, capped at 100 (default 30)
 *   - status: open | pending | resolved | closed
 *   - category: general | bug | feature | collaboration | security | other
 *   - search: matches ticket number, subject, email, or name
 */
export const listTickets = asyncHandler(async (req: any, res: Response) => {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 30));

    const filter: Record<string, any> = {};

    if (req.query.status) filter.status = String(req.query.status);
    if (req.query.category) filter.category = String(req.query.category);

    if (req.query.search) {
        const rx = new RegExp(String(req.query.search).trim().slice(0, 80), "i");

        filter.$or = [
            { ticketNumber: rx },
            { subject: rx },
            { email: rx },
            { name: rx }
        ];
    }

    const [items, total] = await Promise.all([
        Ticket.find(filter)
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .lean(),
        Ticket.countDocuments(filter)
    ]);

    res.json({
        ok: true,
        tickets: items.map((t) => serializeTicket(t)),
        pagination: {
            page,
            limit,
            total,
            pages: Math.max(1, Math.ceil(total / limit))
        }
    });
});

/**
 * Retrieves a single ticket with the full conversation thread.
 */
export const getTicket = asyncHandler(async (req: any, res: Response) => {
    const ticket = await Ticket.findById(req.params.id).lean();

    if (!ticket) {
        throw new AppError(404, ErrorCodes.VALIDATION_ERROR, "Ticket not found.");
    }

    // Resolve the assignee's display name, when assigned.
    let assignee = null;

    if (ticket.assignedTo) {
        const u = await User.findById(ticket.assignedTo)
            .select("name username")
            .lean();

        if (u) {
            assignee = {
                id: u._id,
                name: u.name,
                username: u.username
            };
        }
    }

    res.json({
        ok: true,
        ticket: serializeTicket(ticket, { includeMessages: true }),
        assignee
    });
});

/**
 * Updates ticket status, priority, or assignment.
 * Setting status to resolved records the resolution timestamp.
 */
export const updateTicket = asyncHandler(async (req: any, res: Response) => {
    const data = validate(ticketUpdateSchema, req.body);

    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) {
        throw new AppError(404, ErrorCodes.VALIDATION_ERROR, "Ticket not found.");
    }

    if (data.status) {
        ticket.status = data.status;

        if (data.status === "resolved") {
            ticket.resolvedAt = new Date();
        } else if (data.status === "open" || data.status === "pending") {
            ticket.resolvedAt = null;
        }
    }

    if (data.priority) {
        ticket.priority = data.priority;
    }

    if (data.assignedTo !== undefined) {
        ticket.assignedTo = data.assignedTo as any;
    }

    await ticket.save();

    res.json({
        ok: true,
        message: "Ticket updated.",
        ticket: serializeTicket(ticket.toObject())
    });
});

/* ==========================================================================
 * Public — Ticket Tracking
 * ========================================================================== */

/**
 * Returns a ticket and its full message thread when accessed via a
 * valid tracking token. The tracking token is the sole authentication
 * mechanism for this endpoint — no session is required.
 */
export const getTicketByToken = asyncHandler(async (req: any, res: Response) => {
    const raw = String(req.params.token || "").trim();
    const ticket = await findTicketByTrackingToken(raw);

    if (!ticket) {
        throw new AppError(
            404,
            ErrorCodes.INVALID_TOKEN,
            "This ticket link is invalid or has expired."
        );
    }

    res.json({
        ok: true,
        ticket: {
            id: ticket._id,
            ticketNumber: ticket.ticketNumber,
            name: ticket.name,
            email: ticket.email,
            subject: ticket.subject,
            category: ticket.category,
            status: ticket.status,
            priority: ticket.priority,
            createdAt: ticket.createdAt,
            lastReplyAt: ticket.lastReplyAt,
            messages: (ticket.messages || []).map((m: any) => ({
                id: m._id,
                author: m.author,
                authorName: m.authorName,
                body: m.body,
                createdAt: m.createdAt
            }))
        }
    });
});

/**
 * Appends a user reply to a ticket accessed via tracking token.
 * Notifies staff via the dashboard; the user is already on the page,
 * so no email is sent back to them.
 */
export const replyToTicketByToken = asyncHandler(
    async (req: any, res: Response) => {
        const raw = String(req.params.token || "").trim();
        const ticket = await findTicketByTrackingToken(raw);

        if (!ticket) {
            throw new AppError(404, ErrorCodes.INVALID_TOKEN, "Invalid or expired ticket link.");
        }

        const body = String(req.body?.body || "").trim();

        if (body.length < 1 || body.length > 5000) {
            throw new AppError(
                400,
                ErrorCodes.VALIDATION_ERROR,
                "Reply must be between 1 and 5,000 characters."
            );
        }

        const doc = await Ticket.findById(ticket._id);
        if (!doc) throw new AppError(404, ErrorCodes.VALIDATION_ERROR, "Ticket not found.");

        doc.messages.push({
            author: "user",
            authorId: null,
            authorName: doc.name,
            body,
            createdAt: new Date()
        } as any);

        doc.lastReplyAt = new Date();
        doc.lastReplyBy = "user";

        // Reopen resolved/closed tickets on user activity.
        if (doc.status === "resolved" || doc.status === "closed") {
            doc.status = "open";
            doc.resolvedAt = null;
        }

        await doc.save();

        res.json({
            ok: true,
            message: "Your reply has been sent.",
            ticket: {
                id: doc._id,
                ticketNumber: doc.ticketNumber,
                status: doc.status,
                messages: doc.messages.map((m: any) => ({
                    id: m._id,
                    author: m.author,
                    authorName: m.authorName,
                    body: m.body,
                    createdAt: m.createdAt
                }))
            }
        });
    }
);

/* ==========================================================================
 * Public — Email-based Lookup
 * ========================================================================== */

/**
 * Initiates an email-based lookup. Sends a 6-digit code to the
 * provided address. Always returns a generic success response to
 * avoid revealing whether any tickets exist for the email.
 */
export const requestTicketLookup = asyncHandler(
    async (req: any, res: Response) => {
        const email = String(req.body?.email || "").trim().toLowerCase();

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
            throw new AppError(400, ErrorCodes.EMAIL_INVALID, "Please enter a valid email address.");
        }

        const count = await Ticket.countDocuments({ email });

        if (count > 0) {
            try {
                const code = await issueLookupOtp(email);

                await mailer.send({
                    to: email,
                    subject: "Your DevHub ticket access code",
                    html: ticketLookupOtpTemplate({ code: code as any, email })
                });
            } catch (err: any) {
                console.warn(`[lookup] OTP delivery failed for ${email}:`, err?.message);
            }
        }

        res.json({
            ok: true,
            message: "If any tickets exist for this email, a code has been sent."
        });
    }
);

/**
 * Verifies the lookup OTP and returns all tickets associated with the
 * email address. Tracking tokens are re-issued for each ticket so the
 * user can open the full conversation.
 */
export const verifyTicketLookup = asyncHandler(
    async (req: any, res: Response) => {
        const email = String(req.body?.email || "").trim().toLowerCase();
        const code = String(req.body?.code || "").trim();

        if (!/^\d{6}$/.test(code)) {
            throw new AppError(400, ErrorCodes.VALIDATION_ERROR, "The code must be exactly 6 digits.");
        }

        const result = await verifyLookupOtp(email, code);

        if (!result.ok) {
            throw new AppError(401, ErrorCodes.INVALID_TOKEN, "Invalid or expired code.");
        }

        // Re-issue tracking tokens so the user can open each ticket.
        const tickets = await Promise.all(
            (result.tickets || []).map(async (t: any) => {
                const token = await issueTrackingToken(String(t._id));
                return {
                    id: t._id,
                    ticketNumber: t.ticketNumber,
                    subject: t.subject,
                    status: t.status,
                    priority: t.priority,
                    category: t.category,
                    createdAt: t.createdAt,
                    lastReplyAt: t.lastReplyAt,
                    trackUrl: `/tickets/track/${token}`
                };
            })
        );

        res.json({ ok: true, tickets });
    }
);

/* ==========================================================================
 * Authenticated — My Tickets
 * ========================================================================== */

/**
 * Returns all tickets associated with the current user's email
 * address. Called from the dashboard "My Tickets" page.
 */
export const listMyTickets = asyncHandler(async (req: any, res: Response) => {
    if (!req.user) throw new AppError(401, ErrorCodes.UNAUTHENTICATED);

    const user = await User.findById(req.user._id).select("email").lean();
    if (!user) throw new AppError(401, ErrorCodes.UNAUTHENTICATED);

    const tickets = await Ticket.find({
        $or: [
            { userId: req.user._id },
            { email: user.email }
        ]
    })
        .sort({ createdAt: -1 })
        .select("ticketNumber subject status priority category createdAt lastReplyAt lastReplyBy messageCount")
        .lean();

    // Issue fresh tracking tokens so each row can link to the detail page.
    const enriched = await Promise.all(
        tickets.map(async (t: any) => {
            const token = await issueTrackingToken(String(t._id));
            return {
                id: t._id,
                ticketNumber: t.ticketNumber,
                subject: t.subject,
                status: t.status,
                priority: t.priority,
                category: t.category,
                createdAt: t.createdAt,
                lastReplyAt: t.lastReplyAt,
                lastReplyBy: t.lastReplyBy,
                trackUrl: `/tickets/track/${token}`
            };
        })
    );

    res.json({ ok: true, tickets: enriched });
});

/* ==========================================================================
 * Admin — Reply with Email Notification
 * ========================================================================== */

/**
 * Extends the existing replyToTicket handler to dispatch an email
 * notification to the ticket author.
 *
 * This replaces the original replyToTicket implementation.
 */
export const replyToTicket = asyncHandler(async (req: any, res: Response) => {
    const data = validate(ticketReplySchema, req.body);

    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) {
        throw new AppError(404, ErrorCodes.VALIDATION_ERROR, "Ticket not found.");
    }

    ticket.messages.push({
        author: "staff",
        authorId: req.user._id,
        authorName: req.user.name || req.user.username || "Support",
        body: data.body,
        createdAt: new Date()
    } as any);

    ticket.lastReplyAt = new Date();
    ticket.lastReplyBy = "staff";

    if (ticket.status === "resolved" || ticket.status === "closed") {
        ticket.status = "open";
        ticket.resolvedAt = null;
    }

    if (!ticket.assignedTo) {
        ticket.assignedTo = req.user._id;
    }

    await ticket.save();

    // Fire-and-forget: email failure must not break the API response.
    sendTicketReplyEmail(
        ticket.toObject(),
        {
            body: data.body,
            authorName: req.user.name || req.user.username || "Support"
        },
        null // Always issue a fresh token — old one may be unknown.
    ).catch((err) =>
        console.warn("[ticketController] Reply email failed:", err?.message)
    );

    res.json({
        ok: true,
        message: "Reply posted and the author has been notified.",
        ticket: serializeTicket(ticket.toObject(), { includeMessages: true })
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