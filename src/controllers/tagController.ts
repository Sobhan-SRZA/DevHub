import {
    createTagSchema,
    updateTagSchema,
    listQuerySchema,
    findOrCreateTagSchema,
    suggestTagsSchema,
    createTagTypeSchema,
    updateTagTypeSchema
} from "../validators/tagValidator";
import {
    AppError,
    Conflict,
    Forbidden
} from "../utils/AppError";
import type {
    Request,
    Response
} from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { ErrorCodes } from "../utils/errorCodes";
import { validate } from "../utils/validate";
import { Project } from "../models/Project";
import { TagType } from "../models/TagType";
import { Tag } from "../models/Tag";

/* ==================================================================
   Helpers
   ================================================================== */
function slugify(input: string): string {
    return input
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 40);
}

/**
 * تگ رو case-insensitive پیدا می‌کنه.
 */
async function findTagCI(name: string, typeId: string) {
    const slug = slugify(name);
    return Tag.findOne({ slug, type: typeId });
}

/* ==================================================================
   LIST TAG TYPES — با تعداد تگ هر کتگوری
   ================================================================== */
export const listTagTypes = asyncHandler(async (req: Request, res: Response) => {
    const includeUnapproved = req.query.all === "true" && (req as any).user?.role === "admin";

    const filter: Record<string, unknown> = {};
    if (!includeUnapproved) {
        filter.isApproved = true;
    }

    const types = await TagType.find(filter).sort({ order: 1, name: 1 }).lean();

    // تعداد تگ‌های approved هر کتگوری
    const counts = await Tag.aggregate([
        { $match: { isApproved: true } },
        { $group: { _id: "$type", count: { $sum: 1 } } }
    ]);
    const countMap = new Map(counts.map((c) => [String(c._id), c.count]));

    res.json({
        ok: true,
        types: types.map((t) => ({
            ...t,
            tagCount: countMap.get(String(t._id)) || 0
        }))
    });
});

/* ==================================================================
   GET TAG TYPE
   ================================================================== */
export const getTagType = asyncHandler(async (req: Request, res: Response) => {
    const type = await TagType.findById(req.params.id).lean();
    if (!type)
        throw new AppError(404, ErrorCodes.TAG_TYPE_NOT_FOUND);

    const tags = await Tag.find({ type: type._id, isApproved: true })
        .sort({ usageCount: -1, name: 1 })
        .lean();

    res.json({ ok: true, type, tags });
});

/* ==================================================================
   CREATE TAG TYPE
   ================================================================== */
export const createTagType = asyncHandler(async (req: any, res: Response) => {
    const data = validate(createTagTypeSchema, req.body);
    const slug = data.slug || slugify(data.name);

    const existing = await TagType.findOne({ slug }).lean();
    if (existing)
        throw Conflict(ErrorCodes.TAG_TYPE_TAKEN);

    // کاربر عادی → isApproved: false
    const isAdmin = req.user?.role === "admin";

    const type = await TagType.create({
        ...data,
        slug,
        isSystem: false,
        isApproved: isAdmin,     // admin بلافاصله تایید، بقیه در انتظار
        createdBy: req.user._id
    });

    res.status(201).json({ ok: true, type });
});

/* ==================================================================
   UPDATE TAG TYPE
   ================================================================== */
export const updateTagType = asyncHandler(async (req: any, res: Response) => {
    const data = validate(updateTagTypeSchema, req.body);

    const type = await TagType.findById(req.params.id);
    if (!type)
        throw new AppError(404, ErrorCodes.TAG_TYPE_NOT_FOUND);

    if (type.isSystem && req.user?.role !== "admin") {
        throw Forbidden(ErrorCodes.TAG_TYPE_IS_SYSTEM);
    }

    if (!type.isSystem && String(type.createdBy) !== String(req.user._id) && req.user?.role !== "admin") {
        throw Forbidden(ErrorCodes.PROJECT_NOT_OWNED);
    }

    if (data.slug && data.slug !== type.slug) {
        const dup = await TagType.findOne({ slug: data.slug }).lean();
        if (dup)
            throw Conflict(ErrorCodes.TAG_TYPE_TAKEN);
    }

    Object.assign(type, data);
    await type.save();

    res.json({ ok: true, type });
});

/* ==================================================================
   DELETE TAG TYPE
   ================================================================== */
export const deleteTagType = asyncHandler(async (req: any, res: Response) => {
    const type = await TagType.findById(req.params.id);
    if (!type)
        throw new AppError(404, ErrorCodes.TAG_TYPE_NOT_FOUND);

    if (type.isSystem && req.user?.role !== "admin") {
        throw Forbidden(ErrorCodes.TAG_TYPE_IS_SYSTEM);
    }

    const tagCount = await Tag.countDocuments({ type: type._id });
    if (tagCount > 0)
        throw Conflict(ErrorCodes.TAG_TYPE_HAS_TAGS);

    await type.deleteOne();
    res.json({ ok: true, message: "کتگوری حذف شد" });
});

/* ==================================================================
   LIST TAGS
   ================================================================== */
export const listTags = asyncHandler(async (req: Request, res: Response) => {
    const q = validate(listQuerySchema, req.query);

    const filter: Record<string, unknown> = {};
    if (q.type)
        filter.type = q.type;

    if (q.search) {
        filter.$or = [
            { name: { $regex: q.search, $options: "i" } },
            { slug: { $regex: q.search, $options: "i" } },
        ];
    }

    if (q.approved)
        filter.isApproved = true;

    const sortMap: Record<string, Record<string, 1 | -1>> = {
        name: { name: 1 },
        usage: { usageCount: -1, name: 1 },
        recent: { createdAt: -1 }
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
   GET TAG
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
        isPublic: true
    });

    res.json({ ok: true, tag, projectCount });
});

/* ==================================================================
   SUGGEST — autocomplete برای picker
   ==================================================================
   ورودی: q, type?, limit
   خروجی: تگ‌ها گروه‌بندی‌شده بر اساس type
   ================================================================== */
export const suggestTags = asyncHandler(async (req: Request, res: Response) => {
    const q = validate(suggestTagsSchema, req.query);

    const filter: Record<string, unknown> = { isApproved: true };
    if (q.type)
        filter.type = q.type;

    if (q.q) {
        const safe = q.q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        filter.$or = [
            { name: { $regex: "^" + safe, $options: "i" } },   // شروع با ← اولویت
            { name: { $regex: safe, $options: "i" } }
        ];
    }

    const tags = await Tag.find(filter)
        .populate("type", "name slug color icon")
        .sort({ usageCount: -1, name: 1 })
        .limit(q.limit)
        .lean();

    res.json({ ok: true, tags });
});

/* ==================================================================
   FIND OR CREATE — قلب سیستم picker
   ==================================================================
   ورودی: { name, type }
   رفتار:
     1. اگه تگ با همون slug تو همون کتگوری وجود داشت → برش گردون
     2. اگه نه:
        - چک کن کتگوری allowUserTags باشه
        - چک کن maxTags رعایت شده
        - تگ جدید بساز
   ================================================================== */
export const findOrCreateTag = asyncHandler(async (req: any, res: Response) => {
    const data = validate(findOrCreateTagSchema, req.body);
    const slug = slugify(data.name);

    /* ---------- چک کتگوری ---------- */
    const type = await TagType.findById(data.type);
    if (!type)
        throw new AppError(404, ErrorCodes.TAG_TYPE_NOT_FOUND);

    if (!type.isApproved)
        throw new AppError(400, ErrorCodes.TAG_TYPE_NOT_FOUND, "این کتگوری تایید نشده");

    /* ---------- چک وجود تگ ---------- */
    const existing = await Tag.findOne({ slug, type: type._id });
    if (existing) {
        const populated = await existing.populate("type", "name slug color icon");

        return res.json({ ok: true, tag: populated, created: false });
    }

    /* ---------- کاربر می‌تونه تگ بسازه؟ ---------- */
    const isAdmin = req.user?.role === "admin";
    if (!type.allowUserTags && !isAdmin) {
        throw Forbidden(
            ErrorCodes.TAG_TYPE_IS_SYSTEM,
            `در کتگوری «${type.name}» فقط ادمین می‌تواند تگ جدید اضافه کند`
        );
    }

    /* ---------- سقف تگ‌ها ---------- */
    if (type.maxTags != null) {
        const count = await Tag.countDocuments({ type: type._id });
        if (count >= type.maxTags) {
            throw new AppError(
                400,
                ErrorCodes.MEDIA_LIMIT_REACHED,
                `این کتگوری به حداکثر تعداد تگ (${type.maxTags}) رسیده است`
            );
        }
    }

    /* ---------- ساخت تگ جدید ---------- */
    const tag = await Tag.create({
        name: data.name,
        slug,
        type: type._id,
        color: type.color,
        isSystem: false,
        isApproved: isAdmin,       // ادمین تایید فوری، بقیه در انتظار
        createdBy: req.user._id
    });

    const populated = await tag.populate("type", "name slug color icon");

    res.status(201).json({
        ok: true,
        tag: populated,
        created: true,
        pendingApproval: !isAdmin
    });
});

/* ==================================================================
   CREATE TAG — مستقیم (نادر استفاده)
   ================================================================== */
export const createTag = asyncHandler(async (req: any, res: Response) => {
    const data = validate(createTagSchema, req.body);
    const slug = data.slug || slugify(data.name);

    const type = await TagType.findById(data.type).lean();
    if (!type)
        throw new AppError(404, ErrorCodes.TAG_TYPE_NOT_FOUND);

    const dup = await Tag.findOne({ slug, type: data.type }).lean();
    if (dup)
        throw Conflict(ErrorCodes.TAG_TAKEN);

    const isAdmin = req.user?.role === "admin";

    const tag = await Tag.create({
        name: data.name,
        slug,
        type: data.type,
        color: data.color || type.color,
        description: data.description,
        isSystem: false,
        isApproved: isAdmin,
        createdBy: req.user._id
    });

    const populated = await tag.populate("type", "name slug color icon");
    res.status(201).json({ ok: true, tag: populated });
});

/* ==================================================================
   UPDATE TAG
   ================================================================== */
export const updateTag = asyncHandler(async (req: any, res: Response) => {
    const tag = req.tag;
    const data = validate(updateTagSchema, req.body);

    if (data.name && !data.slug) {
        const newSlug = slugify(data.name);
        if (newSlug !== tag.slug) {
            const dup = await Tag.findOne({
                slug: newSlug,
                type: tag.type,
                _id: { $ne: tag._id },
            }).lean();

            if (dup)
                throw Conflict(ErrorCodes.TAG_TAKEN);

            data.slug = newSlug;
        }
    }

    // ویرایش → نیاز به تایید مجدد (اگه کاربر عادی)
    const isAdmin = req.user?.role === "admin";
    if (!isAdmin && !tag.isSystem) {
        tag.isApproved = false;
    }

    Object.assign(tag, data);
    await tag.save();

    const populated = await tag.populate("type", "name slug color icon");
    res.json({ ok: true, tag: populated });
});

/* ==================================================================
   DELETE TAG
   ================================================================== */
export const deleteTag = asyncHandler(async (req: any, res: Response) => {
    const tag = req.tag;

    const inUse = await Project.countDocuments({ tags: tag._id });
    if (inUse > 0)
        throw Conflict(ErrorCodes.TAG_IN_USE);

    await tag.deleteOne();
    res.json({ ok: true, message: "تگ حذف شد" });
});

/* ==================================================================
   APPROVE TAG — admin
   ================================================================== */
export const approveTag = asyncHandler(async (req: any, res: Response) => {
    if (req.user?.role !== "admin")
        throw Forbidden(ErrorCodes.PROJECT_NOT_OWNED);

    const tag = await Tag.findById(req.params.id);
    if (!tag)
        throw new AppError(404, ErrorCodes.TAG_NOT_FOUND);

    tag.isApproved = true;
    await tag.save();

    const populated = await tag.populate("type", "name slug color icon");
    res.json({ ok: true, tag: populated });
});

/* ==================================================================
   APPROVE TAG TYPE — admin
   ================================================================== */
export const approveTagType = asyncHandler(async (req: any, res: Response) => {
    if (req.user?.role !== "admin")
        throw Forbidden(ErrorCodes.PROJECT_NOT_OWNED);

    const type = await TagType.findById(req.params.id);
    if (!type)
        throw new AppError(404, ErrorCodes.TAG_TYPE_NOT_FOUND);

    type.isApproved = true;
    await type.save();

    res.json({ ok: true, type });
});

/* ==================================================================
   PENDING — لیست تگ‌ها/کتگوری‌های در انتظار تایید (admin)
   ================================================================== */
export const listPending = asyncHandler(async (req: any, res: Response) => {
    if (req.user?.role !== "admin")
        throw Forbidden(ErrorCodes.PROJECT_NOT_OWNED);

    const [tags, types] = await Promise.all([
        Tag.find({ isApproved: false })
            .populate("type", "name slug color icon")
            .populate("createdBy", "name username")
            .sort({ createdAt: -1 })
            .lean(),

        TagType.find({ isApproved: false })
            .populate("createdBy", "name username")
            .sort({ createdAt: -1 })
            .lean()
    ]);

    res.json({ ok: true, tags, types });
});

/**
 * Copyright (c) 2026 Sobhan Rasoulzadeh Asl (Sobhan-SRZA / Mr. Sinre)
 *
 * Licensed under the BSD 3-Clause License.
 * See the LICENSE file in the project root for license information.
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */