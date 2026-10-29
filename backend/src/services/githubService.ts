
import { ErrorCodes } from "../utils/errorCodes";
import { AppError } from "../utils/AppError";

/* ==================================================================
   Types
   ================================================================== */

/**
 * Normalized metadata for a GitHub repository.
 */
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

/* ==================================================================
   URL Parser
   ================================================================== */

/**
 * Parses a GitHub repository URL or shorthand into its owner and
 * repository name.
 *
 * Supported formats:
 * - https://github.com/owner/repo
 * - https://github.com/owner/repo.git
 * - git@github.com:owner/repo.git
 * - owner/repo
 *
 * @returns The repository owner and name, or `null` if the input is invalid.
 */
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

    // Handle the owner/repository shorthand.
    if (/^[\w.-]+\/[\w.-]+$/.test(cleaned)) {
        const [owner, repo] = cleaned.split("/");

        return { owner, repo };
    }

    // Handle HTTPS and other standard URL formats.
    try {
        const parsedUrl = new URL(cleaned);

        if (!/(^|\.)github\.com$/i.test(parsedUrl.hostname)) {
            return null;
        }

        const parts = parsedUrl.pathname.split("/").filter(Boolean);

        if (parts.length < 2) {
            return null;
        }

        return {
            owner: parts[0],
            repo: parts[1],
        };
    } catch {
        // Handle the SSH-style GitHub repository URL.
        const match = cleaned.match(
            /^git@github\.com:([\w.-]+)\/([\w.-]+)$/i
        );

        if (match) {
            return {
                owner: match[1],
                repo: match[2],
            };
        }

        return null;
    }
}

/* ==================================================================
   HTTP Helper
   ================================================================== */

/**
 * Sends an authenticated request to the GitHub REST API.
 *
 * @throws AppError when the request fails or GitHub returns an error.
 */
async function ghFetch<T>(apiPath: string): Promise<T> {
    const headers: Record<string, string> = {
        Accept: "application/vnd.github+json",
        "User-Agent": "devhub-app",
    };

    if (process.env.GITHUB_TOKEN) {
        headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
    }

    let response: Response;

    try {
        response = await fetch(`https://api.github.com${apiPath}`, {
            headers,
            signal: AbortSignal.timeout(8000),
        });
    } catch {
        throw new AppError(
            503,
            ErrorCodes.GITHUB_API_ERROR,
            "Unable to connect to the GitHub API."
        );
    }

    if (response.status === 404) {
        throw new AppError(404, ErrorCodes.GITHUB_REPO_NOT_FOUND);
    }

    if (response.status === 403 || response.status === 429) {
        throw new AppError(429, ErrorCodes.GITHUB_RATE_LIMIT);
    }

    if (!response.ok) {
        throw new AppError(502, ErrorCodes.GITHUB_API_ERROR);
    }

    return (await response.json()) as T;
}

/* ==================================================================
   Fetch Repository Information
   ================================================================== */

/**
 * Retrieves and normalizes metadata for a GitHub repository.
 */
export async function fetchRepoInfo(
    owner: string,
    repo: string
): Promise<GitHubRepoInfo> {
    const data: any = await ghFetch(
        `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`
    );

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
   Fetch Download Statistics
   ================================================================== */

/**
 * Calculates the total download count across the repository's latest
 * 100 releases and their associated assets.
 *
 * Returns zero if the repository has no releases.
 */
export async function fetchRepoDownloads(
    owner: string,
    repo: string
): Promise<number> {
    try {
        const releases: any[] = await ghFetch(
            `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/releases?per_page=100`
        );

        let totalDownloads = 0;

        for (const release of releases) {
            for (const asset of release.assets || []) {
                totalDownloads += asset.download_count || 0;
            }
        }

        return totalDownloads;
    } catch (error) {
        // A repository without releases has no downloadable release assets.
        if (error instanceof AppError && error.statusCode === 404) {
            return 0;
        }

        throw error;
    }
}

/* ==================================================================
   Aggregate Repository Data
   ================================================================== */

/**
 * Fetches repository metadata and release download statistics concurrently.
 *
 * Download statistics are optional; failures retrieving them do not prevent
 * repository metadata from being returned.
 */
export async function fetchFullRepoData(
    owner: string,
    repo: string
) {
    const [info, downloads] = await Promise.all([
        fetchRepoInfo(owner, repo),
        fetchRepoDownloads(owner, repo).catch(() => 0),
    ]);

    return { info, downloads };
}

/* ==================================================================
   Cache Synchronization
   ================================================================== */

/**
 * Determines whether repository data should be synchronized again.
 *
 * @param lastSyncedAt - Timestamp of the most recent successful sync.
 * @param maxAgeHours - Maximum permitted cache age, in hours.
 * @returns `true` if no previous sync exists or the cache has expired.
 */
export function shouldResync(
    lastSyncedAt: Date | null | undefined,
    maxAgeHours = 6
): boolean {
    if (!lastSyncedAt) {
        return true;
    }

    const ageMs = Date.now() - new Date(lastSyncedAt).getTime();

    return ageMs > maxAgeHours * 60 * 60 * 1000;
}

/**
 * Copyright (c) 2026 Sobhan Rasoulzadeh Asl (Sobhan-SRZA / Mr. Sinre)
 *
 * Licensed under the BSD 3-Clause License.
 * See the LICENSE file in the project root for license information.
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */