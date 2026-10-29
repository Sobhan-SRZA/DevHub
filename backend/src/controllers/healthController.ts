
import type { Request, Response } from "express";
import mongoose from "mongoose";

/**
 * Performs a health check and returns the application's runtime status,
 * memory usage, database connection status, and environment configuration.
 *
 * @param _req - The incoming Express request.
 * @param res - The Express response used to return the health status.
 * @returns A JSON response containing the application's health information.
 */
export const healthCheck = (_req: Request, res: Response) => {
    const memory = process.memoryUsage();

    res.json({
        ok: true,
        uptime: Math.floor(process.uptime()),
        nodeVersion: process.version,
        memory: {
            rss: memory.rss,
            heapUsed: memory.heapUsed,
            heapTotal: memory.heapTotal
        },
        database: {
            connected: mongoose.connection.readyState === 1,
            state: mongoose.connection.readyState
        },
        env: process.env.NODE_ENV || "development"
    });
};

/**
 * Copyright (c) 2026 Sobhan Rasoulzadeh Asl (Sobhan-SRZA / Mr. Sinre)
 *
 * Licensed under the BSD 3-Clause License.
 * Refer to the LICENSE file in the project root for license information.
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */