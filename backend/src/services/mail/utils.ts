import type {
    MailAddress,
    SendMailOptions
} from "./types";

/* ==================================================================
   HTML escape
   ================================================================== */
export function escapeHtml(s: unknown): string {
    if (s === null || s === undefined) return "";
    return String(s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/"/g, "&#39;");
}

/* ==================================================================
   Address normalization
   ================================================================== */
export function normalizeAddress(addr: MailAddress | string): MailAddress {
    if (typeof addr === "string") {
        return { address: addr.trim() };
    }

    return { name: addr.name, address: addr.address.trim() };
}

export function normalizeRecipients(
    to: SendMailOptions["to"]
): MailAddress[] {
    if (typeof to === "string")
        return [{ address: to }];

    if (Array.isArray(to))
        return to.map(normalizeAddress);

    return [normalizeAddress(to)];
}

/* ==================================================================
   RFC 5322 formatting: "Name" <email@example.com>
   ================================================================== */
export function formatAddress(addr: MailAddress): string {
    if (!addr.name)
        return addr.address;

    // نویسه‌های خطرناک رو پاک کن
    const safe = String(addr.name).replace(/["\\<>]/g, "").trim();

    if (!safe)
        return addr.address;

    // اگه نویسه غیر-ASCII داشت، encode کن
    if (/[^\x20-\x7E]/.test(safe)) {
        const encoded = `=?UTF-8?B?${Buffer.from(safe, "utf8").toString("base64")}?=`;

        return `${encoded} <${addr.address}>`;
    }

    return `"${safe}" <${addr.address}>`;
}

/* ==================================================================
   Email regex (RFC 5322 simplified)
   ================================================================== */
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