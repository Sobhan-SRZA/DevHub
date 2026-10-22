/* ==================================================================
   محدودیت نرخ ارسال (per recipient)
   ================================================================== */
interface RateLimiterOptions {
    maxPerWindow: number;
    windowMs: number;
}

interface ConsumeResult {
    ok: boolean;
    retryAfterMs?: number;
}

export class RateLimiter {
    private store = new Map<string, number[]>();
    private readonly max: number;
    private readonly windowMs: number;
    private readonly cleanupTimer: NodeJS.Timeout;

    constructor(opts: RateLimiterOptions) {
        this.max = opts.maxPerWindow;
        this.windowMs = opts.windowMs;

        // پاک‌سازی خودکار هر ۵ دقیقه
        this.cleanupTimer = setInterval(() => this.cleanup(), 5 * 60 * 1000);
        this.cleanupTimer.unref();
    }

    /**
     * اگه مجاز بود، ثبت می‌کنه و true برمی‌گردونه.
     * اگه رد شد، مدت زمان انتظار رو برمی‌گردونه.
     */
    consume(key: string): ConsumeResult {
        const now = Date.now();
        const existing = this.store.get(key) || [];
        const recent = existing.filter((t) => now - t < this.windowMs);

        if (recent.length >= this.max) {
            const oldest = recent[0];

            return {
                ok: false,
                retryAfterMs: this.windowMs - (now - oldest),
            };
        }

        recent.push(now);
        this.store.set(key, recent);

        return { ok: true };
    }

    private cleanup() {
        const now = Date.now();
        for (const [key, timestamps] of this.store) {
            const recent = timestamps.filter((t) => now - t < this.windowMs);
            if (recent.length === 0)
                this.store.delete(key);

            else
                this.store.set(key, recent);
        }
    }

    dispose() {
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