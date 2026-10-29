
interface CacheEntry {
    value: unknown;
    expiresAt: number;
}

const store = new Map<string, CacheEntry>();

/**
 * Retrieves a cached value by key.
 *
 * Returns null when the key does not exist or the entry has expired.
 */
export function cacheGet<T>(key: string): T | null {
    const entry = store.get(key);

    if (!entry) {
        return null;
    }

    if (entry.expiresAt <= Date.now()) {
        store.delete(key);
        return null;
    }

    return entry.value as T;
}

/**
 * Stores a value in the cache with a configurable time-to-live.
 *
 * @param key - Unique cache entry identifier.
 * @param value - Value to cache.
 * @param ttlSeconds - Expiration duration in seconds. Defaults to 300 seconds.
 */
export function cacheSet(
    key: string,
    value: unknown,
    ttlSeconds = 300
): void {
    store.set(key, {
        value,
        expiresAt: Date.now() + ttlSeconds * 1000
    });
}

/**
 * Removes a specific entry from the cache.
 */
export function cacheDel(key: string): void {
    store.delete(key);
}

/**
 * Removes all cache entries whose keys start with the specified prefix.
 */
export function cacheClearPrefix(prefix: string): void {
    for (const key of store.keys()) {
        if (key.startsWith(prefix)) {
            store.delete(key);
        }
    }
}

/**
 * Periodically removes expired entries to prevent stale data
 * from accumulating in memory.
 */
const cleanupTimer = setInterval(() => {
    const now = Date.now();

    for (const [key, entry] of store) {
        if (entry.expiresAt <= now) {
            store.delete(key);
        }
    }
}, 10 * 60 * 1000);

// Allow the process to exit naturally when no other work remains.
cleanupTimer.unref();

/**
 * Copyright (c) 2026 Sobhan Rasoulzadeh Asl (Sobhan-SRZA / Mr. Sinre)
 *
 * Licensed under the BSD 3-Clause License.
 * See the LICENSE file in the project root for license information.
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */