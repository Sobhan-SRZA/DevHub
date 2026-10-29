
import crypto from "crypto";
import fs from "fs";
import multer from "multer";
import path from "path";

import { AppError } from "../utils/AppError";
import { ErrorCodes } from "../utils/errorCodes";

/* ========================================================================== */
/* Constants                                                                  */
/* ========================================================================== */

/**
 * Root directory for all uploaded files.
 */
export const UPLOAD_ROOT = path.resolve(process.cwd(), "backend/uploads");

/**
 * Maximum permitted upload sizes and file counts.
 */
export const LIMITS = {
    IMAGE_SIZE: 5 * 1024 * 1024,       // 5 MB
    VIDEO_SIZE: 200 * 1024 * 1024,     // 200 MB
    FILE_SIZE: 500 * 1024 * 1024,      // 500 MB
    MAX_IMAGES: 10
} as const;

/**
 * Allowed MIME types for each supported upload category.
 */
export const ALLOWED = {
    IMAGE: ["image/jpeg", "image/png", "image/webp", "image/gif"],
    VIDEO: ["video/mp4", "video/webm", "video/quicktime"],
    FILE: [
        "application/zip",
        "application/x-zip-compressed",
        "application/x-rar-compressed",
        "application/gzip",
        "application/x-7z-compressed",
        "application/x-tar"
    ]
} as const;

/* ========================================================================== */
/* Directory Management                                                       */
/* ========================================================================== */

/**
 * Ensures that the specified directory exists.
 *
 * @param dir - Absolute or relative path to the directory.
 * @returns The original directory path.
 */
function ensureDir(dir: string): string {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    return dir;
}

/* ========================================================================== */
/* Storage Configuration                                                      */
/* ========================================================================== */

/**
 * Creates a Multer disk storage engine for project-related uploads.
 *
 * Files are organized by category and project ID. Requests without an
 * associated project ID are stored under the temporary directory.
 *
 * @param subdir - Upload category directory.
 * @returns A configured Multer disk storage engine.
 */
function makeStorage(subdir: string): multer.StorageEngine {
    return multer.diskStorage({
        destination: (req, _file, cb) => {
            const projectId =
                (req as any).project?._id ??
                (req as any).params?.id ??
                "temp";

            const directory = path.join(
                UPLOAD_ROOT,
                "projects",
                subdir,
                String(projectId)
            );

            ensureDir(directory);
            cb(null, directory);
        },

        filename: (_req, file, cb) => {
            const extension = path.extname(file.originalname).toLowerCase();
            const uniqueId = crypto.randomBytes(12).toString("hex");
            const timestamp = Date.now();

            cb(null, `${timestamp}-${uniqueId}${extension}`);
        }
    });
}

/* ========================================================================== */
/* File Validation                                                            */
/* ========================================================================== */

/**
 * Creates a Multer file filter that validates MIME types against an allowlist.
 *
 * @param allowed - List of permitted MIME types.
 * @returns A Multer-compatible file filter callback.
 */
function makeFilter(allowed: readonly string[]) {
    return (
        _req: Express.Request,
        file: Express.Multer.File,
        cb: multer.FileFilterCallback
    ): void => {
        if (allowed.includes(file.mimetype)) {
            return cb(null, true);
        }

        cb(
            new AppError(
                400,
                ErrorCodes.FILE_TYPE_INVALID,
                `File type "${file.mimetype}" is not allowed.`
            )
        );
    };
}

/* ========================================================================== */
/* Project Upload Middleware                                                  */
/* ========================================================================== */

/**
 * Handles image uploads.
 *
 * Accepts up to the configured maximum number of images, with a maximum
 * file size of 5 MB per image.
 */
export const uploadImages = multer({
    storage: makeStorage("images"),
    limits: {
        fileSize: LIMITS.IMAGE_SIZE,
        files: LIMITS.MAX_IMAGES
    },
    fileFilter: makeFilter(ALLOWED.IMAGE)
}).array("images", LIMITS.MAX_IMAGES);

/**
 * Handles video uploads.
 *
 * Accepts a single video file up to 200 MB.
 */
export const uploadVideo = multer({
    storage: makeStorage("videos"),
    limits: {
        fileSize: LIMITS.VIDEO_SIZE,
        files: 1
    },
    fileFilter: makeFilter(ALLOWED.VIDEO)
}).single("video");

/**
 * Handles compressed archive uploads.
 *
 * Accepts a single archive file up to 500 MB.
 */
export const uploadZip = multer({
    storage: makeStorage("files"),
    limits: {
        fileSize: LIMITS.FILE_SIZE,
        files: 1
    },
    fileFilter: makeFilter(ALLOWED.FILE)
}).single("file");

/* ========================================================================== */
/* Avatar Upload Middleware                                                   */
/* ========================================================================== */

/**
 * Allowed MIME types for user avatar uploads.
 */
const AVATAR_ALLOWED = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif"
] as const;

/**
 * Creates a Multer disk storage engine for user avatars.
 *
 * Avatar files are stored in a dedicated directory, independently
 * of project-related uploads.
 *
 * @returns A configured Multer disk storage engine.
 */
function makeAvatarStorage(): multer.StorageEngine {
    return multer.diskStorage({
        destination: (_req, _file, cb) => {
            const directory = path.join(UPLOAD_ROOT, "avatars");

            ensureDir(directory);
            cb(null, directory);
        },

        filename: (_req, file, cb) => {
            const extension =
                path.extname(file.originalname).toLowerCase() || ".png";
            const uniqueId = crypto.randomBytes(12).toString("hex");
            const timestamp = Date.now();

            cb(null, `${timestamp}-${uniqueId}${extension}`);
        }
    });
}

/**
 * Handles user avatar uploads.
 *
 * Accepts a single image file up to 5 MB, including animated GIFs.
 */
export const uploadAvatar = multer({
    storage: makeAvatarStorage(),
    limits: {
        fileSize: LIMITS.IMAGE_SIZE,
        files: 1
    },
    fileFilter: makeFilter(AVATAR_ALLOWED)
}).single("avatar");

/**
 * Copyright (c) 2026 Sobhan Rasoulzadeh Asl (Sobhan-SRZA / Mr. Sinre)
 *
 * Licensed under the BSD 3-Clause License.
 * See the LICENSE file in the project root for license information.
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */