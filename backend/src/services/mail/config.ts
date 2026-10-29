
import type { MailConfig } from "./types";

/**
 * Loads and validates the mail configuration from environment variables.
 *
 * Supports logging and SMTP delivery modes. SMTP-specific settings
 * are validated only when SMTP mode is enabled.
 *
 * @throws {Error} If the configuration contains invalid or missing values.
 */
function loadMailConfig(): MailConfig {
    const rawMode = (process.env.MAIL_MODE || "log").toLowerCase().trim();

    if (rawMode !== "log" && rawMode !== "smtp") {
        throw new Error(
            `Invalid MAIL_MODE: "${rawMode}". Allowed values: log | smtp`
        );
    }

    const mode = rawMode as "log" | "smtp";

    const fromName = (process.env.MAIL_FROM_NAME || "App").trim();
    const fromAddress = (process.env.MAIL_FROM_ADDRESS || "noreply@localhost").trim();

    if (!fromAddress) {
        throw new Error("MAIL_FROM_ADDRESS is required.");
    }

    const config: MailConfig = {
        mode,
        from: {
            name: fromName,
            address: fromAddress
        }
    };

    const replyTo = process.env.MAIL_REPLY_TO?.trim();

    if (replyTo) {
        config.replyTo = { address: replyTo };
    }

    // Configure SMTP settings only when SMTP delivery is enabled.
    if (mode === "smtp") {
        const host = process.env.SMTP_HOST?.trim();
        const user = process.env.SMTP_USER?.trim();
        const pass = process.env.SMTP_PASS;
        const portRaw = process.env.SMTP_PORT || "587";
        const port = Number(portRaw);

        if (!host) {
            throw new Error("SMTP_HOST is required when MAIL_MODE=smtp.");
        }

        if (!user) {
            throw new Error("SMTP_USER is required when MAIL_MODE=smtp.");
        }

        if (!pass) {
            throw new Error("SMTP_PASS is required when MAIL_MODE=smtp.");
        }

        if (!Number.isInteger(port) || port < 1 || port > 65535) {
            throw new Error(`Invalid SMTP_PORT: "${portRaw}".`);
        }

        // Port 465 uses implicit TLS; other ports typically use STARTTLS.
        const secure =
            process.env.SMTP_SECURE === "true" || port === 465;

        const connectionTimeout = Number(
            process.env.SMTP_TIMEOUT_MS || "15000"
        );

        if (!Number.isInteger(connectionTimeout) || connectionTimeout < 1) {
            throw new Error("SMTP_TIMEOUT_MS must be a positive integer.");
        }

        config.smtp = {
            host,
            port,
            secure,
            auth: {
                user,
                pass
            },
            connectionTimeout,
            greetingTimeout: connectionTimeout,
            socketTimeout: 30000,
            debug: process.env.MAIL_DEBUG === "true"
        };

        // Certificate validation remains enabled unless explicitly disabled.
        if (process.env.SMTP_ALLOW_INSECURE === "true") {
            config.smtp.tls = { rejectUnauthorized: false };

            console.warn(
                "[MAIL] WARNING: SMTP_ALLOW_INSECURE=true. " +
                "TLS certificate validation is disabled. " +
                "Use this setting only in development environments."
            );
        }

        console.log(
            `[MAIL] SMTP mode enabled: ${host}:${port} ` +
            `(${secure ? "SMTPS" : "STARTTLS"}) as ${user}`
        );
    } else {
        console.log(
            "[MAIL] Log mode enabled. Emails will be written to the console. " +
            "Set MAIL_MODE=smtp to enable actual email delivery."
        );
    }

    return config;
}

/**
 * Cached mail configuration instance.
 *
 * The configuration is loaded once and reused for subsequent requests.
 */
let _cached: MailConfig | null = null;

/**
 * Returns the cached mail configuration, loading it on first access.
 */
export function getMailConfig(): MailConfig {
    if (!_cached) {
        _cached = loadMailConfig();
    }

    return _cached;
}

/**
 * Clears the cached configuration.
 *
 * Intended for tests that need to reload configuration from
 * updated environment variables.
 */
export function _resetMailConfigCache(): void {
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