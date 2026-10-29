
import {
    cleanupVerificationCodes,
    syncAllIndexes
} from "./scripts/syncIndexes";
import { cleanupOldVerificationCodes } from "./scripts/cleanupVerificationCodes";
import { ensureDeveloperExists } from "./services/roleService";
import { seedDefaultTags } from "./scripts/seedDefaultData";
import { connectDB } from "./config/db";
import { config } from "./config/env";
import { mailer } from "./services/mail";
import { logger } from "./services/logger";
import app from "./app";

/* ============================================================
   Process-Level Error Handling
   ============================================================ */

// 1. Handle unhandled promise rejections.
process.on("unhandledRejection", (reason, promise) => {
    console.error("🔴 [UNHANDLED REJECTION]");
    console.error("   Reason :", reason);
    console.error("   Promise:", promise);

    // Log the rejection without terminating the process.
});

// 2. Handle uncaught synchronous exceptions.
process.on("uncaughtException", (err) => {
    console.error("🔴 [UNCAUGHT EXCEPTION]");
    console.error(err);

    // In production, terminate the process because the application
    // state may no longer be reliable. Process managers such as PM2
    // or Docker can then restart the application.
    if (process.env.NODE_ENV === "production") {
        process.exit(1);
    }
});

// 3. Handle graceful termination requests.
process.on("SIGTERM", () => {
    console.log("👋 SIGTERM received. Shutting down...");

    mailer.shutdown();
    process.exit(0);
});

/* ============================================================
   Server Initialization
   ============================================================ */

const startServer = async () => {
    logger.info("🚀 Server starting...");

    try {
        // Establish the database connection.
        await connectDB();

        // Verify the mail service configuration at startup.
        // This check is relevant when the SMTP transport is enabled.
        await mailer.verifyOnStartup();

        // Perform optional verification-code cleanup tasks.
        // await cleanupOldVerificationCodes();
        // await cleanupVerificationCodes();

        // Ensure the default developer account and database indexes exist.
        await ensureDeveloperExists();
        await syncAllIndexes();

        // Seed the default tags if they are missing.
        await seedDefaultTags();

        // Start accepting incoming HTTP requests.
        const server = app.listen(config.port, () => {
            console.log(
                `🚀 Server running at http://localhost:${config.port}`
            );
        });

        // Handle HTTP server errors, including port conflicts.
        server.on("error", (err: any) => {
            if (err.code === "EADDRINUSE") {
                console.error(
                    `❌ Port ${config.port} is already in use.`
                );

                process.exit(1);
            }

            console.error("🔴 HTTP server error:", err);
        });
    } catch (err) {
        console.error("❌ Failed to start the server:", err);
        process.exit(1);
    }
};

startServer();

/**
 * Copyright (c) 2026 Sobhan Rasoulzadeh Asl (Sobhan-SRZA / Mr. Sinre)
 *
 * Licensed under the BSD 3-Clause License.
 * See the LICENSE file in the project root for license information.
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */