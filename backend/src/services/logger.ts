
import path from "path";
import fs from "fs";

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogEntry {
    timestamp: string;
    level: LogLevel;
    message: string;
}

const LOG_DIR = path.resolve(process.cwd(), "logs");

/**
 * Provides centralized application logging with console interception,
 * in-memory buffering, file persistence, and log retrieval utilities.
 */
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

        // Preserve the original console methods before intercepting them.
        this.originalConsole = {
            log: console.log.bind(console),
            warn: console.warn.bind(console),
            error: console.error.bind(console),
            debug: console.debug.bind(console),
        };

        this.hookConsole();
    }

    /* ---------------- Log File Paths ---------------- */

    /**
     * Returns the log file path for the specified date.
     * Defaults to the current UTC date.
     */
    private getLogFile(date?: string): string {
        const logDate = date || new Date().toISOString().split("T")[0];

        return path.join(LOG_DIR, `app-${logDate}.log`);
    }

    /* ---------------- Console Interception ---------------- */

    /**
     * Intercepts console methods to capture log entries while preserving
     * their original output behavior.
     */
    private hookConsole(): void {
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

    /* ---------------- Log Persistence ---------------- */

    /**
     * Normalizes log arguments, updates the in-memory buffer,
     * and appends the entry to the current daily log file.
     */
    private write(level: LogLevel, args: any[]): void {
        const timestamp = new Date().toISOString();

        const message = args
            .map((value) => {
                if (typeof value === "string") {
                    return value;
                }

                if (value instanceof Error) {
                    return `${value.name}: ${value.message}\n${value.stack || ""}`;
                }

                try {
                    const serialized = JSON.stringify(value);

                    return serialized === undefined
                        ? String(value)
                        : serialized;
                } catch {
                    return String(value);
                }
            })
            .join(" ");

        // Keep the in-memory buffer within its configured capacity.
        this.buffer.push({ timestamp, level, message });

        if (this.buffer.length > this.maxBuffer) {
            this.buffer.shift();
        }

        // Persist the entry without interrupting application execution
        // if the log directory or file is temporarily unavailable.
        try {
            const line = `[${timestamp}] [${level.toUpperCase()}] ${message}\n`;

            fs.appendFileSync(this.getLogFile(), line, "utf8");
        } catch {
            // Intentionally ignore file system errors to avoid disrupting
            // the application's primary execution flow.
        }
    }

    /* ---------------- Public Logging API ---------------- */

    info(message: string, meta?: any): void {
        if (meta !== undefined) {
            console.log(message, meta);
        } else {
            console.log(message);
        }
    }

    warn(message: string, meta?: any): void {
        if (meta !== undefined) {
            console.warn(message, meta);
        } else {
            console.warn(message);
        }
    }

    error(message: string, meta?: any): void {
        if (meta !== undefined) {
            console.error(message, meta);
        } else {
            console.error(message);
        }
    }

    debug(message: string, meta?: any): void {
        if (meta !== undefined) {
            console.debug(message, meta);
        } else {
            console.debug(message);
        }
    }

    /* ---------------- Log Querying ---------------- */

    /**
     * Returns recent in-memory log entries with optional level and
     * case-insensitive message filters.
     */
    getRecent(
        limit = 200,
        level?: LogLevel,
        search?: string
    ): LogEntry[] {
        let result = this.buffer.slice();

        if (level) {
            result = result.filter((entry) => entry.level === level);
        }

        if (search) {
            const normalizedSearch = search.toLowerCase();

            result = result.filter((entry) =>
                entry.message.toLowerCase().includes(normalizedSearch)
            );
        }

        return result.slice(-Math.max(0, limit));
    }

    /**
     * Returns the number of buffered entries for each log level,
     * along with the current buffer size and maximum capacity.
     */
    getStats() {
        const stats: Record<LogLevel, number> = {
            debug: 0,
            info: 0,
            warn: 0,
            error: 0,
        };

        for (const entry of this.buffer) {
            stats[entry.level]++;
        }

        return {
            ...stats,
            total: this.buffer.length,
            capacity: this.maxBuffer,
        };
    }

    /* ---------------- Log File Management ---------------- */

    /**
     * Lists available daily application log files in reverse
     * chronological filename order.
     */
    getFiles(): string[] {
        try {
            return fs
                .readdirSync(LOG_DIR)
                .filter(
                    (filename) =>
                        filename.startsWith("app-") &&
                        filename.endsWith(".log")
                )
                .sort()
                .reverse();
        } catch {
            return [];
        }
    }

    /**
     * Reads and parses the most recent entries from a log file.
     *
     * Uses the file's basename to prevent path traversal outside
     * the configured log directory.
     */
    readFile(filename: string, limit = 500): LogEntry[] {
        try {
            const safeName = path.basename(filename);
            const filePath = path.join(LOG_DIR, safeName);

            if (!fs.existsSync(filePath)) {
                return [];
            }

            const content = fs.readFileSync(filePath, "utf8");
            const lines = content.split("\n").filter(Boolean);

            return lines.slice(-Math.max(0, limit)).map((line) => {
                const match = line.match(
                    /^\[(.+?)\] \[(\w+)\] (.*)$/
                );

                if (match) {
                    return {
                        timestamp: match[1],
                        level: match[2].toLowerCase() as LogLevel,
                        message: match[3],
                    };
                }

                // Preserve lines that do not match the expected log format.
                return {
                    timestamp: "",
                    level: "info" as LogLevel,
                    message: line,
                };
            });
        } catch {
            return [];
        }
    }

    /* ---------------- Buffer Cleanup ---------------- */

    /**
     * Clears the in-memory log buffer without deleting persisted log files.
     */
    clear(): void {
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