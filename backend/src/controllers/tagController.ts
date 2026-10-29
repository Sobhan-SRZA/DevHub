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
   Helper utilities
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
 * Retrieves the default "General" tag type, creating it if necessary.
 */
async function getGeneralType(): Promise<{ _id: Types.ObjectId; color: string }> {
    let general = await TagType.findOne({ slug: GENERAL_SLUG }).lean();

    if (!general) {
        const created = await TagType.create({
            name: "General",
            slug: GENERAL_SLUG,
            description: "The default category for tags without a specific category.",
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

    // Restore the required system and approval flags if they have been modified.
    if (!general.isApproved || !general.isSystem) {
        await TagType.updateOne(
            { _id: general._id },
            { $set: { isApproved: true, isSystem: true } }
        );
    }

    return {
        _id: general._id as any,
        color: general.color || "#94a3b8"
    };
}

/* ==================================================================
   TAG TYPES — List all available tag types
   ================================================================== */
export const listTagTypes = asyncHandler(async (req: any, res: Response) => {
    const isAdmin = isAdminUser(req.user);
    const includeUnapproved = req.query.all === "true" && isAdmin;

    const filter: Record<string, unknown> = {};

    if (!includeUnapproved) {
        filter.isApproved = true;
    }

    const types = await TagType.find(filter)
        .sort({ order: 1, name: 1 })
        .lean();

    const counts = await Tag.aggregate([
        { $match: { isApproved: true } },
        { $group: { _id: "$type", count: { $sum: 1 } } }
    ]);

    const countMap = new Map(
        counts.map((entry) => [String(entry._id), entry.count])
    );

    res.json({
        ok: true,
        types: types.map((type) => ({
            ...type,
            tagCount: countMap.get(String(type._id)) || 0
        }))
    });
});

/* ==================================================================
   GET TAG TYPE — Retrieve a tag type and its approved tags
   ================================================================== */
export const getTagType = asyncHandler(async (req: Request, res: Response) => {
    const type = await TagType.findById(req.params.id).lean();

    if (!type) {
        throw new AppError(404, ErrorCodes.TAG_TYPE_NOT_FOUND);
    }

    const tags = await Tag.find({
        type: type._id,
        isApproved: true
    })
        .sort({ usageCount: -1, name: 1 })
        .lean();

    res.json({ ok: true, type, tags });
});

/* ==================================================================
   CREATE TAG TYPE — Admin and developer access only
   ================================================================== */
export const createTagType = asyncHandler(async (req: any, res: Response) => {
    if (!isAdminUser(req.user)) {
        throw Forbidden(
            ErrorCodes.PROJECT_NOT_OWNED,
            "Only administrators and developers can create tag types directly. Use the /request endpoint instead."
        );
    }

    const data = validate(createTagTypeSchema, req.body);
    const slug = data.slug || slugify(data.name);

    const existing = await TagType.findOne({ slug }).lean();

    if (existing) {
        throw Conflict(ErrorCodes.TAG_TYPE_TAKEN);
    }

    const type = await TagType.create({
        ...data,
        slug,
        isSystem: false,
        isApproved: true,
        createdBy: req.user._id
    });

    res.status(201).json({ ok: true, type });
});

/* ==================================================================
   REQUEST TAG TYPE — Submit a tag type for administrative approval
   ================================================================== */
export const requestTagType = asyncHandler(async (req: any, res: Response) => {
    const data = validate(requestTagTypeSchema, req.body);
    const slug = slugify(data.name);

    const existing = await TagType.findOne({ slug }).lean();

    if (existing) {
        throw Conflict(ErrorCodes.TAG_TYPE_TAKEN);
    }

    // Prevent duplicate requests for tag types awaiting approval.
    const pendingDuplicate = await TagType.findOne({
        slug,
        isApproved: false
    }).lean();

    if (pendingDuplicate) {
        throw new AppError(
            400,
            ErrorCodes.VALIDATION_ERROR,
            "A similar request has already been submitted and is awaiting review."
        );
    }

    const type = await TagType.create({
        name: data.name,
        slug,
        description: data.description,
        color: data.color || "#6ebbff",
        icon: data.icon,
        order: 100,
        isSystem: false,
        isApproved: false,
        allowUserTags: true,
        createdBy: req.user._id
    });

    console.log(
        `[TAG TYPE REQUEST] user=${req.user._id} name="${data.name}" slug="${slug}"`
    );

    res.status(201).json({
        ok: true,
        type,
        message: "Your request has been submitted and is awaiting administrative approval."
    });
});

/* ==================================================================
   UPDATE TAG TYPE — Admin and developer access only
   ================================================================== */
export const updateTagType = asyncHandler(async (req: any, res: Response) => {
    if (!isAdminUser(req.user)) {
        throw Forbidden(
            ErrorCodes.PROJECT_NOT_OWNED,
            "Only administrators and developers can update tag types."
        );
    }

    const data = validate(updateTagTypeSchema, req.body);

    const type = await TagType.findById(req.params.id);

    if (!type) {
        throw new AppError(404, ErrorCodes.TAG_TYPE_NOT_FOUND);
    }

    if (data.slug && data.slug !== type.slug) {
        const duplicate = await TagType.findOne({ slug: data.slug }).lean();

        if (duplicate) {
            throw Conflict(ErrorCodes.TAG_TYPE_TAKEN);
        }
    }

    Object.assign(type, data);
    await type.save();

    res.json({ ok: true, type });
});

/* ==================================================================
   DELETE TAG TYPE — Admin and developer access only
   ================================================================== */
export const deleteTagType = asyncHandler(async (req: any, res: Response) => {
    if (!isAdminUser(req.user)) {
        throw Forbidden(
            ErrorCodes.PROJECT_NOT_OWNED,
            "Only administrators and developers can delete tag types."
        );
    }

    const type = await TagType.findById(req.params.id);

    if (!type) {
        throw new AppError(404, ErrorCodes.TAG_TYPE_NOT_FOUND);
    }

    if (type.isSystem) {
        throw Forbidden(
            ErrorCodes.TAG_TYPE_IS_SYSTEM,
            "System-defined tag types cannot be deleted."
        );
    }

    const tagCount = await Tag.countDocuments({ type: type._id });

    if (tagCount > 0) {
        throw Conflict(ErrorCodes.TAG_TYPE_HAS_TAGS);
    }

    await type.deleteOne();

    res.json({
        ok: true,
        message: "Tag type deleted successfully."
    });
});

/* ==================================================================
   APPROVE TAG TYPE — Admin and developer access only
   ================================================================== */
export const approveTagType = asyncHandler(async (req: any, res: Response) => {
    if (!isAdminUser(req.user)) {
        throw Forbidden(ErrorCodes.PROJECT_NOT_OWNED);
    }

    const type = await TagType.findById(req.params.id);

    if (!type) {
        throw new AppError(404, ErrorCodes.TAG_TYPE_NOT_FOUND);
    }

    type.isApproved = true;
    await type.save();

    res.json({ ok: true, type });
});

/* ==================================================================
   LIST TAGS — Retrieve tags with filtering and pagination
   ================================================================== */
export const listTags = asyncHandler(async (req: any, res: Response) => {
    const query = validate(listQuerySchema, req.query);

    const filter: Record<string, unknown> = {};

    if (query.type) {
        filter.type = query.type;
    }

    // Return only tags created by the authenticated user when requested.
    if (query.mine) {
        if (!req.user) {
            throw new AppError(401, ErrorCodes.UNAUTHENTICATED);
        }

        filter.createdBy = req.user._id;
    }

    if (query.search) {
        filter.$or = [
            { name: { $regex: query.search, $options: "i" } },
            { slug: { $regex: query.search, $options: "i" } }
        ];
    }

    if (query.approved) {
        filter.isApproved = true;
    }

    const sortMap: Record<string, Record<string, 1 | -1>> = {
        name: { name: 1 },
        usage: { usageCount: -1, name: 1 },
        recent: { createdAt: -1 }
    };

    const sort = sortMap[query.sort] || sortMap.usage;
    const skip = (query.page - 1) * query.limit;

    const [tags, total] = await Promise.all([
        Tag.find(filter)
            .populate("type", "name slug color icon")
            .populate("createdBy", "name username")
            .sort(sort)
            .skip(skip)
            .limit(query.limit)
            .lean(),

        Tag.countDocuments(filter)
    ]);

    res.json({
        ok: true,
        tags,
        pagination: {
            page: query.page,
            limit: query.limit,
            total,
            pages: Math.ceil(total / query.limit)
        }
    });
});

/* ==================================================================
   GET TAG — Retrieve a tag and its associated public projects
   ================================================================== */
export const getTag = asyncHandler(async (req: Request, res: Response) => {
    const tag = await Tag.findById(req.params.id)
        .populate("type", "name slug color icon")
        .lean();

    if (!tag) {
        throw new AppError(404, ErrorCodes.TAG_NOT_FOUND);
    }

    const projectCount = await Project.countDocuments({
        tags: tag._id,
        status: "published",
        isPublic: true
    });

    res.json({ ok: true, tag, projectCount });
});

/* ==================================================================
   SUGGEST TAGS — Provide autocomplete suggestions
   ================================================================== */
export const suggestTags = asyncHandler(async (req: Request, res: Response) => {
    const query = validate(suggestTagsSchema, req.query);

    const filter: Record<string, unknown> = { isApproved: true };

    if (query.type) {
        filter.type = query.type;
    }

    if (query.q) {
        const safeQuery = query.q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

        filter.$or = [
            { name: { $regex: "^" + safeQuery, $options: "i" } },
            { name: { $regex: safeQuery, $options: "i" } }
        ];
    }

    const tags = await Tag.find(filter)
        .populate("type", "name slug color icon")
        .sort({ usageCount: -1, name: 1 })
        .limit(query.limit)
        .lean();

    res.json({ ok: true, tags });
});

/* ==================================================================
   FIND OR CREATE TAG — Resolve the tag type and create tags as needed
   ================================================================== */
export const findOrCreateTag = asyncHandler(async (req: any, res: Response) => {
    const data = validate(findOrCreateTagSchema, req.body);
    const slug = slugify(data.name);

    /* ---------- Resolve the tag type; default to General ---------- */
    let typeId: Types.ObjectId;
    let typeColor: string;

    if (data.type) {
        const type = await TagType.findById(data.type);

        if (!type) {
            throw new AppError(404, ErrorCodes.TAG_TYPE_NOT_FOUND);
        }

        if (!type.isApproved) {
            throw new AppError(
                400,
                ErrorCodes.TAG_TYPE_NOT_FOUND,
                "This tag type has not been approved."
            );
        }

        typeId = type._id as any;
        typeColor = type.color;
    } else {
        const general = await getGeneralType();

        typeId = general._id;
        typeColor = general.color;
    }

    /* ---------- Return an existing tag when available ---------- */
    const existing = await Tag.findOne({ slug, type: typeId });

    if (existing) {
        const populated = await existing.populate(
            "type",
            "name slug color icon"
        );

        return res.json({ ok: true, tag: populated, created: false });
    }

    /* ---------- Enforce tag creation permissions ---------- */
    const typeDoc = await TagType.findById(typeId).lean();

    if (typeDoc && !typeDoc.allowUserTags && !isAdminUser(req.user)) {
        throw Forbidden(
            ErrorCodes.TAG_TYPE_IS_SYSTEM,
            `Only administrators can create tags in the "${typeDoc.name}" category.`
        );
    }

    /* ---------- Enforce the maximum number of tags per type ---------- */
    if (typeDoc?.maxTags != null) {
        const count = await Tag.countDocuments({ type: typeId });

        if (count >= typeDoc.maxTags) {
            throw new AppError(
                400,
                ErrorCodes.MEDIA_LIMIT_REACHED,
                `The "${typeDoc.name}" category has reached its maximum limit of ${typeDoc.maxTags} tags.`
            );
        }
    }

    /* ---------- Create an approved tag, following GitHub's approach ---------- */
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
   CREATE TAG — Create a tag directly
   ================================================================== */
export const createTag = asyncHandler(async (req: any, res: Response) => {
    const data = validate(createTagSchema, req.body);
    const slug = data.slug || slugify(data.name);

    /* ---------- Resolve the tag type ---------- */
    let typeId: Types.ObjectId;
    let typeColor: string;

    if (data.type) {
        const type = await TagType.findById(data.type).lean();

        if (!type) {
            throw new AppError(404, ErrorCodes.TAG_TYPE_NOT_FOUND);
        }

        if (!type.isApproved) {
            throw new AppError(
                400,
                ErrorCodes.TAG_TYPE_NOT_FOUND,
                "This tag type has not been approved."
            );
        }

        if (!type.allowUserTags && !isAdminUser(req.user)) {
            throw Forbidden(
                ErrorCodes.TAG_TYPE_IS_SYSTEM,
                `Only administrators can create tags in the "${type.name}" category.`
            );
        }

        typeId = type._id as any;
        typeColor = type.color;
    } else {
        const general = await getGeneralType();

        typeId = general._id;
        typeColor = general.color;
    }

    /* ---------- Prevent duplicate tags within the same type ---------- */
    const duplicate = await Tag.findOne({ slug, type: typeId }).lean();

    if (duplicate) {
        throw Conflict(ErrorCodes.TAG_TAKEN);
    }

    const tag = await Tag.create({
        name: data.name,
        slug,
        type: typeId,
        color: data.color || typeColor,
        description: data.description,
        isSystem: false,
        isApproved: true,
        createdBy: req.user._id
    });

    const populated = await tag.populate("type", "name slug color icon");

    res.status(201).json({ ok: true, tag: populated });
});

/* ==================================================================
   UPDATE TAG — Allow administrators or tag creators to update a tag
   ================================================================== */
export const updateTag = asyncHandler(async (req: any, res: Response) => {
    const tag = req.tag; // Attached by the authorization middleware.
    const data = validate(updateTagSchema, req.body);

    if (data.name && !data.slug) {
        const newSlug = slugify(data.name);

        if (newSlug !== tag.slug) {
            const duplicate = await Tag.findOne({
                slug: newSlug,
                type: tag.type,
                _id: { $ne: tag._id }
            }).lean();

            if (duplicate) {
                throw Conflict(ErrorCodes.TAG_TAKEN);
            }

            data.slug = newSlug;
        }
    }

    Object.assign(tag, data);
    await tag.save();

    const populated = await tag.populate("type", "name slug color icon");

    res.json({ ok: true, tag: populated });
});

/* ==================================================================
   DELETE TAG — Allow administrators or tag creators to delete a tag
   ================================================================== */
export const deleteTag = asyncHandler(async (req: any, res: Response) => {
    const tag = req.tag;

    const inUse = await Project.countDocuments({ tags: tag._id });

    if (inUse > 0) {
        throw Conflict(ErrorCodes.TAG_IN_USE);
    }

    await tag.deleteOne();

    res.json({
        ok: true,
        message: "Tag deleted successfully."
    });
});

/* ==================================================================
   APPROVE TAG — Approve a tag
   ================================================================== */
export const approveTag = asyncHandler(async (req: any, res: Response) => {
    if (!isAdminUser(req.user)) {
        throw Forbidden(ErrorCodes.PROJECT_NOT_OWNED);
    }

    const tag = await Tag.findById(req.params.id);

    if (!tag) {
        throw new AppError(404, ErrorCodes.TAG_NOT_FOUND);
    }

    tag.isApproved = true;
    await tag.save();

    const populated = await tag.populate("type", "name slug color icon");

    res.json({ ok: true, tag: populated });
});

/* ==================================================================
   LIST PENDING ITEMS — Retrieve pending tags and tag types for review
   ================================================================== */
export const listPending = asyncHandler(async (req: any, res: Response) => {
    if (!isAdminUser(req.user)) {
        throw Forbidden(ErrorCodes.PROJECT_NOT_OWNED);
    }

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
 * See the LICENSE file in the project root for licensing details.
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */