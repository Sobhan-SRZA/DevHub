import {
    createCommentSchema,
    updateCommentSchema,
    commentListQuerySchema
} from "../validators/commentValidator";
import {
    AppError,
    Forbidden
} from "../utils/AppError";
import type { Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { ErrorCodes } from "../utils/errorCodes";
import { validate } from "../utils/validate";
import { Project } from "../models/Project";
import { Comment } from "../models/Comment";

const MAX_DEPTH = 5;

/* ==================================================================
   Helper
   ================================================================== */
async function findProject(idOrSlug: string) {
    const isId = /^[a-f\d]{24}$/i.test(idOrSlug);
    const project = await Project.findOne(isId ? { _id: idOrSlug } : { slug: idOrSlug }).lean();

    if (!project)
        throw new AppError(404, ErrorCodes.PROJECT_NOT_FOUND);

    return project;
}

/* ==================================================================
   LIST — فقط کامنت‌های ریشه با پاسخ‌های تو در تو
   ================================================================== */
export const listComments = asyncHandler(async (req: any, res: Response) => {
    const project = await findProject(req.params.idOrSlug);
    const q = validate(commentListQuerySchema, req.query);

    const sortMap: Record<string, Record<string, 1 | -1>> = {
        recent: { createdAt: -1 },
        oldest: { createdAt: 1 },
        top: { likes: -1, createdAt: -1 }
    };
    const sort = sortMap[q.sort] || sortMap.recent;

    /* ---------- حالت ۱: لیست پاسخ‌های یک کامنت خاص ---------- */
    if (q.parentId) {
        const replies = await Comment.find({
            project: project._id,
            parent: q.parentId,
            isDeleted: false
        })
            .populate("user", "name username avatar")
            .sort({ createdAt: 1 })
            .lean();

        return res.json({ ok: true, comments: replies });
    }

    /* ---------- حالت ۲: لیست کامنت‌های ریشه + پاسخ‌ها (تو در تو) ---------- */
    const skip = (q.page - 1) * q.limit;

    const [roots, total] = await Promise.all([
        Comment.find({
            project: project._id,
            parent: null
        })
            .populate("user", "name username")
            .sort(sort)
            .skip(skip)
            .limit(q.limit)
            .lean(),

        Comment.countDocuments({ project: project._id, parent: null })
    ]);

    // همه‌ی پاسخ‌های این کامنت‌های ریشه رو یک‌جا بگیر (بهینه)
    const rootIds = roots.map((r) => r._id);
    const allReplies = await Comment.find({
        project: project._id,
        parent: { $in: rootIds }
    })
        .populate("user", "name username")
        .sort({ createdAt: 1 })
        .lean();

    // ساختار درختی — گروه‌بندی پاسخ‌ها بر اساس parent
    const replyMap = new Map<string, any[]>();
    for (const r of allReplies) {
        const pid = String(r.parent);
        if (!replyMap.has(pid))
            replyMap.set(pid, []);

        replyMap.get(pid)!.push(r);
    }

    const withReplies = roots.map((root) => ({
        ...root,
        replies: replyMap.get(String(root._id)) || [],
    }));

    res.json({
        ok: true,
        comments: withReplies,
        pagination: {
            page: q.page,
            limit: q.limit,
            total,
            pages: Math.ceil(total / q.limit)
        }
    });
});

/* ==================================================================
   CREATE
   ================================================================== */
export const createComment = asyncHandler(async (req: any, res: Response) => {
    const project = await findProject(req.params.idOrSlug);
    const data = validate(createCommentSchema, req.body);

    let parent: any = null;
    let depth = 0;

    if (data.parent) {
        parent = await Comment.findById(data.parent);
        if (!parent)
            throw new AppError(400, ErrorCodes.COMMENT_PARENT_INVALID);

        // والد باید تو همون پروژه باشه
        if (String(parent.project) !== String(project._id)) {
            throw new AppError(400, ErrorCodes.COMMENT_PARENT_INVALID);
        }

        // والد نباید حذف شده باشه
        if (parent.isDeleted) {
            throw new AppError(400, ErrorCodes.COMMENT_PARENT_INVALID);
        }

        depth = parent.depth + 1;
        if (depth > MAX_DEPTH) {
            throw new AppError(400, ErrorCodes.COMMENT_DEPTH_EXCEEDED);
        }
    }

    const comment = await Comment.create({
        project: project._id,
        user: req.user._id,
        body: data.body,
        parent: parent?._id ?? null,
        depth
    });

    // آپدیت replyCount والد
    if (parent) {
        await Comment.updateOne({ _id: parent._id }, { $inc: { replyCount: 1 } });
    }

    const populated = await comment.populate("user", "name username");
    res.status(201).json({ ok: true, comment: populated });
});

/* ==================================================================
   UPDATE — فقط صاحب کامنت
   ================================================================== */
export const updateComment = asyncHandler(async (req: any, res: Response) => {
    const data = validate(updateCommentSchema, req.body);

    const comment = await Comment.findById(req.params.id);
    if (!comment)
        throw new AppError(404, ErrorCodes.COMMENT_NOT_FOUND);

    if (String(comment.user) !== String(req.user._id)) {
        throw Forbidden(ErrorCodes.COMMENT_NOT_OWNED);
    }

    comment.body = data.body;
    comment.isEdited = true;
    comment.editedAt = new Date();
    await comment.save();

    const populated = await comment.populate("user", "name username");
    res.json({ ok: true, comment: populated });
});

/* ==================================================================
   DELETE — soft delete (child replies باقی می‌مونن)
   ================================================================== */
export const deleteComment = asyncHandler(async (req: any, res: Response) => {
    const comment = await Comment.findById(req.params.id);
    if (!comment)
        throw new AppError(404, ErrorCodes.COMMENT_NOT_FOUND);

    const isOwner = String(comment.user) === String(req.user._id);
    const isProjectOwner = false; // ← می‌تونی چک کنی صاحب پروژه هم بتونه حذف کنه

    if (!isOwner && !isProjectOwner) {
        throw Forbidden(ErrorCodes.COMMENT_NOT_OWNED);
    }

    // soft delete: متن پاک بشه ولی کامنت بمونه تا پاسخ‌هاش گم نشن
    const hasReplies = comment.replyCount > 0;

    if (hasReplies) {
        comment.isDeleted = true;
        comment.deletedAt = new Date();
        comment.body = "[این نظر حذف شده است]";
        await comment.save();
    }

    else {
        // اگه پاسخی نداره، کامل حذف کن
        await comment.deleteOne();
        // کاهش replyCount والد
        if (comment.parent) {
            await Comment.updateOne(
                { _id: comment.parent },
                { $inc: { replyCount: -1 } }
            );
        }
    }

    res.json({ ok: true, message: "نظر حذف شد" });
});

/* ==================================================================
   LIKE / UNLIKE
   ================================================================== */
export const toggleLike = asyncHandler(async (req: any, res: Response) => {
    const comment = await Comment.findById(req.params.id);
    if (!comment) throw new AppError(404, ErrorCodes.COMMENT_NOT_FOUND);

    const userId = req.user._id;
    const alreadyLiked = comment.likes.some((id) => String(id) === String(userId));

    if (alreadyLiked) {
        comment.likes = comment.likes.filter((id) => String(id) !== String(userId));
    } else {
        comment.likes.push(userId);
    }

    await comment.save();

    res.json({
        ok: true,
        liked: !alreadyLiked,
        likesCount: comment.likes.length
    });
});

/**
 * Copyright (c) 2026 Sobhan Rasoulzadeh Asl (Sobhan-SRZA / Mr. Sinre)
 *
 * Licensed under the BSD 3-Clause License.
 * See the LICENSE file in the project root for license information.
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */