
interface RateLimiterOptions {
    maxPerWindow: number;
    windowMs: number;
}

interface ConsumeResult {
    ok: boolean;
    retryAfterMs?: number;
}

/**
 * In-memory rate limiter that enforces request limits independently
 * for each key using a sliding time window.
 */
export class RateLimiter {
    private store = new Map<string, number[]>();
    private readonly max: number;
    private readonly windowMs: number;
    private readonly cleanupTimer: NodeJS.Timeout;

    constructor(opts: RateLimiterOptions) {
        this.max = opts.maxPerWindow;
        this.windowMs = opts.windowMs;

        // Periodically remove expired entries to prevent unbounded memory growth.
        this.cleanupTimer = setInterval(
            () => this.cleanup(),
            5 * 60 * 1000
        );

        // Allow the process to exit naturally when no other work remains.
        this.cleanupTimer.unref();
    }

    /**
     * Checks whether an operation is allowed and records it if permitted.
     *
     * Returns the remaining wait time when the configured limit is exceeded.
     */
    consume(key: string): ConsumeResult {
        const now = Date.now();
        const existing = this.store.get(key) || [];

        // Retain only timestamps within the active sliding window.
        const recent = existing.filter(
            (timestamp) => now - timestamp < this.windowMs
        );

        if (recent.length >= this.max) {
            const oldest = recent[0];

            return {
                ok: false,
                retryAfterMs: this.windowMs - (now - oldest)
            };
        }

        recent.push(now);
        this.store.set(key, recent);

        return { ok: true };
    }

    /**
     * Removes expired timestamps and deletes keys with no active entries.
     */
    private cleanup(): void {
        const now = Date.now();

        for (const [key, timestamps] of this.store) {
            const recent = timestamps.filter(
                (timestamp) => now - timestamp < this.windowMs
            );

            if (recent.length === 0) {
                this.store.delete(key);
            } else {
                this.store.set(key, recent);
            }
        }
    }

    /**
     * Stops the cleanup timer and releases all stored rate-limit data.
     */
    dispose(): void {
        clearInterval(this.cleanupTimer);
        this.store.clear();
    }
}

/**
 * Copyright (c) 2026 Sobhan Rasoulzadeh Asl (Sobhan-SRZA / Mr. Sinre)
 *
 * Licensed under the BSD 3-Clause License.
 * See the LICENSE file in the project root for license information.
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */