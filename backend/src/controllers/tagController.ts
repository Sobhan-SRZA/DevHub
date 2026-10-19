import {
    createTagSchema,
    updateTagSchema,
    listQuerySchema,
    findOrCreateTagSchema,
    suggestTagsSchema,
    createTagTypeSchema,
    updateTagTypeSchema,
    requestTagTypeSchema
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
import type { Types } from "mongoose";
import { ErrorCodes } from "../utils/errorCodes";
import { validate } from "../utils/validate";
import { Project } from "../models/Project";
import { TagType } from "../models/TagType";
import { Tag } from "../models/Tag";

/* ==================================================================
   Helpers
   ================================================================== */
const GENERAL_SLUG = "general";

function isAdminUser(user: any): boolean {
    return user?.role === "admin" || user?.role === "developer";
}

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
 * کتگوری «عمومی» رو برمی‌گردونه (اگه نبود می‌سازه).
 */
async function getGeneralType(): Promise<{ _id: Types.ObjectId; color: string }> {
    let general = await TagType.findOne({ slug: GENERAL_SLUG }).lean();

    if (!general) {
        const created = await TagType.create({
            name: "عمومی",
            slug: GENERAL_SLUG,
            description: "کتگوری پیش‌فرض برای تگ‌هایی که کتگوری مشخصی ندارند",
            color: "#94a3b8",
            icon: "🌐",
            isSystem: true,
            isApproved: true,
            allowUserTags: true,
            order: 99,
            createdBy: null
        });
        return { _id: created._id, color: created.color };
    }

    // اگه سیستمیش دستکاری شده، درستش کن
    if (!general.isApproved || !general.isSystem) {
        await TagType.updateOne(
            { _id: general._id },
            { $set: { isApproved: true, isSystem: true } }
        );
    }

    return { _id: general._id as any, color: general.color || "#94a3b8" };
}

/* ==================================================================
   TAG TYPES — عمومی
   ================================================================== */
export const listTagTypes = asyncHandler(async (req: any, res: Response) => {
    const isAdmin = isAdminUser(req.user);
    const includeUnapproved = req.query.all === "true" && isAdmin;

    const filter: Record<string, unknown> = {};
    if (!includeUnapproved) filter.isApproved = true;

    const types = await TagType.find(filter).sort({ order: 1, name: 1 }).lean();

    const counts = await Tag.aggregate([
        { $match: { isApproved: true } },
        { $group: { _id: "$type", count: { $sum: 1 } } },
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

export const getTagType = asyncHandler(async (req: Request, res: Response) => {
    const type = await TagType.findById(req.params.id).lean();
    if (!type) throw new AppError(404, ErrorCodes.TAG_TYPE_NOT_FOUND);

    const tags = await Tag.find({ type: type._id, isApproved: true })
        .sort({ usageCount: -1, name: 1 })
        .lean();

    res.json({ ok: true, type, tags });
});

/* ==================================================================
   TAG TYPE — ادمین فقط (ساخت مستقیم)
   ================================================================== */
export const createTagType = asyncHandler(async (req: any, res: Response) => {
    if (!isAdminUser(req.user)) {
        throw Forbidden(
            ErrorCodes.PROJECT_NOT_OWNED,
            "فقط ادمین یا دولوپر می‌تواند کتگوری بسازد. از مسیر /request استفاده کنید"
        );
    }

    const data = validate(createTagTypeSchema, req.body);
    const slug = data.slug || slugify(data.name);

    const existing = await TagType.findOne({ slug }).lean();
    if (existing) throw Conflict(ErrorCodes.TAG_TYPE_TAKEN);

    const type = await TagType.create({
        ...data,
        slug,
        isSystem: false,
        isApproved: true, // ادمین مستقیم می‌سازه → approved
        createdBy: req.user._id
    });

    res.status(201).json({ ok: true, type });
});

/* ==================================================================
   TAG TYPE — درخواست کاربر عادی (pending)
   ================================================================== */
export const requestTagType = asyncHandler(async (req: any, res: Response) => {
    const data = validate(requestTagTypeSchema, req.body);
    const slug = slugify(data.name);

    const existing = await TagType.findOne({ slug }).lean();
    if (existing) throw Conflict(ErrorCodes.TAG_TYPE_TAKEN);

    // چک: درخواست pending قبلی با همین slug هست؟
    const pendingDup = await TagType.findOne({
        slug,
        isApproved: false,
    }).lean();
    if (pendingDup) {
        throw new AppError(
            400,
            ErrorCodes.VALIDATION_ERROR,
            "درخواست مشابهی قبلاً ثبت شده و در انتظار بررسی است"
        );
    }

    const type = await TagType.create({
        name: data.name,
        slug,
        description: data.description,
        color: data.color || "#6ebbff",
        icon: data.icon,
        order: 100, // انتهای لیست
        isSystem: false,
        isApproved: false,
        allowUserTags: true,
        createdBy: req.user._id
    });

    console.log(
        `📋 [TAG TYPE REQUEST] user=${req.user._id} name="${data.name}" slug="${slug}"`
    );

    res.status(201).json({
        ok: true,
        type,
        message: "درخواست شما ثبت شد و در انتظار تایید ادمین است"
    });
});

/* ==================================================================
   TAG TYPE — آپدیت (ادمین فقط)
   ================================================================== */
export const updateTagType = asyncHandler(async (req: any, res: Response) => {
    if (!isAdminUser(req.user)) {
        throw Forbidden(
            ErrorCodes.PROJECT_NOT_OWNED,
            "فقط ادمین می‌تواند کتگوری ویرایش کند"
        );
    }

    const data = validate(updateTagTypeSchema, req.body);

    const type = await TagType.findById(req.params.id);
    if (!type)
        throw new AppError(404, ErrorCodes.TAG_TYPE_NOT_FOUND);

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
   TAG TYPE — حذف (ادمین فقط)
   ================================================================== */
export const deleteTagType = asyncHandler(async (req: any, res: Response) => {
    if (!isAdminUser(req.user)) {
        throw Forbidden(
            ErrorCodes.PROJECT_NOT_OWNED,
            "فقط ادمین می‌تواند کتگوری حذف کند"
        );
    }

    const type = await TagType.findById(req.params.id);
    if (!type)
        throw new AppError(404, ErrorCodes.TAG_TYPE_NOT_FOUND);

    if (type.isSystem) {
        throw Forbidden(
            ErrorCodes.TAG_TYPE_IS_SYSTEM,
            "کتگوری‌های سیستمی قابل حذف نیستند"
        );
    }

    const tagCount = await Tag.countDocuments({ type: type._id });
    if (tagCount > 0)
        throw Conflict(ErrorCodes.TAG_TYPE_HAS_TAGS);

    await type.deleteOne();
    res.json({ ok: true, message: "کتگوری حذف شد" });
});

/* ==================================================================
   TAG TYPE — تایید (ادمین فقط)
   ================================================================== */
export const approveTagType = asyncHandler(async (req: any, res: Response) => {
    if (!isAdminUser(req.user)) {
        throw Forbidden(ErrorCodes.PROJECT_NOT_OWNED);
    }

    const type = await TagType.findById(req.params.id);
    if (!type)
        throw new AppError(404, ErrorCodes.TAG_TYPE_NOT_FOUND);

    type.isApproved = true;
    await type.save();

    res.json({ ok: true, type });
});

/* ==================================================================
   LIST TAGS — عمومی
   ================================================================== */
export const listTags = asyncHandler(async (req: any, res: Response) => {
    const q = validate(listQuerySchema, req.query);

    const filter: Record<string, unknown> = {};
    if (q.type)
        filter.type = q.type;

    // ✅ mine: فقط تگ‌های خودم
    if (q.mine) {
        if (!req.user) {
            throw new AppError(401, ErrorCodes.UNAUTHENTICATED);
        }

        filter.createdBy = req.user._id;
    }

    if (q.search) {
        filter.$or = [
            { name: { $regex: q.search, $options: "i" } },
            { slug: { $regex: q.search, $options: "i" } }
        ];
    }

    if (q.approved) filter.isApproved = true;

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
            .populate("createdBy", "name username")
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
        isPublic: true,
    });

    res.json({ ok: true, tag, projectCount });
});

/* ==================================================================
   SUGGEST — autocomplete
   ================================================================== */
export const suggestTags = asyncHandler(async (req: Request, res: Response) => {
    const q = validate(suggestTagsSchema, req.query);

    const filter: Record<string, unknown> = { isApproved: true };
    if (q.type)
        filter.type = q.type;

    if (q.q) {
        const safe = q.q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        filter.$or = [
            { name: { $regex: "^" + safe, $options: "i" } },
            { name: { $regex: safe, $options: "i" } },
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
   FIND OR CREATE — قلب picker (type اختیاری → عمومی)
   ================================================================== */
export const findOrCreateTag = asyncHandler(async (req: any, res: Response) => {
    const data = validate(findOrCreateTagSchema, req.body);
    const slug = slugify(data.name);

    /* ---------- resolve type (پیش‌فرض: عمومی) ---------- */
    let typeId: Types.ObjectId;
    let typeColor: string;

    if (data.type) {
        const type = await TagType.findById(data.type);
        if (!type)
            throw new AppError(404, ErrorCodes.TAG_TYPE_NOT_FOUND);

        if (!type.isApproved) {
            throw new AppError(
                400,
                ErrorCodes.TAG_TYPE_NOT_FOUND,
                "این کتگوری تایید نشده"
            );
        }

        typeId = type._id as any;
        typeColor = type.color;
    }

    else {
        const general = await getGeneralType();
        typeId = general._id;
        typeColor = general.color;
    }

    /* ---------- چک وجود تگ ---------- */
    const existing = await Tag.findOne({ slug, type: typeId });
    if (existing) {
        const populated = await existing.populate(
            "type",
            "name slug color icon"
        );

        return res.json({ ok: true, tag: populated, created: false });
    }

    /* ---------- چک allowUserTags ---------- */
    const typeDoc = await TagType.findById(typeId).lean();
    if (typeDoc && !typeDoc.allowUserTags && !isAdminUser(req.user)) {
        throw Forbidden(
            ErrorCodes.TAG_TYPE_IS_SYSTEM,
            `در کتگوری «${typeDoc.name}» فقط ادمین می‌تواند تگ بسازد`
        );
    }

    /* ---------- چک سقف تگ ---------- */
    if (typeDoc?.maxTags != null) {
        const count = await Tag.countDocuments({ type: typeId });
        if (count >= typeDoc.maxTags) {
            throw new AppError(
                400,
                ErrorCodes.MEDIA_LIMIT_REACHED,
                `این کتگوری به حداکثر تعداد تگ (${typeDoc.maxTags}) رسیده است`
            );
        }
    }

    /* ---------- ساخت تگ (همیشه approved — مثل گیت‌هاب) ---------- */
    const tag = await Tag.create({
        name: data.name,
        slug,
        type: typeId,
        color: typeColor,
        isSystem: false,
        isApproved: true,
        createdBy: req.user._id
    });

    const populated = await tag.populate("type", "name slug color icon");

    res.status(201).json({ ok: true, tag: populated, created: true });
});

/* ==================================================================
   CREATE TAG — مستقیم
   ================================================================== */
export const createTag = asyncHandler(async (req: any, res: Response) => {
    const data = validate(createTagSchema, req.body);
    const slug = data.slug || slugify(data.name);

    /* ---------- resolve type ---------- */
    let typeId: Types.ObjectId;
    let typeColor: string;

    if (data.type) {
        const type = await TagType.findById(data.type).lean();
        if (!type)
            throw new AppError(404, ErrorCodes.TAG_TYPE_NOT_FOUND);

        if (!type.isApproved) {
            throw new AppError(400, ErrorCodes.TAG_TYPE_NOT_FOUND, "کتگوری تایید نشده");
        }

        if (!type.allowUserTags && !isAdminUser(req.user)) {
            throw Forbidden(
                ErrorCodes.TAG_TYPE_IS_SYSTEM,
                `در کتگوری «${type.name}» فقط ادمین می‌تواند تگ بسازد`
            );
        }

        typeId = type._id as any;
        typeColor = type.color;
    }

    else {
        const general = await getGeneralType();
        typeId = general._id;
        typeColor = general.color;
    }

    /* ---------- چک تکراری ---------- */
    const dup = await Tag.findOne({ slug, type: typeId }).lean();
    if (dup)
        throw Conflict(ErrorCodes.TAG_TAKEN);

    const tag = await Tag.create({
        name: data.name,
        slug,
        type: typeId,
        color: data.color || typeColor,
        description: data.description,
        isSystem: false,
        isApproved: true, // ← همیشه approved (مثل گیت‌هاب)
        createdBy: req.user._id,
    });

    const populated = await tag.populate("type", "name slug color icon");
    res.status(201).json({ ok: true, tag: populated });
});

/* ==================================================================
   UPDATE TAG — ادمین یا سازنده
   ================================================================== */
export const updateTag = asyncHandler(async (req: any, res: Response) => {
    const tag = req.tag; // از middleware
    const data = validate(updateTagSchema, req.body);

    if (data.name && !data.slug) {
        const newSlug = slugify(data.name);
        if (newSlug !== tag.slug) {
            const dup = await Tag.findOne({
                slug: newSlug,
                type: tag.type,
                _id: { $ne: tag._id }
            }).lean();
            if (dup)
                throw Conflict(ErrorCodes.TAG_TAKEN);

            data.slug = newSlug;
        }
    }

    Object.assign(tag, data);
    await tag.save();

    const populated = await tag.populate("type", "name slug color icon");
    res.json({ ok: true, tag: populated });
});

/* ==================================================================
   DELETE TAG — ادمین یا سازنده
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
   APPROVE TAG — ادمین
   ================================================================== */
export const approveTag = asyncHandler(async (req: any, res: Response) => {
    if (!isAdminUser(req.user))
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
   PENDING — ادمین
   ================================================================== */
export const listPending = asyncHandler(async (req: any, res: Response) => {
    if (!isAdminUser(req.user))
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