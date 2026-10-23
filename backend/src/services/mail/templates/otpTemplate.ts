import { VerificationPurpose } from "../../../models/VerificationCode";
import { escapeHtml } from "../utils";

/* ==================================================================
   Purpose map
   ================================================================== */
type OtpPurpose = VerificationPurpose;

const PURPOSE_META: Record<OtpPurpose, {
    title: string;
    desc: string;
    emoji: string;
}> = {
    verify_email: {
        title: "تایید ایمیل",
        desc: "برای ادامه فرایند ثبت نام، ابتدا ایمیل شما باید تایید شود.",
        emoji: "📧"
    },
    change_password: {
        title: "تغییر رمز عبور",
        desc: "درخواست تغییر رمز عبور حساب شما ثبت شده است. برای اعمال رمز جدید، کد زیر را در صفحه تنظیمات وارد کنید.",
        emoji: "🔐"
    },
    change_email_old: {
        title: "تایید ایمیل فعلی",
        desc: "برای ادامه فرایند تغییر ایمیل، ابتدا ایمیل فعلی شما باید تایید شود.",
        emoji: "📧"
    },
    change_email_new: {
        title: "تایید ایمیل جدید",
        desc: "درخواست تغییر ایمیل حساب شما ثبت شده است. برای تایید، کد زیر را وارد کنید.",
        emoji: "✉️"
    },
    login_2fa: {
        title: "کد ورود دو مرحله‌ای",
        desc: "برای ورود به حساب کاربری خود، کد زیر را وارد کنید.",
        emoji: "🔑"
    },
    reset_password: {
        title: "بازیابی رمز عبور",
        desc: "کد بازیابی رمز عبور حساب شما در زیر آمده است.",
        emoji: "🔄"
    }
};

/* ==================================================================
   Types
   ================================================================== */
export interface OtpTemplateOptions {
    code: string;
    purpose: OtpPurpose;
    expiresInMinutes: number;
    userName?: string;
    ip?: string;
}

/* ==================================================================
   Main template
   ================================================================== */
export function otpEmailTemplate(opts: OtpTemplateOptions) {
    const { code, purpose, expiresInMinutes, userName, ip } = opts;
    const meta = PURPOSE_META[purpose] || PURPOSE_META.change_password;

    const safeCode = escapeHtml(code);
    const safeName = userName ? escapeHtml(userName) : "";
    const safeIp = ip ? escapeHtml(ip) : "";
    const subject = `${meta.title} — ${code}`;

    /* ============================================================
       HTML
       ============================================================ */
    const html = `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${meta.title}</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Tahoma,"Segoe UI",Arial,sans-serif;direction:rtl;text-align:right;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f3f4f6;padding:40px 20px;">
        <tr>
            <td align="center">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
                       style="max-width:560px;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

                    <!-- HEADER -->
                    <tr>
                        <td style="background:linear-gradient(135deg,#007bff 0%,#6ebbff 100%);padding:32px 24px;text-align:center;">
                            <div style="font-size:40px;line-height:1;margin-bottom:8px;">${meta.emoji}</div>
                            <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;">${meta.title}</h1>
                        </td>
                    </tr>

                    <!-- BODY -->
                    <tr>
                        <td style="padding:32px 28px;color:#1f2937;font-size:15px;line-height:1.85;">
                            ${safeName
            ? `<p style="margin:0 0 12px;">سلام <strong>${safeName}</strong> عزیز،</p>`
            : `<p style="margin:0 0 12px;">سلام،</p>`
        }

                            <p style="margin:0 0 26px;color:#4b5563;">${meta.desc}</p>

                            <!-- CODE -->
                            <div style="text-align:center;margin:32px 0;">
                                <div style="display:inline-block;background:#f0f7ff;border:2px dashed #007bff;border-radius:12px;padding:22px 44px;">
                                    <div style="font-family:"Courier New",Consolas,monospace;
                                                font-size:38px;font-weight:700;letter-spacing:10px;
                                                color:#007bff;direction:ltr;padding-left:10px;line-height:1;">
                                        ${safeCode}
                                    </div>
                                </div>
                            </div>

                            <!-- EXPIRY -->
                            <div style="background:#fef3c7;border-right:4px solid #f59e0b;border-radius:6px;padding:12px 16px;margin:24px 0;">
                                <p style="margin:0;color:#92400e;font-size:13px;line-height:1.7;">
                                    ⏱️ این کد تا <strong>${expiresInMinutes} دقیقه</strong> اعتبار دارد.
                                </p>
                            </div>

                            <!-- SECURITY -->
                            <div style="background:#fee2e2;border-right:4px solid #ef4444;border-radius:6px;padding:12px 16px;margin:24px 0;">
                                <p style="margin:0;color:#991b1b;font-size:13px;line-height:1.75;">
                                    🔒 <strong>هرگز این کد را با کسی به اشتراک نگذارید.</strong><br>
                                    کارمندان ما هرگز از شما کد تایید نمی‌خواهند.
                                </p>
                            </div>

                            ${safeIp
            ? `<p style="margin:24px 0 0;color:#6b7280;font-size:12px;">
                                    🌐 درخواست از IP:
                                    <code style="background:#f3f4f6;padding:2px 8px;border-radius:4px;direction:ltr;display:inline-block;font-family:Consolas,monospace;">
                                        ${safeIp}
                                    </code>
                                </p>`
            : ""
        }

                            <p style="margin:24px 0 0;color:#6b7280;font-size:12px;line-height:1.75;">
                                اگر این درخواست را شما نداده‌اید، این ایمیل را نادیده بگیرید
                                و در صورت نگرانی رمز عبور خود را تغییر دهید.
                            </p>
                        </td>
                    </tr>

                    <!-- FOOTER -->
                    <tr>
                        <td style="background:#f9fafb;padding:20px 24px;text-align:center;border-top:1px solid #e5e7eb;">
                            <p style="margin:0;color:#9ca3af;font-size:11px;line-height:1.6;">
                                این ایمیل به‌صورت خودکار ارسال شده است — لطفاً به آن پاسخ ندهید.
                            </p>
                        </td>
                    </tr>

                </table>
            </td>
        </tr>
    </table>
</body>
</html>`;

    /* ============================================================
       TEXT
       ============================================================ */
    const text = [
        `${meta.emoji}  ${meta.title}`,
        "═".repeat(45),
        "",
        safeName ? `سلام ${safeName} عزیز،` : "سلام،",
        "",
        meta.desc,
        "",
        `کد تایید شما: ${code}`,
        "",
        `این کد تا ${expiresInMinutes} دقیقه اعتبار دارد.`,
        safeIp ? `IP درخواست: ${safeIp}` : "",
        "",
        "─".repeat(45),
        "⚠️  هشدار امنیتی",
        "هرگز این کد را با کسی به اشتراک نگذارید.",
        "کارمندان ما هرگز از شما کد تایید نمی‌خواهند.",
        "",
        "اگر این درخواست را شما نداده‌اید، این ایمیل را نادیده بگیرید.",
        "─".repeat(45)
    ]
        .filter((line) => line !== null && line !== undefined)
        .join("\n")
        .trim();

    return { subject, html, text };
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