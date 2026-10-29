
import { VerificationPurpose } from "../../../models/VerificationCode";
import { escapeHtml } from "../utils";

/* ==========================================================================
 * Verification Purpose Metadata
 * ========================================================================== */

type OtpPurpose = VerificationPurpose;

interface OtpPurposeMetadata {
    title: string;
    description: string;
    emoji: string;
}

const PURPOSE_META: Record<OtpPurpose, OtpPurposeMetadata> = {
    verify_email: {
        title: "Email Verification",
        description:
            "Please verify your email address to complete the registration process.",
        emoji: "📧",
    },
    change_password: {
        title: "Password Change",
        description:
            "A password change request has been initiated for your account. Enter the code below on the settings page to proceed.",
        emoji: "🔐",
    },
    change_email_old: {
        title: "Current Email Verification",
        description:
            "Please verify your current email address before proceeding with the email change.",
        emoji: "📧",
    },
    change_email_new: {
        title: "New Email Verification",
        description:
            "An email change request has been initiated for your account. Enter the code below to verify your new email address.",
        emoji: "✉️",
    },
    login_2fa: {
        title: "Two-Factor Authentication",
        description:
            "Enter the code below to complete the sign-in process for your account.",
        emoji: "🔑",
    },
    reset_password: {
        title: "Password Recovery",
        description:
            "Use the verification code below to recover access to your account.",
        emoji: "🔄",
    },
};

/* ==========================================================================
 * Template Options
 * ========================================================================== */

export interface OtpTemplateOptions {
    code: string;
    purpose: OtpPurpose;
    expiresInMinutes: number;
    userName?: string;
    ip?: string;
}

/* ==========================================================================
 * OTP Email Template
 * ========================================================================== */

/**
 * Generates an HTML and plain-text email template for one-time passwords.
 *
 * All user-provided values are escaped before being interpolated into HTML
 * to prevent HTML injection. The plain-text version contains readable
 * content suitable for email clients that do not support HTML.
 *
 * @param options - OTP details and optional recipient information.
 * @returns The email subject, HTML body, and plain-text body.
 */
export function otpEmailTemplate(options: OtpTemplateOptions) {
    const {
        code,
        purpose,
        expiresInMinutes,
        userName,
        ip,
    } = options;

    const metadata = PURPOSE_META[purpose] ?? PURPOSE_META.change_password;

    const safeCode = escapeHtml(code);
    const safeName = userName ? escapeHtml(userName) : "";
    const safeIp = ip ? escapeHtml(ip) : "";

    const subject = `${metadata.title} — ${code}`;

    /* ==========================================================================
     * HTML Email
     * ========================================================================== */

    const html = `<!DOCTYPE html>
<html lang="en" dir="ltr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${metadata.title}</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,'Segoe UI',sans-serif;direction:ltr;text-align:left;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f3f4f6;padding:40px 20px;">
        <tr>
            <td align="center">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
                       style="max-width:560px;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

                    <!-- Header -->
                    <tr>
                        <td style="background:linear-gradient(135deg,#007bff 0%,#6ebbff 100%);padding:32px 24px;text-align:center;">
                            <div style="font-size:40px;line-height:1;margin-bottom:8px;">${metadata.emoji}</div>
                            <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;">${metadata.title}</h1>
                        </td>
                    </tr>

                    <!-- Email Body -->
                    <tr>
                        <td style="padding:32px 28px;color:#1f2937;font-size:15px;line-height:1.85;">
                            ${safeName
            ? `<p style="margin:0 0 12px;">Hello <strong>${safeName}</strong>,</p>`
            : `<p style="margin:0 0 12px;">Hello,</p>`
        }

                            <p style="margin:0 0 26px;color:#4b5563;">${metadata.description}</p>

                            <!-- Verification Code -->
                            <div style="text-align:center;margin:32px 0;">
                                <div style="display:inline-block;background:#f0f7ff;border:2px dashed #007bff;border-radius:12px;padding:22px 44px;">
                                    <div style="font-family:'Courier New',Consolas,monospace;
                                                font-size:38px;font-weight:700;letter-spacing:10px;
                                                color:#007bff;direction:ltr;line-height:1;">
                                        ${safeCode}
                                    </div>
                                </div>
                            </div>

                            <!-- Expiration Notice -->
                            <div style="background:#fef3c7;border-left:4px solid #f59e0b;border-radius:6px;padding:12px 16px;margin:24px 0;">
                                <p style="margin:0;color:#92400e;font-size:13px;line-height:1.7;">
                                    ⏱️ This code expires in <strong>${expiresInMinutes} minutes</strong>.
                                </p>
                            </div>

                            <!-- Security Notice -->
                            <div style="background:#fee2e2;border-left:4px solid #ef4444;border-radius:6px;padding:12px 16px;margin:24px 0;">
                                <p style="margin:0;color:#991b1b;font-size:13px;line-height:1.75;">
                                    🔒 <strong>Never share this code with anyone.</strong><br>
                                    Our staff will never ask you for your verification code.
                                </p>
                            </div>

                            ${safeIp
            ? `<p style="margin:24px 0 0;color:#6b7280;font-size:12px;">
                                    🌐 Request IP address:
                                    <code style="background:#f3f4f6;padding:2px 8px;border-radius:4px;direction:ltr;display:inline-block;font-family:Consolas,monospace;">
                                        ${safeIp}
                                    </code>
                                </p>`
            : ""
        }

                            <p style="margin:24px 0 0;color:#6b7280;font-size:12px;line-height:1.75;">
                                If you did not initiate this request, you can safely ignore this email.
                                If you suspect unauthorized access, consider changing your password.
                            </p>
                        </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                        <td style="background:#f9fafb;padding:20px 24px;text-align:center;border-top:1px solid #e5e7eb;">
                            <p style="margin:0;color:#9ca3af;font-size:11px;line-height:1.6;">
                                This email was sent automatically. Please do not reply to this message.
                            </p>
                        </td>
                    </tr>

                </table>
            </td>
        </tr>
    </table>
</body>
</html>`;

    /* ==========================================================================
     * Plain-Text Email
     * ========================================================================== */

    const text = [
        `${metadata.emoji}  ${metadata.title}`,
        "=".repeat(45),
        "",
        userName ? `Hello ${userName},` : "Hello,",
        "",
        metadata.description,
        "",
        `Your verification code: ${code}`,
        "",
        `This code expires in ${expiresInMinutes} minutes.`,
        safeIp ? `Request IP address: ${ip}` : "",
        "",
        "-".repeat(45),
        "SECURITY NOTICE",
        "Never share this code with anyone.",
        "Our staff will never ask you for your verification code.",
        "",
        "If you did not initiate this request, you can safely ignore this email.",
        "-".repeat(45),
    ]
        .filter((line) => line !== null && line !== undefined)
        .join("\n")
        .trim();

    return {
        subject,
        html,
        text,
    };
}

export type { OtpPurpose };

/**
 * Copyright (c) 2026 Sobhan Rasoulzadeh Asl (Sobhan-SRZA / Mr. Sinre)
 *
 * Licensed under the BSD 3-Clause License.
 * See the LICENSE file in the project root for license information.
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */