export interface MailAddress {
    name?: string;
    address: string;
}

export interface SendMailOptions {
    to: MailAddress | MailAddress[] | string;
    subject: string;
    html: string;
    text?: string;
    replyTo?: MailAddress | string;
    headers?: Record<string, string>;
}

export interface SendMailResult {
    ok: true;
    messageId: string;
    transport: "log" | "smtp";
}

export interface SmtpConfig {
    host: string;
    port: number;
    secure: boolean;
    auth: { user: string; pass: string };
    connectionTimeout?: number;
    greetingTimeout?: number;
    socketTimeout?: number;
    tls?: { rejectUnauthorized?: boolean };
    debug?: boolean;
}

export interface MailConfig {
    mode: "log" | "smtp";
    from: MailAddress;
    replyTo?: MailAddress;
    smtp?: SmtpConfig;
}

export interface MailTransport {
    name: "log" | "smtp";
    send(opts: SendMailOptions, config: MailConfig): Promise<SendMailResult>;
}

/**
 * Copyright (c) 2026 Sobhan Rasoulzadeh Asl (Sobhan-SRZA / Mr. Sinre)
 *
 * Licensed under the BSD 3-Clause License.
 * See the LICENSE file in the project root for license information.
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */