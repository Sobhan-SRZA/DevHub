import { ErrorCodes } from "../utils/errorCodes";
import { AppError } from "../utils/AppError";
import crypto from "crypto";
import multer from "multer";
import path from "path";
import fs from "fs";

/* ==================================================================
   Constants
   ================================================================== */
export const UPLOAD_ROOT = path.resolve(process.cwd(), "uploads");

export const LIMITS = {
    IMAGE_SIZE: 5 * 1024 * 1024,          // 5 MB
    VIDEO_SIZE: 200 * 1024 * 1024,        // 200 MB
    FILE_SIZE: 500 * 1024 * 1024,         // 500 MB
    MAX_IMAGES: 10
};

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
};

/* ==================================================================
   Ensure directory exists
   ================================================================== */
function ensureDir(dir: string) {
    if (!fs.existsSync(dir))
        fs.mkdirSync(dir, { recursive: true });

    return dir;
}

/* ==================================================================
   Storage factory
   ================================================================== */
function makeStorage(subdir: string) {
    return multer.diskStorage({
        destination: (req, _file, cb) => {
            const projectId = (req as any).project?._id
                || (req as any).params?.id
                || "temp";

            const dir = path.join(UPLOAD_ROOT, "projects", subdir, String(projectId));

            ensureDir(dir);
            cb(null, dir);
        },
        filename: (_req, file, cb) => {
            const ext = path.extname(file.originalname).toLowerCase();
            const id = crypto.randomBytes(12).toString("hex");
            const stamp = Date.now();

            cb(null, `${stamp}-${id}${ext}`);
        }
    });
}

/* ==================================================================
   File filters
   ================================================================== */
function makeFilter(allowed: string[]) {
    return (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
        if (allowed.includes(file.mimetype))
            return cb(null, true);

        cb(new AppError(400, ErrorCodes.FILE_TYPE_INVALID, `فرمت ${file.mimetype} مجاز نیست`));
    };
}

/* ==================================================================
   Uploaders
   ================================================================== */
export const uploadImages = multer({
    storage: makeStorage("images"),
    limits: { fileSize: LIMITS.IMAGE_SIZE, files: LIMITS.MAX_IMAGES },
    fileFilter: makeFilter(ALLOWED.IMAGE)
}).array("images", LIMITS.MAX_IMAGES);

export const uploadVideo = multer({
    storage: makeStorage("videos"),
    limits: { fileSize: LIMITS.VIDEO_SIZE, files: 1 },
    fileFilter: makeFilter(ALLOWED.VIDEO)
}).single("video");

export const uploadZip = multer({
    storage: makeStorage("files"),
    limits: { fileSize: LIMITS.FILE_SIZE, files: 1 },
    fileFilter: makeFilter(ALLOWED.FILE)
}).single("file");

/* ==================================================================
   AVATAR — 5MB, image + gif
   ================================================================== */
const AVATAR_ALLOWED = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif"
];

function makeAvatarStorage() {
    return multer.diskStorage({
        destination: (_req, _file, cb) => {
            const dir = path.join(UPLOAD_ROOT, "avatars");
            ensureDir(dir);
            cb(null, dir);
        },

        filename: (_req, file, cb) => {
            const ext = path.extname(file.originalname).toLowerCase() || ".png";
            const id = crypto.randomBytes(12).toString("hex");
            cb(null, `${Date.now()}-${id}${ext}`);
        }
    });
}

export const uploadAvatar = multer({
    storage: makeAvatarStorage(),
    limits: { fileSize: 5 * 1024 * 1024, files: 1 },
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