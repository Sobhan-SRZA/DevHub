import type { MailConfig } from "./types";
import dotenv from "dotenv";
import path from "path";

// Load .env file from the project root
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

/* ==================================================================
   خواندن و اعتبارسنجی env
   ================================================================== */
function loadMailConfig(): MailConfig {
    const rawMode = (process.env.MAIL_MODE || "log").toLowerCase().trim();

    if (rawMode !== "log" && rawMode !== "smtp") {
        throw new Error(
            `MAIL_MODE نامعتبر: "${rawMode}". مقدار مجاز: log | smtp`
        );
    }

    const mode = rawMode as "log" | "smtp";

    const fromName = (process.env.MAIL_FROM_NAME || "App").trim();
    const fromAddress = (process.env.MAIL_FROM_ADDRESS || "noreply@localhost").trim();

    if (!fromAddress) {
        throw new Error("MAIL_FROM_ADDRESS الزامی است");
    }

    const config: MailConfig = {
        mode,
        from: { name: fromName, address: fromAddress }
    };

    const replyTo = process.env.MAIL_REPLY_TO?.trim();
    if (replyTo) {
        config.replyTo = { address: replyTo };
    }

    /* ---------- SMTP ---------- */
    if (mode === "smtp") {
        const host = process.env.SMTP_HOST?.trim();
        const user = process.env.SMTP_USER?.trim();
        const pass = process.env.SMTP_PASS;
        const portRaw = process.env.SMTP_PORT || "587";
        const port = parseInt(portRaw, 10);

        if (!host)
             throw new Error("SMTP_HOST الزامی است (MAIL_MODE=smtp)");

        if (!user)
             throw new Error("SMTP_USER الزامی است (MAIL_MODE=smtp)");

        if (!pass) 
            throw new Error("SMTP_PASS الزامی است (MAIL_MODE=smtp)");

        if (!Number.isFinite(port) || port < 1 || port > 65535) {
            throw new Error(`SMTP_PORT نامعتبر: "${portRaw}"`);
        }

        // پورت 465 = SMTPS (implicit TLS)، بقیه = STARTTLS
        const secure =
            process.env.SMTP_SECURE === "true" || port === 465;

        const connectionTimeout = parseInt(
            process.env.SMTP_TIMEOUT_MS || "15000",
            10
        );

        const tls: MailConfig["smtp"] = undefined as any;

        config.smtp = {
            host,
            port,
            secure,
            auth: { user, pass },
            connectionTimeout,
            greetingTimeout: connectionTimeout,
            socketTimeout: 30000,
            debug: process.env.MAIL_DEBUG === "true"
        };

        // TLS — به‌طور پیش‌فرض تأیید گواهی الزامی
        if (process.env.SMTP_ALLOW_INSECURE === "true") {
            config.smtp.tls = { rejectUnauthorized: false };
            console.warn(
                "⚠️  [MAIL] SMTP_ALLOW_INSECURE=true — گواهی TLS تأیید نمی‌شود. " +
                "فقط برای dev استفاده کنید."
            );
        }

        console.log(
            `📧 [MAIL] SMTP mode: ${host}:${port} ` +
            `(${secure ? "SMTPS" : "STARTTLS"}) as ${user}`
        );
    }
    
    else {
        console.log(
            `📧 [MAIL] log mode — ایمیل‌ها در کنسول چاپ می‌شوند ` +
            `(برای ارسال واقعی: MAIL_MODE=smtp)`
        );
    }

    return config;
}

/* ==================================================================
   Singleton
   ================================================================== */
let _cached: MailConfig | null = null;

export function getMailConfig(): MailConfig {
    if (!_cached) 
        _cached = loadMailConfig();

    return _cached;
}

/** برای تست */
export function _resetMailConfigCache() {
    _cached = null;
}

/**
 * Copyright (c) 2026 Sobhan Rasoulzadeh Asl (Sobhan-SRZA / Mr. Sinre)
 *
 * Licensed under the BSD 3-Clause License.
 * See the LICENSE file in the project root for license information.
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */