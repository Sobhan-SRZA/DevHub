import {
    createTagSchema,
    updateTagSchema,
    listQuerySchema,
} from "../validators/tagValidator";
import type {
    Request,
    Response
} from "express";
import {
    AppError,
    Conflict
} from "../utils/AppError";
import { asyncHandler } from "../utils/asyncHandler";
import { ErrorCodes } from "../utils/errorCodes";
import { validate } from "../utils/validate";
import { TagType } from "../models/TagType";
import { Project } from "../models/Project";
import { Tag } from "../models/Tag";

/* ==================================================================
   Helpers
   ================================================================== */
function slugify(input: string): string {
    return input
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9\u0600-\u06FF-]+/g, "-")   // اجازه فارسی هم می‌دیم ولی در slug به حروف لاتین
        .replace(/[\u0600-\u06FF]/g, "")              // فارسی رو حذف کن
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 40) || `tag-${Date.now().toString(36)}`;
}

/* ==================================================================
   LIST — عمومی
   ================================================================== */
export const listTags = asyncHandler(async (req: Request, res: Response) => {
    const q = validate(listQuerySchema, req.query);

    const filter: Record<string, unknown> = {};
    if (q.type) filter.type = q.type;
    if (q.search) {
        filter.$or = [
            { name: { $regex: q.search, $options: "i" } },
            { slug: { $regex: q.search, $options: "i" } }
        ];
    }

    const sortMap: Record<string, Record<string, 1 | -1>> = {
        name: { name: 1 },
        usage: { usageCount: -1, name: 1 },
        recent: { createdAt: -1 },
    };
    const sort = sortMap[q.sort] || sortMap.usage;

    const skip = (q.page - 1) * q.limit;

    const [tags, total] = await Promise.all([
        Tag.find(filter)
            .populate("type", "name slug color icon")
            .sort(sort)
            .skip(skip)
            .limit(q.limit)
            .lean(),
        Tag.countDocuments(filter)
    ]);

    res.json({
        ok: true,
        tags,
        pagination: {
            page: q.page,
            limit: q.limit,
            total,
            pages: Math.ceil(total / q.limit)
        }
    });
});

/* ==================================================================
   GET ONE
   ================================================================== */
export const getTag = asyncHandler(async (req: Request, res: Response) => {
    const tag = await Tag.findById(req.params.id)
        .populate("type", "name slug color icon")
        .lean();
    if (!tag)
        throw new AppError(404, ErrorCodes.TAG_NOT_FOUND);

    const projectCount = await Project.countDocuments({
        tags: tag._id,
        status: "published",
        isPublic: true,
    });

    res.json({ ok: true, tag, projectCount });
});

/* ==================================================================
   CREATE
   ================================================================== */
export const createTag = asyncHandler(async (req: any, res: Response) => {
    const data = validate(createTagSchema, req.body);

    // نوع تگ باید وجود داشته باشه
    const typeExists = await TagType.findById(data.type).lean();
    if (!typeExists)
        throw new AppError(404, ErrorCodes.TAG_TYPE_NOT_FOUND);

    const slug = data.slug || slugify(data.name);

    // چک یکتایی داخل نوع
    const existing = await Tag.findOne({ slug, type: data.type }).lean();
    if (existing)
        throw Conflict(ErrorCodes.TAG_TAKEN);

    const tag = await Tag.create({
        name: data.name,
        slug,
        type: data.type,
        color: data.color,
        description: data.description,
        createdBy: req.user?._id ?? null,
    });

    const populated = await tag.populate("type", "name slug color icon");
    res.status(201).json({ ok: true, tag: populated });
});

/* ==================================================================
   UPDATE
   ================================================================== */
export const updateTag = asyncHandler(async (req: any, res: Response) => {
    // req.tag از middleware requireTagOwnership میاد
    const tag = req.tag;
    const data = validate(updateTagSchema, req.body);

    if (data.name && !data.slug) {
        const newSlug = slugify(data.name);
        const dup = await Tag.findOne({
            slug: newSlug,
            type: tag.type,
            _id: { $ne: tag._id },
        }).lean();
        if (dup)
            throw Conflict(ErrorCodes.TAG_TAKEN);

        data.slug = newSlug;
    }

    Object.assign(tag, data);
    await tag.save();

    const populated = await tag.populate("type", "name slug color icon");
    res.json({ ok: true, tag: populated });
});

/* ==================================================================
   DELETE — فقط اگه در هیچ پروژه‌ای استفاده نشده
   ================================================================== */
export const deleteTag = asyncHandler(async (req: any, res: Response) => {
    const tag = req.tag;

    const inUse = await Project.countDocuments({ tags: tag._id });
    if (inUse > 0) {
        throw Conflict(ErrorCodes.TAG_IN_USE);
    }

    await tag.deleteOne();
    res.json({ ok: true, message: "تگ حذف شد" });
});

/* ==================================================================
   MERGE — ادغام دو تگ (اختیاری، برای admin)
   ================================================================== */
export const mergeTags = asyncHandler(async (req: any, res: Response) => {
    const { sourceId, targetId } = req.body as { sourceId?: string; targetId?: string };
    if (!sourceId || !targetId || sourceId === targetId) {
        throw new AppError(400, ErrorCodes.VALIDATION_ERROR, "پارامترها نامعتبرند");
    }

    const [source, target] = await Promise.all([
        Tag.findById(sourceId),
        Tag.findById(targetId),
    ]);
    if (!source || !target)
        throw new AppError(404, ErrorCodes.TAG_NOT_FOUND);

    // همه پروژه‌های source رو به target تغییر بده
    await Project.updateMany(
        { tags: source._id },
        { $pull: { tags: source._id } }
    );
    await Project.updateMany(
        { tags: { $ne: target._id } },
        { $addToSet: { tags: target._id } }
    );
    // ↑ این کار ساده‌ست ولی برای پروژه‌های زیاد باید batch بشه

    await source.deleteOne();
    res.json({ ok: true, message: "تگ‌ها ادغام شدند" });
});

/**
 * Copyright (c) 2026 Sobhan Rasoulzadeh Asl (Sobhan-SRZA / Mr. Sinre)
 *
 * Licensed under the BSD 3-Clause License.
 * See the LICENSE file in the project root for license information.
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */