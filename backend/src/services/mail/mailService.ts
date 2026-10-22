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

/* ==================================================================
   MailService
   ================================================================== */
class MailService {
    private rateLimiter = new RateLimiter({
        maxPerWindow: 5,           // ۵ ایمیل
        windowMs: 60_000          // در ۱ دقیقه (per recipient)
    });

    private config: MailConfig;
    private smtpReady = false;

    constructor() {
        this.config = getMailConfig();
    }

    /**
     * ارسال یک ایمیل. اگه mode=log باشه، فقط چاپ می‌شه.
     * اگه mode=smtp باشه، واقعاً ارسال می‌شه.
     */
    async send(opts: SendMailOptions): Promise<SendMailResult> {
        // 1) اعتبارسنجی
        this.validate(opts);

        const recipients = normalizeRecipients(opts.to);

        // 2) rate limit per recipient
        for (const r of recipients) {
            if (!isValidEmail(r.address)) {
                throw new AppError(
                    400,
                    ErrorCodes.EMAIL_INVALID,
                    `ایمیل نامعتبر: ${r.address}`
                );
            }

            const check = this.rateLimiter.consume(r.address.toLowerCase());
            if (!check.ok) {
                const sec = Math.ceil((check.retryAfterMs || 60_000) / 1000);

                throw new AppError(
                    429,
                    ErrorCodes.TOO_MANY_ATTEMPTS,
                    `ایمیل بیش از حد ارسال شده. ${sec} ثانیه دیگر تلاش کنید`
                );
            }
        }

        // 3) انتخاب transport
        const transport = this.config.mode === "smtp" ? smtpTransport : logTransport;

        // 4) ارسال
        try {
            const result = await transport.send(opts, this.config);

            if (this.config.mode === "smtp") {
                console.log(
                    `📧 [MAIL] sent → ${recipients.map((r) => r.address).join(", ")}` +
                    ` | id: ${result.messageId}`
                );
            }

            return result;
        }

        catch (err: any) {
            console.error("🔴 [MAIL] send failed:", {
                mode: this.config.mode,
                to: recipients.map((r) => r.address),
                code: err?.code,
                message: err?.message
            });

            // پیام عمومی — جزئیات داخلی لو نره
            throw new AppError(
                500,
                ErrorCodes.INTERNAL_ERROR,
                this.config.mode === "smtp"
                    ? "ارسال ایمیل ناموفق بود. لطفاً دوباره تلاش کنید"
                    : "خطا در ارسال ایمیل"
            );
        }
    }

    private validate(opts: SendMailOptions) {
        if (!opts.to)
            throw new Error("mail: to is required");

        if (!opts.subject)
            throw new Error("mail: subject is required");

        if (!opts.html)
            throw new Error("mail: html body is required");

        if (opts.subject.length > 200) {
            throw new Error("mail: subject too long (max 200 chars)");
        }

        if (opts.html.length > 500_000) {
            throw new Error("mail: html too large (max 500KB)");
        }
    }

    /**
     * اطمینان از آمادگی SMTP (فقط بار اول)
     */
    async verifyOnStartup(): Promise<void> {
        if (this.config.mode !== "smtp")
            return;

        if (this.smtpReady)
            return;

        try {
            await verifySmtpTransport(this.config);
            this.smtpReady = true;
            console.log("✅ [MAIL] SMTP connection verified");
        }

        catch (err: any) {
            console.error("❌ [MAIL] SMTP verify failed:", err?.message || err);
            if (process.env.MAIL_FAIL_FAST === "true") {
                process.exit(1);
            }
        }
    }

    /**
     * برای graceful shutdown
     */
    shutdown(): void {
        this.rateLimiter.dispose();

        closeSmtpTransport();
    }
}

/* ==================================================================
   Singleton
   ================================================================== */
export const mailer = new MailService();

/**
 * Copyright (c) 2026 Sobhan Rasoulzadeh Asl (Sobhan-SRZA / Mr. Sinre)
 *
 * Licensed under the BSD 3-Clause License.
 * See the LICENSE file in the project root for license information.
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */