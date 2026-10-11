import {
    Schema,
    model,
    Model,
    Types
} from "mongoose";

export interface ITag {
    name: string;                    // "React", "Node.js", "SEO"
    slug: string;                    // "react", "nodejs", "seo"
    type: Types.ObjectId;            // ref → TagType
    color?: string;
    description?: string;
    createdBy?: Types.ObjectId | null;
    usageCount: number;              // تعداد پروژه‌هایی که از این تگ استفاده می‌کنن
    createdAt: Date;
    updatedAt: Date;
}

type TagModel = Model<ITag>;

const tagSchema = new Schema<ITag, TagModel>(
    {
        name: { type: String, required: true, trim: true, maxlength: 40 },
        slug: {
            type: String,
            required: true,
            lowercase: true,
            trim: true,
            match: /^[a-z0-9-]+$/,
        },
        type: {
            type: Schema.Types.ObjectId,
            ref: "TagType",
            required: true,
            index: true,
        },
        color: { type: String, default: "#6ebbff", match: /^#[0-9a-fA-F]{6}$/ },
        description: { type: String, maxlength: 200 },
        createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
        usageCount: { type: Number, default: 0, min: 0 },
    },
    { timestamps: true }
);

// هر تگ داخل هر نوع باید یکتا باشه
tagSchema.index({ slug: 1, type: 1 }, { unique: true });
// برای فیلتر سریع
tagSchema.index({ type: 1, usageCount: -1 });

export const Tag = model<ITag, TagModel>("Tag", tagSchema);

/**
 * Copyright (c) 2026 Sobhan Rasoulzadeh Asl (Sobhan-SRZA / Mr. Sinre)
 *
 * Licensed under the BSD 3-Clause License.
 * See the LICENSE file in the project root for license information.
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */