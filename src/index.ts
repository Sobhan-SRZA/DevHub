import { cleanupOldVerificationCodes } from "./scripts/cleanupVerificationCodes";
import { seedDefaultTags } from "./scripts/seedDefaultData";
import { connectDB } from "./config/db";
import { config } from "./config/env";
import app from "./app";
import { cleanupVerificationCodes, syncAllIndexes } from "./scripts/syncIndexes";

/* ============================================================
   Process-level guards
   ============================================================ */

// 1. Promise های بدون catch
process.on("unhandledRejection", (reason, promise) => {
    console.error("🔴 [UNHANDLED REJECTION]");
    console.error("   Reason :", reason);
    console.error("   Promise:", promise);
    // ⚠️ پروسه رو نمی‌کُشیم — فقط لاگ
});

// 2. خطاهای سنکرون خارج از try/catch
process.on("uncaughtException", (err) => {
    console.error("🔴 [UNCAUGHT EXCEPTION]");
    console.error(err);

    // در پروداکشن، معمولاً بهتره ری‌استارت بشه
    // چون state برنامه قابل اعتماد نیست
    if (process.env.NODE_ENV === "production") {
        // PM2 یا Docker خودش ری‌استارت می‌کنه
        process.exit(1);
    }
});

// 3. بستن نرم‌افزاری (optional)
process.on("SIGTERM", () => {
    console.log("👋 SIGTERM — shutting down...");

    process.exit(0);
});

/* ============================================================
   Start
   ============================================================ */
const startServer = async () => {
    try {
        await connectDB();
        // await seedDefaultTags(); 
        // await cleanupOldVerificationCodes()
        // await cleanupVerificationCodes();
        // await syncAllIndexes(); 

        const server = app.listen(config.port, () => {
            console.log(`🚀 Server running on http://localhost:${config.port}`);
        });

        // مدیریت خطاهای server (مثل EADDRINUSE)
        server.on("error", (err: any) => {
            if (err.code === "EADDRINUSE") {
                console.error(`❌ پورت ${config.port} در حال استفاده است`);

                process.exit(1);
            }

            console.error("🔴 Server error:", err);
        });
    }

    catch (err) {
        console.error("❌ Failed to start server:", err);
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