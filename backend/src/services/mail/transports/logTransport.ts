
import type {
    MailConfig,
    MailTransport,
    SendMailOptions,
    SendMailResult
} from "../types";
import {
    formatAddress,
    normalizeRecipients
} from "../utils";
import crypto from "crypto";

/**
 * Logging-based mail transport for development and testing.
 *
 * This transport does not send emails. Instead, it logs the message
 * metadata and body to the console for inspection.
 */
export const logTransport: MailTransport = {
    name: "log",

    async send(
        opts: SendMailOptions,
        config: MailConfig
    ): Promise<SendMailResult> {
        const messageId = `<log-${Date.now()}-${crypto.randomBytes(4).toString("hex")}@local>`;
        const recipients = normalizeRecipients(opts.to);

        const border = "═".repeat(63);

        console.log("");
        console.log(`╔${border}╗`);
        console.log(
            `║ 📧  EMAIL (LOG MODE — NOT SENT)`.padEnd(64) + "║"
        );
        console.log(`╚${border}╝`);
        console.log(`  From       : ${formatAddress(config.from)}`);
        console.log(
            `  To         : ${recipients.map(formatAddress).join(", ")}`
        );
        console.log(`  Subject    : ${opts.subject}`);
        console.log(`  Message-ID : ${messageId}`);
        console.log(`  Timestamp  : ${new Date().toISOString()}`);
        console.log(`  ${"─".repeat(61)}`);

        // Prefer the plain-text body and fall back to a sanitized HTML version.
        const body = opts.text || stripHtml(opts.html);

        for (const line of body.split("\n")) {
            console.log(`  ${line}`);
        }

        console.log(`  ${"─".repeat(61)}`);
        console.log("");

        return {
            ok: true,
            messageId,
            transport: "log"
        };
    },
};

/**
 * Converts HTML content into plain text for console logging.
 *
 * Removes style and script blocks, converts common structural
 * elements into line breaks, strips remaining HTML tags, and
 * decodes common HTML entities.
 *
 * Note: This is a lightweight text conversion utility, not a
 * full HTML parser.
 */
function stripHtml(html: string): string {
    return html
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/p>/gi, "\n\n")
        .replace(/<\/div>/gi, "\n")
        .replace(/<\/h[1-6]>/gi, "\n\n")
        .replace(/<[^>]+>/g, "")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, "\"")
        .replace(/&#39;/g, "'")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
}

/**
 * Copyright (c) 2026 Sobhan Rasoulzadeh Asl (Sobhan-SRZA / Mr. Sinre)
 *
 * Licensed under the BSD 3-Clause License.
 * See the LICENSE file in the project root for license information.
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */