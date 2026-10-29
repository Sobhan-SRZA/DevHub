import {
    uploadAvatar,
    uploadImages,
    uploadVideo,
    uploadZip
} from "../config/upload";
import type {
    Request,
    Response,
    NextFunction,
    RequestHandler
} from "express";
import { ErrorCodes } from "../utils/errorCodes";
import { AppError } from "../utils/AppError";
import multer from "multer";

export const mwUploadAvatar = wrap(uploadAvatar);

/**
 * Wraps a Multer middleware to handle upload errors.
 *
 * Converts Multer errors (e.g., LIMIT_FILE_SIZE) into AppError instances
 * with appropriate HTTP status codes and application error codes.
 */
function wrap(mw: RequestHandler): RequestHandler {
    return (req: Request, res: Response, next: NextFunction) => {
        mw(req, res, (err?: unknown) => {
            if (!err) {
                return next();
            }

            if (err instanceof multer.MulterError) {
                switch (err.code) {
                    case "LIMIT_FILE_SIZE":
                        return next(
                            new AppError(413, ErrorCodes.FILE_TOO_LARGE)
                        );

                    case "LIMIT_FILE_COUNT":
                    case "LIMIT_UNEXPECTED_FILE":
                        return next(
                            new AppError(400, ErrorCodes.MEDIA_LIMIT_REACHED)
                        );

                    default:
                        return next(
                            new AppError(
                                400,
                                ErrorCodes.FILE_UPLOAD_FAILED,
                                err.message
                            )
                        );
                }
            }

            return next(err);
        });
    };
}

export const mwUploadImages = wrap(uploadImages);
export const mwUploadVideo = wrap(uploadVideo);
export const mwUploadZip = wrap(uploadZip);

/**
 * Copyright (c) 2026 Sobhan Rasoulzadeh Asl (Sobhan-SRZA / Mr. Sinre)
 *
 * Licensed under the BSD 3-Clause License.
 * See the LICENSE file in the project root for license information.
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */