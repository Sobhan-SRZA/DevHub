
import type { Response } from "express";

import {
    createCommentSchema,
    updateCommentSchema,
    commentListQuerySchema
} from "../validators/commentValidator";

import { AppError, Forbidden } from "../utils/AppError";
import { asyncHandler } from "../utils/asyncHandler";
import { ErrorCodes } from "../utils/errorCodes";
import { validate } from "../utils/validate";
import { Project } from "../models/Project";
import { Comment } from "../models/Comment";

/* ========================================================================== */
/* Constants                                                                  */
/* ========================================================================== */

/**
 * Maximum permitted nesting depth for comment replies.
 */
const MAX_DEPTH = 5;

/* ========================================================================== */
/* Helpers                                                                    */
/* ========================================================================== */

/**
 * Retrieves a project by its MongoDB ObjectId or slug.
 *
 * @param idOrSlug - Project identifier or URL-friendly slug.
 * @returns The matching project document.
 * @throws AppError if the project does not exist.
 */
async function findProject(idOrSlug: string) {
    const isObjectId = /^[a-f\d]{24}$/i.test(idOrSlug);

    const project = await Project.findOne(
        isObjectId
            ? { _id: idOrSlug }
            : { slug: idOrSlug }
    ).lean();

    if (!project) {
        throw new AppError(404, ErrorCodes.PROJECT_NOT_FOUND);
    }

    return project;
}

/* ========================================================================== */
/* Comments — List                                                            */
/* ========================================================================== */

/**
 * Retrieves project comments with optional pagination, sorting, and filtering
 * by parent comment.
 *
 * When no parent ID is provided, the endpoint returns paginated root comments
 * with their direct replies. When a parent ID is provided, it returns that
 * comment's direct replies.
 *
 * @route GET /projects/:idOrSlug/comments
 * @access Public
 */
export const listComments = asyncHandler(
    async (req: any, res: Response) => {
        const project = await findProject(req.params.idOrSlug);
        const query = validate(commentListQuerySchema, req.query);

        const sortMap: Record<
            string,
            Record<string, 1 | -1>
        > = {
            recent: { createdAt: -1 },
            oldest: { createdAt: 1 },
            top: { likes: -1, createdAt: -1 }
        };

        const sort = sortMap[query.sort] || sortMap.recent;

        // Return direct replies when a parent comment is specified.
        if (query.parentId) {
            const replies = await Comment.find({
                project: project._id,
                parent: query.parentId,
                isDeleted: false
            })
                .populate("user", "name username avatar")
                .sort({ createdAt: 1 })
                .lean();

            return res.json({
                ok: true,
                comments: replies
            });
        }

        // Retrieve a paginated list of root-level comments.
        const skip = (query.page - 1) * query.limit;

        const [roots, total] = await Promise.all([
            Comment.find({
                project: project._id,
                parent: null
            })
                .populate("user", "name username avatar")
                .sort(sort)
                .skip(skip)
                .limit(query.limit)
                .lean(),

            Comment.countDocuments({
                project: project._id,
                parent: null
            })
        ]);

        // Fetch all direct replies for the current page in a single query.
        const rootIds = roots.map((root) => root._id);

        const allReplies = await Comment.find({
            project: project._id,
            parent: { $in: rootIds }
        })
            .populate("user", "name username avatar")
            .sort({ createdAt: 1 })
            .lean();

        // Group replies by their parent comment ID.
        const replyMap = new Map<string, any[]>();

        for (const reply of allReplies) {
            const parentId = String(reply.parent);

            if (!replyMap.has(parentId)) {
                replyMap.set(parentId, []);
            }

            replyMap.get(parentId)!.push(reply);
        }

        // Attach direct replies to their corresponding root comments.
        const commentsWithReplies = roots.map((root) => ({
            ...root,
            replies: replyMap.get(String(root._id)) || []
        }));

        res.json({
            ok: true,
            comments: commentsWithReplies,
            pagination: {
                page: query.page,
                limit: query.limit,
                total,
                pages: Math.ceil(total / query.limit)
            }
        });
    }
);

/* ========================================================================== */
/* Comments — Create                                                          */
/* ========================================================================== */

/**
 * Creates a comment or reply for a project.
 *
 * Replies must belong to the same project as their parent comment.
 * Deleted parent comments cannot receive new replies, and the configured
 * maximum nesting depth is enforced.
 *
 * @route POST /projects/:idOrSlug/comments
 * @access Authenticated
 */
export const createComment = asyncHandler(
    async (req: any, res: Response) => {
        const project = await findProject(req.params.idOrSlug);
        const data = validate(createCommentSchema, req.body);

        let parent: any = null;
        let depth = 0;

        if (data.parent) {
            parent = await Comment.findById(data.parent);

            if (!parent) {
                throw new AppError(
                    400,
                    ErrorCodes.COMMENT_PARENT_INVALID
                );
            }

            // Ensure the parent comment belongs to the same project.
            if (String(parent.project) !== String(project._id)) {
                throw new AppError(
                    400,
                    ErrorCodes.COMMENT_PARENT_INVALID
                );
            }

            // Prevent replies to deleted comments.
            if (parent.isDeleted) {
                throw new AppError(
                    400,
                    ErrorCodes.COMMENT_PARENT_INVALID
                );
            }

            depth = parent.depth + 1;

            if (depth > MAX_DEPTH) {
                throw new AppError(
                    400,
                    ErrorCodes.COMMENT_DEPTH_EXCEEDED
                );
            }
        }

        const comment = await Comment.create({
            project: project._id,
            user: req.user._id,
            body: data.body,
            parent: parent?._id ?? null,
            depth
        });

        // Update the parent's direct reply count.
        if (parent) {
            await Comment.updateOne(
                { _id: parent._id },
                { $inc: { replyCount: 1 } }
            );
        }

        const populatedComment = await comment.populate(
            "user",
            "name username"
        );

        res.status(201).json({
            ok: true,
            comment: populatedComment
        });
    }
);

/* ========================================================================== */
/* Comments — Update                                                          */
/* ========================================================================== */

/**
 * Updates the content of an existing comment.
 *
 * Only the original author can edit the comment.
 *
 * @route PATCH /comments/:id
 * @access Authenticated
 */
export const updateComment = asyncHandler(
    async (req: any, res: Response) => {
        const data = validate(updateCommentSchema, req.body);

        const comment = await Comment.findById(req.params.id);

        if (!comment) {
            throw new AppError(
                404,
                ErrorCodes.COMMENT_NOT_FOUND
            );
        }

        // Restrict comment editing to its original author.
        if (String(comment.user) !== String(req.user._id)) {
            throw Forbidden(ErrorCodes.COMMENT_NOT_OWNED);
        }

        comment.body = data.body;
        comment.isEdited = true;
        comment.editedAt = new Date();

        await comment.save();

        const populatedComment = await comment.populate(
            "user",
            "name username"
        );

        res.json({
            ok: true,
            comment: populatedComment
        });
    }
);

/* ========================================================================== */
/* Comments — Delete                                                          */
/* ========================================================================== */

/**
 * Deletes a comment while preserving its reply hierarchy when necessary.
 *
 * Comments with replies are soft-deleted to prevent their descendants
 * from becoming disconnected. Comments without replies are permanently
 * deleted, and their parent's reply count is decremented when applicable.
 *
 * @route DELETE /comments/:id
 * @access Authenticated
 */
export const deleteComment = asyncHandler(
    async (req: any, res: Response) => {
        const comment = await Comment.findById(req.params.id);

        if (!comment) {
            throw new AppError(
                404,
                ErrorCodes.COMMENT_NOT_FOUND
            );
        }

        const isOwner =
            String(comment.user) === String(req.user._id);

        // Project ownership is not currently included in the authorization
        // check. Only the comment author is permitted to delete the comment.
        const isProjectOwner = false;

        if (!isOwner && !isProjectOwner) {
            throw Forbidden(ErrorCodes.COMMENT_NOT_OWNED);
        }

        const hasReplies = comment.replyCount > 0;

        if (hasReplies) {
            // Preserve the comment document to maintain its reply hierarchy.
            comment.isDeleted = true;
            comment.deletedAt = new Date();
            comment.body = "[This comment has been deleted]";

            await comment.save();
        } else {
            // Permanently remove comments that have no replies.
            const parentId = comment.parent;

            await comment.deleteOne();

            // Keep the parent's direct reply count consistent.
            if (parentId) {
                await Comment.updateOne(
                    { _id: parentId },
                    { $inc: { replyCount: -1 } }
                );
            }
        }

        res.json({
            ok: true,
            message: "The comment has been deleted successfully."
        });
    }
);

/* ========================================================================== */
/* Comments — Toggle Like                                                     */
/* ========================================================================== */

/**
 * Toggles the authenticated user's like on a comment.
 *
 * If the user has already liked the comment, the existing like is removed.
 * Otherwise, a new like is added.
 *
 * @route POST /comments/:id/like
 * @access Authenticated
 */
export const toggleLike = asyncHandler(
    async (req: any, res: Response) => {
        const comment = await Comment.findById(req.params.id);

        if (!comment) {
            throw new AppError(
                404,
                ErrorCodes.COMMENT_NOT_FOUND
            );
        }

        const userId = req.user._id;

        const alreadyLiked = comment.likes.some(
            (id) => String(id) === String(userId)
        );

        if (alreadyLiked) {
            comment.likes = comment.likes.filter(
                (id) => String(id) !== String(userId)
            );
        } else {
            comment.likes.push(userId);
        }

        await comment.save();

        res.json({
            ok: true,
            liked: !alreadyLiked,
            likesCount: comment.likes.length
        });
    }
);

/**
 * Copyright (c) 2026 Sobhan Rasoulzadeh Asl (Sobhan-SRZA / Mr. Sinre)
 *
 * Licensed under the BSD 3-Clause License.
 * See the LICENSE file in the project root for license information.
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */