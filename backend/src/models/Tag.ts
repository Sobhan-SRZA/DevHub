import {
    Schema,
    model,
    Model,
    Types
} from "mongoose";

export interface ITag {
    name: string;
    slug: string;
    type: Types.ObjectId; // Reference to the tag category.
    color: string;
    description?: string;

    isSystem: boolean; // Indicates whether the tag is system-defined.
    isApproved: boolean;
    createdBy: Types.ObjectId | null; // Null for system-defined tags.

    usageCount: number;
    createdAt: Date;
    updatedAt: Date;
}

type TagModel = Model<ITag>;

const tagSchema = new Schema<ITag, TagModel>(
    {
        name: {
            type: String,
            required: true,
            trim: true,
            maxlength: 40
        },
        slug: {
            type: String,
            required: true,
            lowercase: true,
            trim: true,
            match: /^[a-z0-9-]+$/
        },
        type: {
            type: Schema.Types.ObjectId,
            ref: "TagType",
            required: true,
            index: true
        },
        color: {
            type: String,
            default: "#6ebbff",
            match: /^#[0-9a-fA-F]{6}$/
        },
        description: {
            type: String,
            maxlength: 200
        },

        isSystem: {
            type: Boolean,
            default: false,
            index: true
        },
        isApproved: {
            type: Boolean,
            default: true
        },
        createdBy: {
            type: Schema.Types.ObjectId,
            ref: "User",
            default: null
        },

        usageCount: {
            type: Number,
            default: 0,
            min: 0
        }
    },
    { timestamps: true }
);

/* -------------------- Indexes -------------------- */

// Ensures slug uniqueness within each tag category.
tagSchema.index({ slug: 1, type: 1 }, { unique: true });

tagSchema.index({ type: 1, isApproved: 1, usageCount: -1 });
tagSchema.index({ isApproved: 1, createdAt: -1 });

export const Tag = model<ITag, TagModel>("Tag", tagSchema);

/**
 * Copyright (c) 2026 Sobhan Rasoulzadeh Asl (Sobhan-SRZA / Mr. Sinre)
 *
 * Licensed under the BSD 3-Clause License.
 * See the LICENSE file in the project root for license information.
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */