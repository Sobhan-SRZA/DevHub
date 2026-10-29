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
 * Appends a staff reply to the ticket thread and reopens the
 * ticket if it was previously marked resolved or closed.
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
        authorName: req.user.name || req.user.username || "Staff",
        body: data.body,
        createdAt: new Date()
    } as any);

    ticket.lastReplyAt = new Date();
    ticket.lastReplyBy = "staff";

    // Reopen a resolved/closed ticket on new staff activity.
    if (ticket.status === "resolved" || ticket.status === "closed") {
        ticket.status = "open";
        ticket.resolvedAt = null;
    }

    if (!ticket.assignedTo) {
        ticket.assignedTo = req.user._id;
    }

    await ticket.save();

    res.json({
        ok: true,
        message: "Reply posted.",
        ticket: serializeTicket(ticket.toObject(), { includeMessages: true })
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

/**
 * Copyright (c) 2026 Sobhan Rasoulzadeh Asl (Sobhan-SRZA / Mr. Sinre)
 *
 * Licensed under the BSD 3-Clause License.
 * See the LICENSE file in the project root for license information.
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */