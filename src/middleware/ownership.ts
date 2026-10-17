import type {
    Response,
    NextFunction
} from "express";
import { ErrorCodes } from "../utils/errorCodes";
import { AppError } from "../utils/AppError";
import { Project } from "../models/Project";
import { Tag } from "../models/Tag";

/**
 * چک می‌کنه پروژه متعلق به کاربر فعلی باشه.
 * نتیجه رو تو req.project می‌ذاره که کنترلر دوباره query نزنه.
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
    }

    catch (err) {
        next(err);
    }
}

/**
 * چک می‌کنه تگ توسط کاربر ساخته شده یا system باشه.
 * اگه system → اجازه تغییر نمی‌دیم مگه admin.
 */
export async function requireTagOwnership(
    req: any,
    _res: Response,
    next: NextFunction
) {
    try {
        const tag = await Tag.findById(req.params.id);
        if (!tag)
            return next(new AppError(404, ErrorCodes.TAG_NOT_FOUND));

        const isSystem = tag.createdBy === null;
        const isOwner = req.user && String(tag.createdBy) === String(req.user._id);
        const isAdmin = req.user?.role === "admin";

        if (isSystem && !isAdmin) {
            return next(new AppError(403, ErrorCodes.TAG_TYPE_IS_SYSTEM, "تگ‌های سیستمی قابل تغییر نیستند"));
        }

        if (!isOwner && !isAdmin) {
            return next(new AppError(403, ErrorCodes.PROJECT_NOT_OWNED));
        }

        req.tag = tag;

        next();
    }

    catch (err) {
        next(err);
    }
}

/* ==================================================================
   loadProject — NEW
   فقط پروژه رو بارگذاری می‌کنه (با id یا slug)
   چک مالکیت نمی‌کنه، ولی دسترسی عمومی/خصوصی رو رعایت می‌کنه.
   ================================================================== */
export async function loadProject(
    req: any,
    _res: Response,
    next: NextFunction
) {
    try {
        const { idOrSlug } = req.params;
        if (!idOrSlug) {
            return next(new AppError(400, ErrorCodes.VALIDATION_ERROR, 'شناسه پروژه الزامی است'));
        }

        const isObjectId = /^[a-f\d]{24}$/i.test(idOrSlug);
        const query = isObjectId ? { _id: idOrSlug } : { slug: idOrSlug };

        const project = await Project.findOne(query);
        if (!project) {
            return next(new AppError(404, ErrorCodes.PROJECT_NOT_FOUND));
        }

        // اگه private/draft هست، فقط صاحبش یا ادمین می‌تونه ببینه
        const isOwner = req.user && String(project.owner) === String(req.user._id);
        const isAdmin = req.user?.role === 'admin';

        if ((!project.isPublic || project.status !== 'published') && !isOwner && !isAdmin) {
            return next(new AppError(403, ErrorCodes.PROJECT_NOT_OWNED));
        }

        req.project = project;
        next();
    } 
    
    catch (err) {
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