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

/* ==================================================================
   LOG transport — ارسال واقعی نمی‌کنه، فقط چاپ می‌کنه
   ================================================================== */
export const logTransport: MailTransport = {
    name: "log",

    async send(opts: SendMailOptions, config: MailConfig): Promise<SendMailResult> {
        const messageId = `<log-${Date.now()}-${crypto.randomBytes(4).toString("hex")}@local>`;
        const recipients = normalizeRecipients(opts.to);

        const line = "═".repeat(63);

        console.log("");
        console.log(`╔${line}╗`);
        console.log(
            `║ 📧  EMAIL (LOG MODE — NOT SENT)`.padEnd(64) + "║"
        );
        console.log(`╚${line}╝`);
        console.log(`  From       : ${formatAddress(config.from)}`);
        console.log(
            `  To         : ${recipients.map(formatAddress).join(", ")}`
        );
        console.log(`  Subject    : ${opts.subject}`);
        console.log(`  Message-ID : ${messageId}`);
        console.log(`  Time       : ${new Date().toISOString()}`);
        console.log(`  ${"─".repeat(61)}`);

        // بدنه (text)
        const body = opts.text || stripHtml(opts.html);
        for (const rawLine of body.split("\n")) {
            console.log(`  ${rawLine}`);
        }

        console.log(`  ${"─".repeat(61)}`);
        console.log("");

        return { ok: true, messageId, transport: "log" };
    },
};

/* ==================================================================
   HTML → plain text (fallback برای log)
   ================================================================== */
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