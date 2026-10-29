
import mongoose from "mongoose";
import { config } from "./env";

/**
 * Establishes a connection to the MongoDB database.
 *
 * @returns A promise that resolves when the database connection is established.
 * @throws Terminates the process with an exit code of 1 if the connection fails.
 */
export const connectDB = async (): Promise<void> => {
    try {
        const connection = await mongoose.connect(config.mongoUri);

        console.log(`MongoDB connected successfully: ${connection.connection.host}`);
    } catch (error) {
        console.error("Failed to connect to MongoDB:", error);

        // Terminate the application when the database connection fails.
        process.exit(1);
    }
};

/**
 * Copyright (c) 2026 Sobhan Rasoulzadeh Asl (Sobhan-SRZA / Mr. Sinre)
 *
 * Licensed under the BSD 3-Clause License.
 * See the LICENSE file in the project root for license information.
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */
