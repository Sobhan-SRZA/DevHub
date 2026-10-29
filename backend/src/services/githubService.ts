import { ErrorCodes } from "../utils/errorCodes";
import { AppError } from "../utils/AppError";

/* ==================================================================
   Types
   ================================================================== */

export interface GitHubRepoInfo {
    id: number;
    name: string;
    fullName: string;
    description: string | null;
    htmlUrl: string;
    homepage: string | null;
    language: string | null;
    stars: number;
    watchers: number;
    forks: number;
    openIssues: number;
    size: number;
    license: string | null;
    topics: string[];
    defaultBranch: string;
    isArchived: boolean;
    isFork: boolean;
    createdAt: Date;
    updatedAt: Date;
    pushedAt: Date;
}

interface CacheEntry<T> {
    value: T;
    etag: string | null;
    expiresAt: number;
}

interface RateLimitState {
    remaining: number;
    limit: number;
    resetAt: number; // Epoch milliseconds.
    checked: boolean;
}

/* ==================================================================
   Configuration
   ================================================================== */

const CONFIG = {
    // Per-request network timeout.
    requestTimeoutMs: 8000,

    // Cache TTLs — tuned to reduce GitHub quota consumption.
    repoInfoTtlMs: 15 * 60 * 1000,        // 15 minutes
    downloadsTtlMs: 60 * 60 * 1000,       // 1 hour

    // Number of most recent releases to inspect when totalling downloads.
    // Lower values reduce payload size; most download volume concentrates
    // in the latest few releases.
    releasesPerPage: 30,

    // Maximum number of concurrent in-flight GitHub requests.
    maxConcurrentRequests: 3,

    // Safety margin: never consume the last N remaining requests.
    rateLimitSafetyMargin: 50,

    // Maximum time we are willing to block waiting for a rate-limit reset.
    maxRateLimitWaitMs: 30 * 1000,

    // Retry policy for transient network/5xx failures.
    maxRetries: 3,
    retryBaseDelayMs: 1000,
};

/* ==================================================================
   In-Memory Caches and Deduplication
   ================================================================== */

const repoInfoCache = new Map<string, CacheEntry<GitHubRepoInfo>>();
const downloadsCache = new Map<string, CacheEntry<number>>();

/**
 * Tracks in-flight requests so that concurrent callers requesting the
 * same resource share a single upstream GitHub call. Without this,
 * parallel syncs of the same project multiply quota consumption.
 */
const inFlight = new Map<string, Promise<any>>();

/* ==================================================================
   Rate-Limit Tracking
   ================================================================== */

let rateLimitState: RateLimitState = {
    remaining: Infinity,
    limit: Infinity,
    resetAt: 0,
    checked: false,
};

/**
 * Reads GitHub's rate-limit response headers and updates local state.
 * These headers are present on every response, allowing the client to
 * throttle proactively before the quota is exhausted.
 */
function readRateLimitHeaders(response: Response): void {
    const remaining = response.headers.get("x-ratelimit-remaining");
    const limit = response.headers.get("x-ratelimit-limit");
    const reset = response.headers.get("x-ratelimit-reset");

    if (remaining !== null) rateLimitState.remaining = Number(remaining);
    if (limit !== null) rateLimitState.limit = Number(limit);
    if (reset !== null) rateLimitState.resetAt = Number(reset) * 1000;

    rateLimitState.checked = true;
}

/**
 * Blocks if the remaining quota is near the safety margin, allowing the
 * window to reset. Throws when the required wait exceeds the configured
 * maximum — this surfaces a clear error rather than hanging indefinitely.
 */
async function waitForRateLimitBudget(): Promise<void> {
    if (!rateLimitState.checked) return;
    if (rateLimitState.remaining > CONFIG.rateLimitSafetyMargin) return;

    const waitMs = rateLimitState.resetAt - Date.now();

    if (waitMs <= 0) return;

    if (waitMs > CONFIG.maxRateLimitWaitMs) {
        throw new AppError(
            429,
            ErrorCodes.GITHUB_RATE_LIMIT,
            `GitHub rate limit nearly exhausted (${rateLimitState.remaining} remaining). ` +
            `Resets in ${Math.ceil(waitMs / 1000)}s. Configure GITHUB_TOKEN to raise the limit to 5000 req/hour.`
        );
    }

    console.warn(
        `[github] Rate limit low (${rateLimitState.remaining} remaining). Waiting ${waitMs}ms for reset.`
    );

    await new Promise((resolve) => setTimeout(resolve, waitMs));
}

/* ==================================================================
   Concurrency Control
   ================================================================== */

/**
 * A minimal counting semaphore used to cap the number of simultaneous
 * GitHub requests. Multiple syncs arriving together are throttled to
 * `maxConcurrentRequests` rather than flooding the API.
 */
class Semaphore {
    private available: number;
    private waiters: Array<() => void> = [];

    constructor(max: number) {
        this.available = max;
    }

    async acquire(): Promise<() => void> {
        if (this.available > 0) {
            this.available--;
            return () => this.release();
        }

        return new Promise((resolve) => {
            this.waiters.push(() => {
                this.available--;
                resolve(() => this.release());
            });
        });
    }

    private release(): void {
        this.available++;
        const next = this.waiters.shift();
        if (next) next();
    }
}

const githubSemaphore = new Semaphore(CONFIG.maxConcurrentRequests);

/* ==================================================================
   HTTP Helper
   ================================================================== */

interface GhResponse<T> {
    data: T | null;
    etag: string | null;
    notModified: boolean;
}

/**
 * Sends an authenticated GitHub API request with:
 *   - conditional caching via ETag (304 responses do not count against
 *     the rate limit for authenticated requests);
 *   - rate-limit awareness and proactive throttling;
 *   - exponential backoff on transient failures;
 *   - honouring of the Retry-After header.
 */
async function ghFetch<T>(
    apiPath: string,
    etag?: string | null
): Promise<GhResponse<T>> {
    const headers: Record<string, string> = {
        Accept: "application/vnd.github+json",
        "User-Agent": "devhub-app",
        "X-GitHub-Api-Version": "2022-11-28",
    };

    if (process.env.GITHUB_TOKEN) {
        headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
    }

    if (etag) {
        headers["If-None-Match"] = etag;
    }

    const release = await githubSemaphore.acquire();

    let lastError: Error | null = null;

    try {
        for (let attempt = 0; attempt <= CONFIG.maxRetries; attempt++) {
            await waitForRateLimitBudget();

            let response: Response;

            try {
                response = await fetch(`https://api.github.com${apiPath}`, {
                    headers,
                    signal: AbortSignal.timeout(CONFIG.requestTimeoutMs),
                });
            } catch (err: any) {
                lastError = err;

                if (attempt < CONFIG.maxRetries) {
                    await backoff(attempt);
                    continue;
                }

                throw new AppError(
                    503,
                    ErrorCodes.GITHUB_API_ERROR,
                    "Unable to connect to the GitHub API."
                );
            }

            readRateLimitHeaders(response);

            // A 304 confirms the cached representation is still current.
            // These responses do not consume rate-limit quota.
            if (response.status === 304) {
                return { data: null, etag: etag ?? null, notModified: true };
            }

            if (response.status === 404) {
                throw new AppError(404, ErrorCodes.GITHUB_REPO_NOT_FOUND);
            }

            if (response.status === 403 || response.status === 429) {
                const retryAfterHeader = response.headers.get("retry-after");

                if (retryAfterHeader && attempt < CONFIG.maxRetries) {
                    const waitMs = Number(retryAfterHeader) * 1000;

                    if (waitMs <= CONFIG.maxRateLimitWaitMs) {
                        console.warn(
                            `[github] Rate limited. Retrying after ${waitMs}ms (attempt ${attempt + 1}).`
                        );
                        await new Promise((r) => setTimeout(r, waitMs));
                        continue;
                    }
                }

                const resetInMs = rateLimitState.resetAt - Date.now();
                if (resetInMs > 0 && resetInMs <= CONFIG.maxRateLimitWaitMs && attempt < CONFIG.maxRetries) {
                    console.warn(`[github] Rate limited. Waiting ${resetInMs}ms for reset.`);
                    await new Promise((r) => setTimeout(r, resetInMs));
                    continue;
                }

                throw new AppError(
                    429,
                    ErrorCodes.GITHUB_RATE_LIMIT,
                    "GitHub API rate limit reached. Configure GITHUB_TOKEN to raise the limit to 5000 req/hour."
                );
            }

            if (response.status >= 500 && attempt < CONFIG.maxRetries) {
                lastError = new Error(`GitHub returned ${response.status}`);
                await backoff(attempt);
                continue;
            }

            if (!response.ok) {
                throw new AppError(502, ErrorCodes.GITHUB_API_ERROR);
            }

            const data = (await response.json()) as T;
            const newEtag = response.headers.get("etag");

            return { data, etag: newEtag, notModified: false };
        }

        throw new AppError(
            502,
            ErrorCodes.GITHUB_API_ERROR,
            lastError?.message || "GitHub request failed after retries."
        );
    } finally {
        release();
    }
}

/**
 * Sleeps for an exponentially increasing duration based on the attempt
 * number. Used to space out retries of transient failures.
 */
async function backoff(attempt: number): Promise<void> {
    const delay = CONFIG.retryBaseDelayMs * Math.pow(2, attempt);
    await new Promise((resolve) => setTimeout(resolve, delay));
}

/* ==================================================================
   URL Parser
   ================================================================== */

export function parseGitHubUrl(
    url: string
): { owner: string; repo: string } | null {
    if (!url) {
        return null;
    }

    const cleaned = url
        .trim()
        .replace(/\.git$/i, "")
        .replace(/\/+$/, "");

    // Accept the owner/repository shorthand.
    if (/^[\w.-]+\/[\w.-]+$/.test(cleaned)) {
        const [owner, repo] = cleaned.split("/");
        return { owner, repo };
    }

    // Accept standard HTTPS URLs.
    try {
        const parsedUrl = new URL(cleaned);

        if (!/(^|\.)github\.com$/i.test(parsedUrl.hostname)) {
            return null;
        }

        const parts = parsedUrl.pathname.split("/").filter(Boolean);
        if (parts.length < 2) return null;

        return { owner: parts[0], repo: parts[1] };
    } catch {
        // Fall back to the SSH clone URL format.
        const match = cleaned.match(
            /^git@github\.com:([\w.-]+)\/([\w.-]+)$/i
        );

        if (match) {
            return { owner: match[1], repo: match[2] };
        }

        return null;
    }
}

/* ==================================================================
   Repository Info
   ================================================================== */

/**
 * Returns normalised metadata for a repository, served from a 15-minute
 * in-memory cache when possible. Concurrent requests for the same
 * repository share a single upstream call.
 */
export async function fetchRepoInfo(
    owner: string,
    repo: string
): Promise<GitHubRepoInfo> {
    const key = `info:${owner.toLowerCase()}/${repo.toLowerCase()}`;

    const cached = repoInfoCache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
        return cached.value;
    }

    if (inFlight.has(key)) {
        return inFlight.get(key)!;
    }

    const promise = (async () => {
        const { data, etag, notModified } = await ghFetch<any>(
            `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`,
            cached?.etag
        );

        const info =
            notModified && cached ? cached.value : normalizeRepoInfo(data);

        repoInfoCache.set(key, {
            value: info,
            etag: etag ?? cached?.etag ?? null,
            expiresAt: Date.now() + CONFIG.repoInfoTtlMs,
        });

        return info;
    })().finally(() => {
        inFlight.delete(key);
    });

    inFlight.set(key, promise);
    return promise;
}

/** Maps the GitHub response body to the normalised internal shape. */
function normalizeRepoInfo(data: any): GitHubRepoInfo {
    return {
        id: data.id,
        name: data.name,
        fullName: data.full_name,
        description: data.description ?? null,
        htmlUrl: data.html_url,
        homepage: data.homepage ?? null,
        language: data.language ?? null,
        stars: data.stargazers_count ?? 0,
        watchers: data.subscribers_count ?? data.watchers_count ?? 0,
        forks: data.forks_count ?? 0,
        openIssues: data.open_issues_count ?? 0,
        size: data.size ?? 0,
        license: data.license?.spdx_id ?? null,
        topics: data.topics ?? [],
        defaultBranch: data.default_branch ?? "main",
        isArchived: Boolean(data.archived),
        isFork: Boolean(data.fork),
        createdAt: new Date(data.created_at),
        updatedAt: new Date(data.updated_at),
        pushedAt: new Date(data.pushed_at),
    };
}

/* ==================================================================
   Download Statistics
   ================================================================== */

/**
 * Returns the aggregate download count across the repository's most
 * recent releases. The result is cached for one hour and shared
 * between concurrent callers.
 *
 * Failures are non-fatal: the previous cached value (or zero) is
 * returned so that a single release-listing error cannot break a sync.
 */
export async function fetchRepoDownloads(
    owner: string,
    repo: string
): Promise<number> {
    const key = `dl:${owner.toLowerCase()}/${repo.toLowerCase()}`;

    const cached = downloadsCache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
        return cached.value;
    }

    if (inFlight.has(key)) {
        return inFlight.get(key)!;
    }

    const promise = (async () => {
        let total = cached?.value ?? 0;

        try {
            const { data, etag, notModified } = await ghFetch<any[]>(
                `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/releases?per_page=${CONFIG.releasesPerPage}`,
                cached?.etag
            );

            if (notModified && cached) {
                total = cached.value;
            } else if (Array.isArray(data)) {
                total = 0;
                for (const release of data) {
                    for (const asset of release.assets || []) {
                        total += asset.download_count || 0;
                    }
                }
            }
        } catch (err) {
            // Treat a missing releases collection as zero downloads.
            if (err instanceof AppError && err.statusCode === 404) {
                total = 0;
            } else {
                console.warn(
                    `[github] Download stats unavailable for ${owner}/${repo}: ${(err as Error).message}`
                );

                // Do not fail the caller; return the cached (or zero) value.
                return cached?.value ?? 0;
            }
        }

        downloadsCache.set(key, {
            value: total,
            etag: cached?.etag ?? null,
            expiresAt: Date.now() + CONFIG.downloadsTtlMs,
        });

        return total;
    })().finally(() => {
        inFlight.delete(key);
    });

    inFlight.set(key, promise);
    return promise;
}

/* ==================================================================
   Aggregation
   ================================================================== */

/**
 * Fetches repository metadata and download statistics in parallel.
 * Download failures are downgraded to zero so metadata retrieval
 * always succeeds.
 */
export async function fetchFullRepoData(owner: string, repo: string) {
    const [info, downloads] = await Promise.all([
        fetchRepoInfo(owner, repo),
        fetchRepoDownloads(owner, repo).catch(() => 0),
    ]);

    return { info, downloads };
}

/* ==================================================================
   Sync Policy
   ================================================================== */

export function shouldResync(
    lastSyncedAt: Date | null | undefined,
    maxAgeHours = 6
): boolean {
    if (!lastSyncedAt) return true;

    const ageMs = Date.now() - new Date(lastSyncedAt).getTime();
    return ageMs > maxAgeHours * 60 * 60 * 1000;
}

/* ==================================================================
   Diagnostics
   ================================================================== */

/**
 * Exposes the current rate-limit state for health checks and admin
 * dashboards. The `usingToken` flag makes it obvious when the process
 * is running without a GITHUB_TOKEN.
 */
export function getRateLimitStatus() {
    return {
        ...rateLimitState,
        resetInMs: Math.max(0, rateLimitState.resetAt - Date.now()),
        usingToken: Boolean(process.env.GITHUB_TOKEN),
    };
}

/** Clears both in-memory caches. Useful for forced re-syncs. */
export function clearGitHubCache(): void {
    repoInfoCache.clear();
    downloadsCache.clear();
}

/**
 * Copyright (c) 2026 Sobhan Rasoulzadeh Asl (Sobhan-SRZA / Mr. Sinre)
 *
 * Licensed under the BSD 3-Clause License.
 * See the LICENSE file in the project root for license information.
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */