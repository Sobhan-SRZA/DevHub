import fs from "fs/promises";
import path from "path";
import { UPLOAD_ROOT } from "../config/upload";

/* ==================================================================
   Convert absolute path → public URL
   ================================================================== */
export function toPublicUrl(absolutePath: string): string {
    const rel = path.relative(UPLOAD_ROOT, absolutePath);
    return `/uploads/${rel.split(path.sep).join("/")}`;
}

/* ==================================================================
   Convert public URL → absolute path (safe)
   ================================================================== */
export function toAbsolutePath(publicUrl: string): string {
    if (!publicUrl.startsWith("/uploads/")) {
        throw new Error("Invalid upload URL");
    }
    const rel = publicUrl.replace("/uploads/", "");
    const abs = path.resolve(UPLOAD_ROOT, rel);
    // جلوگیری از path traversal
    if (!abs.startsWith(UPLOAD_ROOT)) throw new Error("Path traversal detected");
    return abs;
}

/* ==================================================================
   Delete a file safely
   ================================================================== */
export async function deleteFile(publicUrl: string): Promise<boolean> {
    try {
        const abs = toAbsolutePath(publicUrl);
        await fs.unlink(abs);
        return true;
    } catch {
        return false;
    }
}

/* ==================================================================
   Delete all files of a project
   ================================================================== */
export async function deleteProjectFiles(projectId: string): Promise<void> {
    const baseDir = path.join(UPLOAD_ROOT, "projects");
    const subdirs = ["images", "videos", "files"];

    for (const sub of subdirs) {
        const dir = path.join(baseDir, sub, String(projectId));
        try {
            await fs.rm(dir, { recursive: true, force: true });
        } catch {
            /* ignore */
        }
    }
}

/* ==================================================================
   Human readable size
   ================================================================== */
export function humanSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

/**
 * Copyright (c) 2026 Sobhan Rasoulzadeh Asl (Sobhan-SRZA / Mr. Sinre)
 *
 * Licensed under the BSD 3-Clause License.
 * See the LICENSE file in the project root for license information.
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */