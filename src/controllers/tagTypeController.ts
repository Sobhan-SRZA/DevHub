import {
    AppError,
    Conflict,
    Forbidden,
    NotFound
} from "../utils/AppError";
import {
    createTagTypeSchema,
    updateTagTypeSchema
} from "../validators/tagValidator";
import type {
    Request,
    Response
} from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { ErrorCodes } from "../utils/errorCodes";
import { validate } from "../utils/validate";
import { TagType } from "../models/TagType";
import { Tag } from "../models/Tag";

/* ==================================================================
   LIST — عمومی
   ================================================================== */
export const listTagTypes = asyncHandler(async (_req: Request, res: Response) => {
    const types = await TagType.find().sort({ order: 1, name: 1 }).lean();

    // تعداد تگ‌های هر نوع
    const counts = await Tag.aggregate([
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
   GET ONE
   ================================================================== */
export const getTagType = asyncHandler(async (req: Request, res: Response) => {
    const type = await TagType.findById(req.params.id).lean();
    if (!type)
        throw new AppError(404, ErrorCodes.TAG_TYPE_NOT_FOUND);

    res.json({ ok: true, type });
});

/* ==================================================================
   CREATE — admin/system only (اینجا فرض می‌کنیم middleware چک کرده)
   ================================================================== */
export const createTagType = asyncHandler(async (req: any, res: Response) => {
    const data = validate(createTagTypeSchema, req.body);

    const existing = await TagType.findOne({ slug: data.slug }).lean();
    if (existing)
        throw Conflict(ErrorCodes.TAG_TYPE_TAKEN);

    const type = await TagType.create({
        ...data,
        createdBy: req.user?._id ?? null,
    });

    res.status(201).json({ ok: true, type });
});

/* ==================================================================
   UPDATE
   ================================================================== */
export const updateTagType = asyncHandler(async (req: any, res: Response) => {
    const data = validate(updateTagTypeSchema, req.body);

    const type = await TagType.findById(req.params.id);
    if (!type)
        throw new AppError(404, ErrorCodes.TAG_TYPE_NOT_FOUND);

    if (type.isSystem && req.user?.role !== "admin") {
        throw Forbidden(ErrorCodes.TAG_TYPE_IS_SYSTEM);
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
   DELETE
   ================================================================== */
export const deleteTagType = asyncHandler(async (req: any, res: Response) => {
    const type = await TagType.findById(req.params.id);
    if (!type) throw new AppError(404, ErrorCodes.TAG_TYPE_NOT_FOUND);

    if (type.isSystem && req.user?.role !== "admin") {
        throw Forbidden(ErrorCodes.TAG_TYPE_IS_SYSTEM);
    }

    const tagCount = await Tag.countDocuments({ type: type._id });
    if (tagCount > 0) {
        throw Conflict(ErrorCodes.TAG_TYPE_HAS_TAGS);
    }

    await type.deleteOne();
    res.json({ ok: true, message: "نوع تگ حذف شد" });
});

/**
 * Copyright (c) 2026 Sobhan Rasoulzadeh Asl (Sobhan-SRZA / Mr. Sinre)
 *
 * Licensed under the BSD 3-Clause License.
 * See the LICENSE file in the project root for license information.
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */