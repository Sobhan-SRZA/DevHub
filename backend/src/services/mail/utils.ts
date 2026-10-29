
import type {
    MailAddress,
    SendMailOptions
} from "./types";

/**
 * Escapes HTML-sensitive characters to prevent markup injection.
 */
export function escapeHtml(value: unknown): string {
    if (value === null || value === undefined) {
        return "";
    }

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

/**
 * Normalizes an email address into a consistent representation.
 *
 * String inputs are converted to address objects, and surrounding
 * whitespace is removed from email addresses.
 */
export function normalizeAddress(
    address: MailAddress | string
): MailAddress {
    if (typeof address === "string") {
        return { address: address.trim() };
    }

    return {
        name: address.name,
        address: address.address.trim()
    };
}

/**
 * Normalizes a recipient value into an array of email addresses.
 *
 * Supports a single address string, a single address object,
 * or an array containing multiple recipients.
 */
export function normalizeRecipients(
    to: SendMailOptions["to"]
): MailAddress[] {
    if (typeof to === "string") {
        return [{ address: to.trim() }];
    }

    if (Array.isArray(to)) {
        return to.map(normalizeAddress);
    }

    return [normalizeAddress(to)];
}

/**
 * Formats an email address with an optional display name.
 *
 * ASCII display names are quoted and sanitized. Non-ASCII display
 * names are encoded using UTF-8 Base64 encoded-word syntax.
 */
export function formatAddress(address: MailAddress): string {
    if (!address.name) {
        return address.address;
    }

    // Remove characters that could interfere with address formatting.
    const safeName = String(address.name)
        .replace(/["\\<>]/g, "")
        .trim();

    if (!safeName) {
        return address.address;
    }

    // Encode non-ASCII display names for email header compatibility.
    if (/[^\x20-\x7E]/.test(safeName)) {
        const encodedName = `=?UTF-8?B?${Buffer.from(
            safeName,
            "utf8"
        ).toString("base64")}?=`;

        return `${encodedName} <${address.address}>`;
    }

    return `"${safeName}" <${address.address}>`;
}

/**
 * Performs basic email address validation using a simplified pattern.
 *
 * This check is intended for preliminary input validation and does
 * not guarantee that an address exists or can receive email.
 */
export function isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

/**
 * Copyright (c) 2026 Sobhan Rasoulzadeh Asl (Sobhan-SRZA / Mr. Sinre)
 *
 * Licensed under the BSD 3-Clause License.
 * See the LICENSE file in the project root for license information.
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */