
import { UPLOAD_ROOT } from "../config/upload";
import path from "path";
import fs from "fs/promises";

/**
 * Converts an absolute file path into a public upload URL.
 */
export function toPublicUrl(absolutePath: string): string {
    const relativePath = path.relative(UPLOAD_ROOT, absolutePath);

    return `/uploads/${relativePath.split(path.sep).join("/")}`;
}

/**
 * Converts a public upload URL into an absolute file path.
 * Rejects invalid URLs and paths that escape the upload directory.
 */
export function toAbsolutePath(publicUrl: string): string {
    if (!publicUrl.startsWith("/uploads/")) {
        throw new Error("Invalid upload URL.");
    }

    const relativePath = publicUrl.slice("/uploads/".length);
    const absolutePath = path.resolve(UPLOAD_ROOT, relativePath);
    const relativeToRoot = path.relative(UPLOAD_ROOT, absolutePath);

    // Prevent path traversal outside the upload directory.
    if (
        relativeToRoot === ".." ||
        relativeToRoot.startsWith(`..${path.sep}`) ||
        path.isAbsolute(relativeToRoot)
    ) {
        throw new Error("Path traversal detected.");
    }

    return absolutePath;
}

/**
 * Safely deletes a file identified by its public upload URL.
 *
 * @returns `true` if the file was deleted; otherwise, `false`.
 */
export async function deleteFile(publicUrl: string): Promise<boolean> {
    try {
        const absolutePath = toAbsolutePath(publicUrl);
        await fs.unlink(absolutePath);

        return true;
    } catch {
        return false;
    }
}

/**
 * Recursively deletes all uploaded files associated with a project.
 */
export async function deleteProjectFiles(projectId: string): Promise<void> {
    const projectsDirectory = path.join(UPLOAD_ROOT, "projects");
    const subdirectories = ["images", "videos", "files"];

    for (const subdirectory of subdirectories) {
        const projectDirectory = path.join(
            projectsDirectory,
            subdirectory,
            String(projectId)
        );

        try {
            await fs.rm(projectDirectory, {
                recursive: true,
                force: true,
            });
        } catch {
            // Ignore deletion errors to allow cleanup of other directories.
        }
    }
}

/**
 * Formats a file size in a human-readable unit.
 */
export function humanSize(bytes: number): string {
    if (bytes < 1024) {
        return `${bytes} B`;
    }

    if (bytes < 1024 ** 2) {
        return `${(bytes / 1024).toFixed(1)} KB`;
    }

    if (bytes < 1024 ** 3) {
        return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
    }

    return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

/**
 * Copyright (c) 2026 Sobhan Rasoulzadeh Asl (Sobhan-SRZA / Mr. Sinre)
 *
 * Licensed under the BSD 3-Clause License.
 * See the LICENSE file in the project root for license information.
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */