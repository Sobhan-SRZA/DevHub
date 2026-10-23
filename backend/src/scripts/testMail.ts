/**
 * تست ارسال ایمیل
 *
 * npx tsx backend/src/scripts/testMail.ts you@example.com
 */
import {
    mailer,
    getMailConfig
} from "../services/mail";
import { VerificationCode } from "../models/VerificationCode";
import { sendOtpEmail } from "../services/mail";
import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";

// Load .env file from the project root
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

async function main() {
    const to = process.argv[2];

    if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
        console.error("Usage: npx tsx src/scripts/testMail.ts you@example.com");
        process.exit(1);
    }

    const config = getMailConfig();
    console.log(`📧 Mode: ${config.mode}`);

    // برای SMTP به DB نیازی نیست، ولی connectDB رو صدا نمی‌زنیم
    if (config.mode === "smtp") {
        await mailer.verifyOnStartup();
    }

    console.log(`\n→ Sending test OTP to ${to}...\n`);

    const { code } = (VerificationCode as any).generateCode();

    try {
        const result = await sendOtpEmail({
            to,
            code,
            purpose: "change_password",
            expiresInMinutes: 10,
            userName: "Test User",
            ip: "127.0.0.1"
        });

        console.log("\n✅ Sent successfully:");
        console.log(`   messageId: ${result.messageId}`);
        console.log(`   transport: ${result.transport}`);
    }

    catch (err: any) {
        console.error("\n❌ Failed:", err?.message || err);
        process.exit(1);
    }

    await mongoose.disconnect().catch(() => { });
}

main();

/**
 * Copyright (c) 2026 Sobhan Rasoulzadeh Asl (Sobhan-SRZA / Mr. Sinre)
 *
 * Licensed under the BSD 3-Clause License.
 * See the LICENSE file in the project root for license information.
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */