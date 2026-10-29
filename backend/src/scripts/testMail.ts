
import {
    mailer,
    getMailConfig,
    sendOtpEmail,
} from "../services/mail";
import { VerificationCode } from "../models/VerificationCode";
import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";

/**
 * Tests email delivery by sending a one-time password (OTP) to the
 * specified recipient.
 *
 * Usage:
 *   npx tsx backend/src/scripts/testMail.ts you@example.com
 */

// Load environment variables from the project root.
dotenv.config({
    path: path.resolve(process.cwd(), ".env"),
});

async function main(): Promise<void> {
    const to = process.argv[2];

    // Validate the recipient email address before attempting delivery.
    if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
        console.error(
            "Usage: npx tsx src/scripts/testMail.ts you@example.com"
        );

        process.exitCode = 1;
        return;
    }

    const config = getMailConfig();

    console.log(`Email delivery mode: ${config.mode}`);

    // Verify the SMTP connection when SMTP transport is configured.
    // No database connection is required for this test.
    if (config.mode === "smtp") {
        await mailer.verifyOnStartup();
    }

    console.log(`\nSending a test OTP to ${to}...\n`);

    const { code } = VerificationCode.generateCode();

    try {
        const result = await sendOtpEmail({
            to,
            code,
            purpose: "change_password",
            expiresInMinutes: 10,
            userName: "Test User",
            ip: "127.0.0.1",
        });

        console.log("\nEmail sent successfully.");
        console.log(`Message ID: ${result.messageId}`);
        console.log(`Transport: ${result.transport}`);
    } catch (error: unknown) {
        const message =
            error instanceof Error ? error.message : String(error);

        console.error("\nEmail delivery failed:", message);

        process.exitCode = 1;
    } finally {
        await mongoose.disconnect().catch(() => undefined);
    }
}

main().catch(async (error: unknown) => {
    const message =
        error instanceof Error ? error.message : String(error);

    console.error("Email test failed:", message);

    await mongoose.disconnect().catch(() => undefined);

    process.exitCode = 1;
});

/**
 * Copyright (c) 2026 Sobhan Rasoulzadeh Asl (Sobhan-SRZA / Mr. Sinre)
 *
 * Licensed under the BSD 3-Clause License.
 * See the LICENSE file in the project root for license information.
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */