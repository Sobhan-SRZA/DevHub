
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

/**
 * Maintains a lazily initialized SMTP transporter.
 *
 * The transporter is reused while the relevant SMTP configuration
 * remains unchanged, reducing unnecessary connection setup overhead.
 */
let _transporter: Transporter | null = null;
let _currentConfigHash = "";

/**
 * Generates a fingerprint from the SMTP settings used to identify
 * the current transporter configuration.
 */
function configHash(config: MailConfig): string {
    const smtp = config.smtp!;

    return `${smtp.host}:${smtp.port}:${smtp.secure}:${smtp.auth.user}`;
}

/**
 * Creates a Nodemailer transporter with secure TLS defaults,
 * configurable timeouts, connection pooling, and optional debugging.
 */
function buildTransporter(config: MailConfig): Transporter {
    if (!config.smtp) {
        throw new Error("SMTP configuration is missing.");
    }

    const smtp = config.smtp;

    return nodemailer.createTransport({
        host: smtp.host,
        port: smtp.port,
        secure: smtp.secure,
        auth: smtp.auth,
        name: process.env.MAIL_HELO_NAME || undefined,

        // Enforce TLS 1.2 or later and validate certificates by default.
        tls: {
            minVersion: "TLSv1.2",
            rejectUnauthorized: smtp.tls?.rejectUnauthorized !== false
        },

        // Configure connection, greeting, and socket timeouts.
        connectionTimeout: smtp.connectionTimeout ?? 15000,
        greetingTimeout: smtp.greetingTimeout ?? 15000,
        socketTimeout: smtp.socketTimeout ?? 30000,

        // Reuse SMTP connections to improve throughput.
        pool: true,
        maxConnections: 3,
        maxMessages: 100,

        // Enable Nodemailer diagnostics only when explicitly configured.
        logger: smtp.debug ? console : false,
        debug: !!smtp.debug
    });
}

/**
 * Returns the existing transporter when its configuration matches;
 * otherwise, creates and caches a new transporter.
 */
function getTransporter(config: MailConfig): Transporter {
    const hash = configHash(config);

    if (_transporter && _currentConfigHash === hash) {
        return _transporter;
    }

    // Close the previous transport before replacing it to avoid
    // leaving its pooled SMTP connections open.
    if (_transporter) {
        _transporter.close();
    }

    _transporter = buildTransporter(config);
    _currentConfigHash = hash;

    return _transporter;
}

/**
 * Verifies SMTP connectivity and authentication using the configured
 * transporter. Throws if the connection cannot be established.
 */
export async function verifySmtpTransport(
    config: MailConfig
): Promise<void> {
    const transporter = getTransporter(config);
    await transporter.verify();
}

/**
 * SMTP mail transport implementation.
 *
 * Sends messages through the configured SMTP server and returns
 * the resulting message identifier.
 */
export const smtpTransport: MailTransport = {
    name: "smtp",

    async send(
        opts: SendMailOptions,
        config: MailConfig
    ): Promise<SendMailResult> {
        const transporter = getTransporter(config);
        const recipients = normalizeRecipients(opts.to);

        const info = await transporter.sendMail({
            from: formatAddress(config.from),
            to: recipients.map(formatAddress).join(", "),
            subject: opts.subject,
            html: opts.html,
            text: opts.text,

            // Prefer the message-specific reply address over the
            // configured default when one is explicitly provided.
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

/**
 * Closes the SMTP transport and releases pooled connections.
 *
 * Intended for graceful application shutdown.
 */
export function closeSmtpTransport(): void {
    if (_transporter) {
        _transporter.close();
        _transporter = null;
        _currentConfigHash = "";
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