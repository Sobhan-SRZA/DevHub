
import {
    smtpTransport,
    verifySmtpTransport,
    closeSmtpTransport
} from "./transports/smtpTransport";
import type {
    MailConfig,
    SendMailOptions,
    SendMailResult
} from "./types";
import {
    normalizeRecipients,
    isValidEmail
} from "./utils";
import { logTransport } from "./transports/logTransport";
import { getMailConfig } from "./config";
import { RateLimiter } from "./rateLimiter";
import { ErrorCodes } from "../../utils/errorCodes";
import { AppError } from "../../utils/AppError";

/**
 * Centralized mail service responsible for message validation,
 * recipient-level rate limiting, transport selection, and delivery.
 */
class MailService {
    private rateLimiter = new RateLimiter({
        maxPerWindow: 5,
        windowMs: 60_000
    });

    private config: MailConfig;
    private smtpReady = false;

    constructor() {
        this.config = getMailConfig();
    }

    /**
     * Validates and sends an email using the configured transport.
     *
     * In log mode, messages are written to the console without being sent.
     * In SMTP mode, messages are delivered through the configured mail server.
     *
     * @throws {AppError} If a recipient is invalid, the rate limit is exceeded,
     * or message delivery fails.
     */
    async send(opts: SendMailOptions): Promise<SendMailResult> {
        // Validate the message before processing its recipients.
        this.validate(opts);

        const recipients = normalizeRecipients(opts.to);

        // Enforce rate limits independently for each recipient.
        for (const recipient of recipients) {
            if (!isValidEmail(recipient.address)) {
                throw new AppError(
                    400,
                    ErrorCodes.EMAIL_INVALID,
                    `Invalid email address: ${recipient.address}`
                );
            }

            const check = this.rateLimiter.consume(
                recipient.address.toLowerCase()
            );

            if (!check.ok) {
                const retryAfterSeconds = Math.ceil(
                    (check.retryAfterMs || 60_000) / 1000
                );

                throw new AppError(
                    429,
                    ErrorCodes.TOO_MANY_ATTEMPTS,
                    `Email sending limit exceeded. Please try again in ${retryAfterSeconds} seconds.`
                );
            }
        }

        // Select the transport according to the configured delivery mode.
        const transport =
            this.config.mode === "smtp"
                ? smtpTransport
                : logTransport;

        try {
            const result = await transport.send(opts, this.config);

            if (this.config.mode === "smtp") {
                console.log(
                    `[MAIL] Email sent to ${recipients
                        .map((recipient) => recipient.address)
                        .join(", ")} | Message-ID: ${result.messageId}`
                );
            }

            return result;
        } catch (err: unknown) {
            const error = err as {
                code?: string;
                message?: string;
            };

            console.error("[MAIL] Email delivery failed:", {
                mode: this.config.mode,
                recipients: recipients.map(
                    (recipient) => recipient.address
                ),
                code: error?.code,
                message: error?.message
            });

            // Return a generic error to avoid exposing internal details.
            throw new AppError(
                500,
                ErrorCodes.INTERNAL_ERROR,
                this.config.mode === "smtp"
                    ? "Failed to send the email. Please try again later."
                    : "An error occurred while processing the email."
            );
        }
    }

    /**
     * Validates required message fields and enforces payload size limits.
     *
     * @throws {Error} If required fields are missing or exceed their limits.
     */
    private validate(opts: SendMailOptions): void {
        if (!opts.to) {
            throw new Error("Mail recipient is required.");
        }

        if (!opts.subject) {
            throw new Error("Mail subject is required.");
        }

        if (!opts.html) {
            throw new Error("HTML email body is required.");
        }

        if (opts.subject.length > 200) {
            throw new Error(
                "Mail subject exceeds the maximum length of 200 characters."
            );
        }

        if (opts.html.length > 500_000) {
            throw new Error(
                "HTML email body exceeds the maximum size of 500 KB."
            );
        }
    }

    /**
     * Verifies SMTP connectivity during application startup.
     *
     * Verification is skipped when log mode is enabled or the connection
     * has already been verified successfully.
     */
    async verifyOnStartup(): Promise<void> {
        if (this.config.mode !== "smtp" || this.smtpReady) {
            return;
        }

        try {
            await verifySmtpTransport(this.config);
            this.smtpReady = true;

            console.log("[MAIL] SMTP connection verified successfully.");
        } catch (err: unknown) {
            const error = err as { message?: string };

            console.error(
                "[MAIL] SMTP verification failed:",
                error?.message || error
            );

            // Optionally terminate startup when SMTP availability is mandatory.
            if (process.env.MAIL_FAIL_FAST === "true") {
                process.exit(1);
            }
        }
    }

    /**
     * Releases rate-limiter resources and closes SMTP connections.
     *
     * Intended to be called during graceful application shutdown.
     */
    shutdown(): void {
        this.rateLimiter.dispose();
        closeSmtpTransport();
    }
}

/**
 * Shared mail service instance used throughout the application.
 */
export const mailer = new MailService();

/**
 * Copyright (c) 2026 Sobhan Rasoulzadeh Asl (Sobhan-SRZA / Mr. Sinre)
 *
 * Licensed under the BSD 3-Clause License.
 * See the LICENSE file in the project root for license information.
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */