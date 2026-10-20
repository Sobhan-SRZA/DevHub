import mongoose from "mongoose";
import { config } from "./env";

export const connectDB = async (): Promise<void> => {
    try {
        const conn = await mongoose.connect(config.mongoUri);
        
        console.log(`MongoDB Connected: ${conn.connection.host}`);
    }

    catch (error) {
        console.error("Error connecting to MongoDB:", error);

        // Exit process with failure
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