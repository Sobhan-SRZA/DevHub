import type {
    Request,
    Response
} from "express";
import mongoose from "mongoose";

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
 * See the LICENSE file in the project root for license information.
 *F
 * SPDX-License-Identifier: BSD-3-Clause
 */