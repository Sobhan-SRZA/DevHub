import path from "path";
import fs from "fs";

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogEntry {
    timestamp: string;
    level: LogLevel;
    message: string;
}

const LOG_DIR = path.resolve(process.cwd(), "logs");

class Logger {
    private buffer: LogEntry[] = [];
    private readonly maxBuffer = 2000;
    private originalConsole: {
        log: typeof console.log;
        warn: typeof console.warn;
        error: typeof console.error;
        debug: typeof console.debug;
    };

    constructor() {
        if (!fs.existsSync(LOG_DIR)) {
            fs.mkdirSync(LOG_DIR, { recursive: true });
        }

        this.originalConsole = {
            log: console.log.bind(console),
            warn: console.warn.bind(console),
            error: console.error.bind(console),
            debug: console.debug.bind(console),
        };

        this.hookConsole();
    }

    /* ---------------- file paths ---------------- */
    private getLogFile(date?: string): string {
        const d = date || new Date().toISOString().split("T")[0];

        return path.join(LOG_DIR, `app-${d}.log`);
    }

    /* ---------------- console hook ---------------- */
    private hookConsole() {
        console.log = (...args: any[]) => {
            this.write("info", args);
            this.originalConsole.log(...args);
        };

        console.warn = (...args: any[]) => {
            this.write("warn", args);
            this.originalConsole.warn(...args);
        };

        console.error = (...args: any[]) => {
            this.write("error", args);
            this.originalConsole.error(...args);
        };

        console.debug = (...args: any[]) => {
            this.write("debug", args);
            this.originalConsole.debug(...args);
        };
    }

    /* ---------------- write ---------------- */
    private write(level: LogLevel, args: any[]) {
        const timestamp = new Date().toISOString();

        const message = args
            .map((a) => {
                if (typeof a === "string")
                    return a;

                if (a instanceof Error)
                    return `${a.name}: ${a.message}\n${a.stack || ""}`;

                try {
                    return JSON.stringify(a);
                }

                catch {
                    return String(a);
                }
            })
            .join(" ");

        // in-memory buffer
        this.buffer.push({ timestamp, level, message });
        if (this.buffer.length > this.maxBuffer)
            this.buffer.shift();

        // file
        try {
            const line = `[${timestamp}] [${level.toUpperCase()}] ${message}\n`;
            fs.appendFileSync(this.getLogFile(), line, "utf8");
        }

        catch {
            /* ignore disk errors */
        }
    }

    /* ---------------- public API ---------------- */
    info(msg: string, meta?: any) {
        if (meta !== undefined)
            console.log(msg, meta);

        else
            console.log(msg);
    }

    warn(msg: string, meta?: any) {
        if (meta !== undefined)
            console.warn(msg, meta);

        else
            console.warn(msg);
    }

    error(msg: string, meta?: any) {
        if (meta !== undefined)
            console.error(msg, meta);

        else
            console.error(msg);
    }

    debug(msg: string, meta?: any) {
        if (meta !== undefined)
            console.debug(msg, meta);

        else
            console.debug(msg);
    }

    /* ---------------- query ---------------- */
    getRecent(limit = 200, level?: LogLevel, search?: string): LogEntry[] {
        let result = this.buffer.slice();

        if (level)
            result = result.filter((e) => e.level === level);

        if (search) {
            const s = search.toLowerCase();
            result = result.filter((e) => e.message.toLowerCase().includes(s));
        }

        return result.slice(-limit);
    }

    getStats() {
        const stats: Record<LogLevel, number> = { debug: 0, info: 0, warn: 0, error: 0 };
        for (const e of this.buffer)
            stats[e.level]++;

        return {
            ...stats,
            total: this.buffer.length,
            capacity: this.maxBuffer
        };
    }

    /* ---------------- files ---------------- */
    getFiles(): string[] {
        try {
            return fs
                .readdirSync(LOG_DIR)
                .filter((f) => f.startsWith("app-") && f.endsWith(".log"))
                .sort()
                .reverse();
        }

        catch {
            return [];
        }
    }

    readFile(filename: string, limit = 500): LogEntry[] {
        try {
            const safeName = path.basename(filename); // ضد path traversal
            const filePath = path.join(LOG_DIR, safeName);
            if (!fs.existsSync(filePath))
                return [];

            const content = fs.readFileSync(filePath, "utf8");
            const lines = content.split("\n").filter(Boolean);

            return lines.slice(-limit).map((line) => {
                const match = line.match(/^\[(.+?)\] \[(\w+)\] (.+)$/);
                if (match) {
                    return {
                        timestamp: match[1],
                        level: match[2].toLowerCase() as LogLevel,
                        message: match[3],
                    };
                }

                return {
                    timestamp: "",
                    level: "info" as LogLevel,
                    message: line
                };
            });
        }

        catch {
            return [];
        }
    }

    /* ---------------- cleanup ---------------- */
    clear() {
        this.buffer = [];
    }
}

export const logger = new Logger();
export { LOG_DIR };

/**
 * Copyright (c) 2026 Sobhan Rasoulzadeh Asl (Sobhan-SRZA / Mr. Sinre)
 *
 * Licensed under the BSD 3-Clause License.
 * See the LICENSE file in the project root for license information.
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */