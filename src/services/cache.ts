interface Entry {
    value: unknown;
    expiresAt: number;
}

const store = new Map<string, Entry>();

export function cacheGet<T>(key: string): T | null {
    const e = store.get(key);
    if (!e) return null;
    if (e.expiresAt < Date.now()) { store.delete(key); return null; }
    return e.value as T;
}

export function cacheSet(key: string, value: unknown, ttlSeconds = 300) {
    store.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
}

export function cacheDel(key: string) { store.delete(key); }

export function cacheClearPrefix(prefix: string) {
    for (const k of store.keys()) {
        if (k.startsWith(prefix)) store.delete(k);
    }
}

// پاک‌سازی خودکار
setInterval(() => {
    const now = Date.now();
    for (const [k, e] of store) if (e.expiresAt < now) store.delete(k);
}, 10 * 60 * 1000).unref();

/**
 * Copyright (c) 2026 Sobhan Rasoulzadeh Asl (Sobhan-SRZA / Mr. Sinre)
 *
 * Licensed under the BSD 3-Clause License.
 * See the LICENSE file in the project root for license information.
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */