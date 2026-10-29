
import {
    otpEmailTemplate,
    type OtpPurpose
} from "./otpTemplate";
import type { SendMailResult } from "../types";
import { mailer } from "../mailService";

export interface SendOtpOptions {
    to: string;
    code: string;
    purpose: OtpPurpose;
    expiresInMinutes: number;
    userName?: string;
    ip?: string;
}

/**
 * Generates and sends a one-time password (OTP) email.
 */
export async function sendOtpEmail(
    opts: SendOtpOptions
): Promise<SendMailResult> {
    const { subject, html, text } = otpEmailTemplate({
        code: opts.code,
        purpose: opts.purpose,
        expiresInMinutes: opts.expiresInMinutes,
        userName: opts.userName,
        ip: opts.ip
    });

    return mailer.send({
        to: opts.to,
        subject,
        html,
        text
    });
}

/**
 * Copyright (c) 2026 Sobhan Rasoulzadeh Asl (Sobhan-SRZA / Mr. Sinre)
 *
 * Licensed under the BSD 3-Clause License.
 * See the LICENSE file in the project root for license information.
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */