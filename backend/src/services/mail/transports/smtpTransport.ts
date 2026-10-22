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
import type { Transporter } from "nodemailer";
import nodemailer from "nodemailer";

/* ==================================================================
   Singleton transporter (lazy)
   ================================================================== */
let _transporter: Transporter | null = null;
let _currentConfigHash = "";

function configHash(c: MailConfig): string {
    const s = c.smtp!;

    return `${s.host}:${s.port}:${s.secure}:${s.auth.user}`;
}

function buildTransporter(config: MailConfig): Transporter {
    if (!config.smtp) {
        throw new Error("SMTP config is missing");
    }

    const smtp = config.smtp;

    const transporter = nodemailer.createTransport({
        host: smtp.host,
        port: smtp.port,
        secure: smtp.secure,
        auth: smtp.auth,
        name: process.env.MAIL_HELO_NAME || undefined,

        // TLS hardening
        tls: {
            minVersion: "TLSv1.2",
            rejectUnauthorized: smtp.tls?.rejectUnauthorized !== false
        },

        // timeouts
        connectionTimeout: smtp.connectionTimeout ?? 15000,
        greetingTimeout: smtp.greetingTimeout ?? 15000,
        socketTimeout: smtp.socketTimeout ?? 30000,

        // connection pool
        pool: true,
        maxConnections: 3,
        maxMessages: 100,

        // debug
        logger: smtp.debug ? console : false,
        debug: !!smtp.debug
    });

    return transporter;
}

function getTransporter(config: MailConfig): Transporter {
    const hash = configHash(config);
    if (_transporter && _currentConfigHash === hash) {
        return _transporter;
    }

    _transporter = buildTransporter(config);
    _currentConfigHash = hash;

    return _transporter;
}

/* ==================================================================
   Public verify
   ================================================================== */
export async function verifySmtpTransport(config: MailConfig): Promise<void> {
    const transporter = getTransporter(config);
    await transporter.verify();
}

/* ==================================================================
   SMTP transport
   ================================================================== */
export const smtpTransport: MailTransport = {
    name: "smtp",

    async send(opts: SendMailOptions, config: MailConfig): Promise<SendMailResult> {
        const transporter = getTransporter(config);
        const recipients = normalizeRecipients(opts.to);

        const info = await transporter.sendMail({
            from: formatAddress(config.from),
            to: recipients.map(formatAddress).join(", "),
            subject: opts.subject,
            html: opts.html,
            text: opts.text,
            replyTo: opts.replyTo
                ? formatAddress(
                    typeof opts.replyTo === "string"
                        ? { address: opts.replyTo }
                        : opts.replyTo
                )
                : config.replyTo
                    ? formatAddress(config.replyTo)
                    : undefined,

            headers: opts.headers
        });

        return {
            ok: true,
            messageId: info.messageId,
            transport: "smtp"
        };
    },
};

/* ==================================================================
   پاک‌سازی (برای graceful shutdown)
   ================================================================== */
export function closeSmtpTransport(): void {
    if (_transporter) {
        try {
            _transporter.close();
        } 
        
        catch {
            /* ignore */
        }
        
        _transporter = null;
    }
}

/**
 * Copyright (c) 2026 Sobhan Rasoulzadeh Asl (Sobhan-SRZA / Mr. Sinre)
 *
 * Licensed under the BSD 3-Clause License.
 * See the LICENSE file in the project root for license information.
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */