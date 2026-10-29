
import { ensureDeveloperExists } from "../services/roleService";
import { connectDB } from "../config/db";
import mongoose from "mongoose";

/**
 * Ensures that the designated developer account exists in the database.
 */
async function main(): Promise<void> {
    await connectDB();
    await ensureDeveloperExists();
    await mongoose.disconnect();

    process.exit(0);
}

main().catch(async (error: unknown) => {
    console.error("Failed to initialize the developer account:", error);

    await mongoose.disconnect().catch(() => undefined);

    process.exit(1);
});

/**
 * Copyright (c) 2026 Sobhan Rasoulzadeh Asl (Sobhan-SRZA / Mr. Sinre)
 *
 * Licensed under the BSD 3-Clause License.
 * See the LICENSE file in the project root for license information.
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */