/**
 * Ticket model — stores contact-form submissions and the
 * staff ↔ user conversation thread.
 */

import { Schema, model, Model, Types } from "mongoose";

/* -------------------- Enums -------------------- */

export type TicketCategory =
    | "general"
    | "bug"
    | "feature"
    | "collaboration"
    | "security"
    | "other";

export type TicketStatus = "open" | "pending" | "resolved" | "closed";
export type TicketPriority = "low" | "normal" | "high" | "urgent";
export type MessageAuthor = "user" | "staff";

/* -------------------- Interfaces -------------------- */

export interface ITicketMessage {
    _id: Types.ObjectId;
    author: MessageAuthor;
    authorId: Types.ObjectId | null;
    authorName: string;
    body: string;
    createdAt: Date;
}

export interface ITicket {
    ticketNumber: string;

    name: string;
    email: string;
    subject: string;
    category: TicketCategory;
    message: string;

    status: TicketStatus;
    priority: TicketPriority;

    userId: Types.ObjectId | null;

    messages: ITicketMessage[];

    assignedTo: Types.ObjectId | null;
    resolvedAt: Date | null;
    lastReplyAt: Date | null;
    lastReplyBy: MessageAuthor | null;

    ip: string | null;
    userAgent: string | null;

    createdAt: Date;
    updatedAt: Date;
}

/* -------------------- Subschemas -------------------- */

const messageSchema = new Schema<ITicketMessage>(
    {
        author: { type: String, enum: ["user", "staff"], required: true },
        authorId: { type: Schema.Types.ObjectId, ref: "User", default: null },
        authorName: { type: String, required: true, maxlength: 80 },
        body: { type: String, required: true, maxlength: 5000 },
        createdAt: { type: Date, default: () => new Date() }
    },
    { _id: true }
);

/* -------------------- Main Schema -------------------- */

const ticketSchema = new Schema<ITicket>(
    {
        ticketNumber: {
            type: String,
            required: true,
            unique: true,
            index: true
        },

        name: { type: String, required: true, trim: true, maxlength: 80 },
        email: {
            type: String,
            required: true,
            lowercase: true,
            trim: true,
            index: true
        },
        subject: { type: String, required: true, trim: true, maxlength: 120 },
        category: {
            type: String,
            enum: ["general", "bug", "feature", "collaboration", "security", "other"],
            default: "general",
            index: true
        },
        message: { type: String, required: true, maxlength: 5000 },

        status: {
            type: String,
            enum: ["open", "pending", "resolved", "closed"],
            default: "open",
            index: true
        },
        priority: {
            type: String,
            enum: ["low", "normal", "high", "urgent"],
            default: "normal",
            index: true
        },

        userId: {
            type: Schema.Types.ObjectId,
            ref: "User",
            default: null,
            index: true
        },

        messages: { type: [messageSchema], default: [] },

        assignedTo: {
            type: Schema.Types.ObjectId,
            ref: "User",
            default: null,
            index: true
        },
        resolvedAt: { type: Date, default: null },
        lastReplyAt: { type: Date, default: null },
        lastReplyBy: {
            type: String,
            enum: ["user", "staff", null],
            default: null
        },

        ip: { type: String, default: null },
        userAgent: { type: String, default: null }
    },
    { timestamps: true }
);

/* -------------------- Hooks -------------------- */

/**
 * Generates a unique ticket number of the form TKT-YYYYMM-XXXXXX
 * and seeds the messages array with the initial submission.
 *
 * Collisions are prevented by combining a millisecond timestamp with
 * a random suffix. The unique index on `ticketNumber` provides a
 * final safety net.
 */
ticketSchema.pre("validate", function () {
    if (!this.ticketNumber) {
        const now = new Date();
        const yyyymm =
            `${now.getFullYear()}` +
            `${String(now.getMonth() + 1).padStart(2, "0")}`;

        const entropy = Math.random().toString(36).slice(2, 8).toUpperCase();
        const timePart = Date.now().toString(36).toUpperCase().slice(-4);

        this.ticketNumber = `TKT-${yyyymm}-${timePart}${entropy}`;
    }

    if (!this.messages.length && this.message) {
        this.messages.push({
            _id: new Types.ObjectId(),
            author: "user",
            authorId: this.userId || null,
            authorName: this.name,
            body: this.message,
            createdAt: new Date()
        });
    }
});

/* -------------------- Indexes -------------------- */

ticketSchema.index({ status: 1, createdAt: -1 });
ticketSchema.index({ email: 1, createdAt: -1 });
ticketSchema.index({ ip: 1, createdAt: -1 });

export const Ticket = model<ITicket>("Ticket", ticketSchema);

/**
 * Copyright (c) 2026 Sobhan Rasoulzadeh Asl (Sobhan-SRZA / Mr. Sinre)
 *
 * Licensed under the BSD 3-Clause License.
 * See the LICENSE file in the project root for license information.
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */