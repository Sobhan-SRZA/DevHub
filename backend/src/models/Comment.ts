import {
    Schema,
    model,
    Model,
    Types
} from "mongoose";

export interface IComment {
    project: Types.ObjectId;
    user: Types.ObjectId;

    body: string;
    parent: Types.ObjectId | null; // Null indicates a root-level comment.
    depth: number; // 0 = root, 1 = reply, 2 = nested reply, and so on.

    isEdited: boolean;
    editedAt?: Date | null;

    isDeleted: boolean; // Soft deletion preserves the record while clearing its body.
    deletedAt?: Date | null;

    replyCount: number; // Number of direct replies, used by the UI.
    likes: Types.ObjectId[]; // Users who liked the comment.

    createdAt: Date;
    updatedAt: Date;
}

type CommentModel = Model<IComment>;

const commentSchema = new Schema<IComment, CommentModel>(
    {
        project: {
            type: Schema.Types.ObjectId,
            ref: "Project",
            required: true,
            index: true
        },
        user: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true
        },

        body: {
            type: String,
            required: true,
            trim: true,
            maxlength: 2000
        },

        parent: {
            type: Schema.Types.ObjectId,
            ref: "Comment",
            default: null,
            index: true
        },

        depth: {
            type: Number,
            default: 0,
            min: 0,
            max: 5 // Maximum nesting depth: 5 levels.
        },

        isEdited: {
            type: Boolean,
            default: false
        },
        editedAt: {
            type: Date,
            default: null
        },

        isDeleted: {
            type: Boolean,
            default: false,
            index: true
        },
        deletedAt: {
            type: Date,
            default: null
        },

        replyCount: {
            type: Number,
            default: 0,
            min: 0
        },

        likes: {
            type: [{ type: Schema.Types.ObjectId, ref: "User" }],
            default: []
        }
    },
    { timestamps: true }
);

/* -------------------- Indexes -------------------- */

commentSchema.index({ project: 1, parent: 1, createdAt: -1 });
commentSchema.index({ project: 1, createdAt: -1 });

export const Comment = model<IComment, CommentModel>(
    "Comment",
    commentSchema
);

/**
 * Copyright (c) 2026 Sobhan Rasoulzadeh Asl (Sobhan-SRZA / Mr. Sinre)
 *
 * Licensed under the BSD 3-Clause License.
 * See the LICENSE file in the project root for license information.
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */