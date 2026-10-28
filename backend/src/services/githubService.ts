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

/* ==================================================================
   URL parser
   ================================================================== */
export function parseGitHubUrl(url: string): { owner: string; repo: string } | null {
    if (!url)
        return null;

    // پشتیبانی از:
    //   https://github.com/owner/repo
    //   https://github.com/owner/repo.git
    //   git@github.com:owner/repo.git
    //   owner/repo
    const cleaned = url.trim().replace(/\.git$/, "").replace(/\/$/, "");

    // حالت owner/repo ساده
    if (/^[\w.-]+\/[\w.-]+$/.test(cleaned)) {
        const [owner, repo] = cleaned.split("/");

        return { owner, repo };
    }

    // حالت URL کامل
    try {
        const u = new URL(cleaned);
        if (!/(^|\.)github\.com$/i.test(u.hostname))
            return null;

        const parts = u.pathname.split("/").filter(Boolean);
        if (parts.length < 2)
            return null;

        return { owner: parts[0], repo: parts[1] };
    }

    catch {
        // git@github.com:owner/repo
        const m = cleaned.match(/^git@github\.com:([\w.-]+)\/([\w.-]+)$/);
        if (m)
            return { owner: m[1], repo: m[2] };

        return null;
    }
}

/* ==================================================================
   HTTP helper
   ================================================================== */
async function ghFetch<T>(path: string): Promise<T> {
    const headers: Record<string, string> = {
        Accept: "application/vnd.github+json",
        "User-Agent": "devhub-app",
    };

    if (process.env.GITHUB_TOKEN) {
        headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
    }

    let res: Response;
    try {
        res = await fetch(`https://api.github.com${path}`, {
            headers,
            signal: AbortSignal.timeout(8000)
        });
    }

    catch (err) {
        throw new AppError(503, ErrorCodes.GITHUB_API_ERROR, "ارتباط با GitHub برقرار نشد");
    }

    if (res.status === 404) {
        throw new AppError(404, ErrorCodes.GITHUB_REPO_NOT_FOUND);
    }

    if (res.status === 403 || res.status === 429) {
        throw new AppError(429, ErrorCodes.GITHUB_RATE_LIMIT);
    }

    if (!res.ok) {
        throw new AppError(502, ErrorCodes.GITHUB_API_ERROR);
    }

    return (await res.json()) as T;
}

/* ==================================================================
   Fetch repo info
   ================================================================== */
export async function fetchRepoInfo(owner: string, repo: string): Promise<GitHubRepoInfo> {
    const data: any = await ghFetch(`/repos/${owner}/${repo}`);

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
        isArchived: !!data.archived,
        isFork: !!data.fork,
        createdAt: new Date(data.created_at),
        updatedAt: new Date(data.updated_at),
        pushedAt: new Date(data.pushed_at)
    };
}

/* ==================================================================
   Fetch downloads (from releases)
   ================================================================== */
export async function fetchRepoDownloads(owner: string, repo: string): Promise<number> {
    try {
        const releases: any[] = await ghFetch(`/repos/${owner}/${repo}/releases?per_page=100`);
        let total = 0;
        for (const r of releases) {
            for (const asset of r.assets || []) {
                total += asset.download_count || 0;
            }
        }

        return total;
    }

    catch (err) {
        // اگه release نداشت، 0 برگردون بدون خطا
        if (err instanceof AppError && err.statusCode === 404)
            return 0;

        throw err;
    }
}

/* ==================================================================
   Aggregate fetch — repo + downloads
   ================================================================== */
export async function fetchFullRepoData(owner: string, repo: string) {
    const [info, downloads] = await Promise.all([
        fetchRepoInfo(owner, repo),
        fetchRepoDownloads(owner, repo).catch(() => 0),
    ]);

    return { info, downloads };
}

/* ==================================================================
   Cache helper — آیا نیاز به sync مجدد داریم؟
   ================================================================== */
export function shouldResync(lastSyncedAt: Date | null | undefined, maxAgeHours = 6): boolean {
    if (!lastSyncedAt)
        return true;

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