/**
 * Public contact-form controller. Creates a ticket and enforces
 * per-email and per-IP rate limits to reduce spam.
 */

import type { Response } from "express";
import { createTicketSchema } from "../validators/contactValidator";
import { asyncHandler } from "../utils/asyncHandler";
import { validate } from "../utils/validate";
import { AppError } from "../utils/AppError";
import { ErrorCodes } from "../utils/errorCodes";
import { Ticket } from "../models/Ticket";

/**
 * Creates a new ticket from a contact-form submission.
 *
 * Rate limits:
 *   - One ticket per email address every 2 minutes.
 *   - One ticket per IP address every 5 minutes.
 *
 * Priority is inferred from the category: security reports are
 * marked urgent, and bug reports are marked high.
 */
export const createTicket = asyncHandler(async (req: any, res: Response) => {
    const data = validate(createTicketSchema, req.body);

    /* ---------- Rate limit: per email ---------- */
    const recentByEmail = await Ticket.findOne({
        email: data.email,
        createdAt: { $gte: new Date(Date.now() - 2 * 60 * 1000) }
    }).lean();

    if (recentByEmail) {
        throw new AppError(
            429,
            ErrorCodes.TOO_MANY_ATTEMPTS,
            "You recently submitted a message. Please wait a few minutes before trying again."
        );
    }

    /* ---------- Rate limit: per IP ---------- */
    const ip = req.ip || null;

    if (ip) {
        const recentByIp = await Ticket.findOne({
            ip,
            createdAt: { $gte: new Date(Date.now() - 5 * 60 * 1000) }
        }).lean();

        if (recentByIp) {
            throw new AppError(
                429,
                ErrorCodes.TOO_MANY_ATTEMPTS,
                "Too many messages have been sent from this network. Please wait a few minutes."
            );
        }
    }

    /* ---------- Priority inference ---------- */
    const priority =
        data.category === "security" ? "urgent" :
            data.category === "bug" ? "high" :
                "normal";

    const ticket = await Ticket.create({
        name: data.name,
        email: data.email,
        subject: data.subject,
        category: data.category,
        message: data.message,
        userId: req.user?._id || null,
        ip,
        userAgent: req.get("user-agent") || null,
        priority
    });

    console.log(
        `[TICKET] ${ticket.ticketNumber} created by ${data.email} ` +
        `(category: ${data.category}, priority: ${priority})`
    );

    res.status(201).json({
        ok: true,
        message:
            "Your message has been received. Our team will get back to you soon.",
        ticket: {
            ticketNumber: ticket.ticketNumber,
            subject: ticket.subject,
            category: ticket.category,
            status: ticket.status,
            priority: ticket.priority,
            createdAt: ticket.createdAt
        }
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