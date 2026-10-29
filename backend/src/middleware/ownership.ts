import type {
    Response,
    NextFunction
} from "express";
import { ErrorCodes } from "../utils/errorCodes";
import { AppError } from "../utils/AppError";
import { Project } from "../models/Project";
import { Tag } from "../models/Tag";

/**
 * Ensures that the requested project belongs to the authenticated user.
 * Attaches the project to req.project to prevent redundant database queries
 * in subsequent middleware and controllers.
 */
export async function requireProjectOwnership(
    req: any,
    _res: Response,
    next: NextFunction
) {
    try {
        const project = await Project.findById(req.params.id);

        if (!project) {
            return next(new AppError(404, ErrorCodes.PROJECT_NOT_FOUND));
        }

        if (String(project.owner) !== String(req.user?._id)) {
            return next(new AppError(403, ErrorCodes.PROJECT_NOT_OWNED));
        }

        req.project = project;
        next();
    } catch (err) {
        next(err);
    }
}

/**
 * Ensures that a tag is either owned by the authenticated user or is
 * a system tag accessible to administrators.
 *
 * System tags cannot be modified by non-administrative users.
 */
export async function requireTagOwnership(
    req: any,
    _res: Response,
    next: NextFunction
) {
    try {
        const tag = await Tag.findById(req.params.id);

        if (!tag) {
            return next(new AppError(404, ErrorCodes.TAG_NOT_FOUND));
        }

        const isSystem = tag.createdBy === null;
        const isOwner = req.user && String(tag.createdBy) === String(req.user._id);
        const isAdmin = req.user?.role === "admin";

        if (isSystem && !isAdmin) {
            return next(
                new AppError(
                    403,
                    ErrorCodes.TAG_TYPE_IS_SYSTEM,
                    "System tags cannot be modified"
                )
            );
        }

        if (!isOwner && !isAdmin) {
            return next(new AppError(403, ErrorCodes.PROJECT_NOT_OWNED));
        }

        req.tag = tag;
        next();
    } catch (err) {
        next(err);
    }
}

/* ==================================================================
   loadProject
   Loads a project by ID or slug without checking ownership.
   Enforces public and private access restrictions.
   ================================================================== */

export async function loadProject(
    req: any,
    _res: Response,
    next: NextFunction
) {
    try {
        const { idOrSlug } = req.params;

        if (!idOrSlug) {
            return next(
                new AppError(
                    400,
                    ErrorCodes.VALIDATION_ERROR,
                    "A project identifier is required"
                )
            );
        }

        const isObjectId = /^[a-f\d]{24}$/i.test(idOrSlug);
        const query = isObjectId
            ? { _id: idOrSlug }
            : { slug: idOrSlug };

        const project = await Project.findOne(query);

        if (!project) {
            return next(new AppError(404, ErrorCodes.PROJECT_NOT_FOUND));
        }

        // Restrict access to private or unpublished projects to their owner or an administrator.
        const isOwner = req.user && String(project.owner) === String(req.user._id);
        const isAdmin = req.user?.role === "admin";

        if (
            (!project.isPublic || project.status !== "published") &&
            !isOwner &&
            !isAdmin
        ) {
            return next(new AppError(403, ErrorCodes.PROJECT_NOT_OWNED));
        }

        req.project = project;
        next();
    } catch (err) {
        next(err);
    }
}

/**
 * Copyright (c) 2026 Sobhan Rasoulzadeh Asl (Sobhan-SRZA / Mr. Sinre)
 *
 * Licensed under the BSD 3-Clause License.
 * See the LICENSE file in the project root for license information.
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */