import type {
    Request,
    Response
} from "express";
import {
    logger,
    LOG_DIR
} from "../services/logger";
import { asyncHandler } from "../utils/asyncHandler";
import { ErrorCodes } from "../utils/errorCodes";
import { AppError } from "../utils/AppError";
import mongoose from "mongoose";
import process from "process";
import path from "path";
import os from "os";
import fs from "fs";

/* ==================================================================
   GET /api/system/stats
   ================================================================== */
export const getSystemStats = asyncHandler(async (_req: Request, res: Response) => {
    const mem = process.memoryUsage();
    const cpus = os.cpus();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();

    /* ---------- database ---------- */
    let dbInfo: any = { connected: false };
    try {
        const conn = mongoose.connection;
        if (conn.readyState === 1 && conn.db) {
            const [collections, stats] = await Promise.all([
                conn.db.listCollections().toArray(),
                conn.db.stats()
            ]);

            dbInfo = {
                connected: true,
                name: conn.name,
                host: conn.host,
                port: conn.port,
                collections: collections.length,
                collectionNames: collections.map((c) => c.name),
                documents: stats.objects,
                dataSize: stats.dataSize,
                storageSize: stats.storageSize,
                indexes: stats.indexes,
                avgObjSize: Math.round(stats.avgObjSize || 0)
            };
        }
    }
    
    catch (err) {
        dbInfo = { connected: false, error: (err as Error).message };
    }

    /* ---------- response ---------- */
    res.json({
        ok: true,
        timestamp: new Date().toISOString(),
        process: {
            pid: process.pid,
            uptime: Math.floor(process.uptime()),
            nodeVersion: process.version,
            platform: process.platform,
            arch: process.arch,
            env: process.env.NODE_ENV || "development",
            cwd: process.cwd(),
            versions: {
                node: process.versions.node,
                v8: process.versions.v8,
                openssl: process.versions.openssl
            }
        },
        memory: {
            rss: mem.rss,
            heapTotal: mem.heapTotal,
            heapUsed: mem.heapUsed,
            external: mem.external,
            arrayBuffers: (mem as any).arrayBuffers || 0,
            systemTotal: totalMem,
            systemFree: freeMem,
            systemUsed: totalMem - freeMem
        },
        cpu: {
            cores: cpus.length,
            model: cpus[0]?.model || "unknown",
            speed: cpus[0]?.speed || 0,
            loadAvg: os.loadavg()
        },
        os: {
            platform: os.platform(),
            release: os.release(),
            hostname: os.hostname(),
            type: os.type()
        },
        database: dbInfo,
        logs: {
            bufferSize: logger.getRecent().length,
            files: logger.getFiles()
        }
    });
});

/* ==================================================================
   GET /api/system/logs
   ================================================================== */
export const getLogs = asyncHandler(async (req: Request, res: Response) => {
    const limit = Math.min(1000, Math.max(1, parseInt(String(req.query.limit || "200"), 10)));
    const level = (req.query.level as string) || "";
    const search = String(req.query.search || "");
    const file = req.query.file as string | undefined;

    /* ---------- از فایل (تاریخی) ---------- */
    let entries;
    if (file && file !== "live") {
        entries = logger.readFile(file, limit);

        if (level && level !== "all") {
            entries = entries.filter((e) => e.level === level);
        }

        if (search) {
            const s = search.toLowerCase();
            entries = entries.filter((e) => e.message.toLowerCase().includes(s));
        }
    } 
    
    else {
        /* ---------- از buffer زنده ---------- */
        const validLevel = (level && level !== "all") ? (level as any) : undefined;
        entries = logger.getRecent(limit, validLevel, search || undefined);
    }

    res.json({
        ok: true,
        entries,
        stats: logger.getStats(),
        files: logger.getFiles(),
        source: file || "live"
    });
});

/* ==================================================================
   GET /api/system/logs/download
   ================================================================== */
export const downloadLogs = asyncHandler(async (req: Request, res: Response) => {
    const file = req.query.file as string;

    if (!file) {
        throw new AppError(400, ErrorCodes.VALIDATION_ERROR, "پارامتر file الزامی است");
    }

    const safeName = path.basename(file);
    if (!/^app-\d{4}-\d{2}-\d{2}\.log$/.test(safeName)) {
        throw new AppError(400, ErrorCodes.VALIDATION_ERROR, "نام فایل نامعتبر است");
    }

    const filePath = path.join(LOG_DIR, safeName);
    if (!fs.existsSync(filePath)) {
        throw new AppError(404, ErrorCodes.INTERNAL_ERROR, "فایل یافت نشد");
    }

    res.download(filePath, safeName);
});

/* ==================================================================
   POST /api/system/logs/clear
   ================================================================== */
export const clearLogs = asyncHandler(async (_req: Request, res: Response) => {
    logger.clear();
    res.json({ ok: true, message: "لاگ‌های حافظه پاک شدند" });
});

/**
 * Copyright (c) 2026 Sobhan Rasoulzadeh Asl (Sobhan-SRZA / Mr. Sinre)
 *
 * Licensed under the BSD 3-Clause License.
 * See the LICENSE file in the project root for license information.
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */