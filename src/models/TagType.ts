import {
    Schema,
    model,
    Model,
    Types
} from "mongoose";

export interface ITagType {
    name: string;          // مثلاً "سئو", "زبان برنامه‌نویسی"
    slug: string;          // "seo", "programming-language"
    description?: string;
    color?: string;        // hex for UI
    icon?: string;         // emoji or icon name
    isSystem: boolean;     // تگ‌های سیستمی (کسی نمی‌تونه حذف کنه)
    order: number;         // برای مرتب‌سازی در UI
    createdBy?: Types.ObjectId | null;   // admin
    createdAt: Date;
    updatedAt: Date;
}

type TagTypeModel = Model<ITagType>;

const tagTypeSchema = new Schema<ITagType, TagTypeModel>(
    {
        name: { type: String, required: true, trim: true, maxlength: 50 },
        slug: {
            type: String,
            required: true,
            unique: true,
            index: true,
            lowercase: true,
            trim: true,
            match: /^[a-z0-9-]+$/
        },
        description: { type: String, maxlength: 300 },
        color: { type: String, default: "#6ebbff", match: /^#[0-9a-fA-F]{6}$/ },
        icon: { type: String, maxlength: 8 },
        isSystem: { type: Boolean, default: false },
        order: { type: Number, default: 0, index: true },
        createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null }
    },
    { timestamps: true }
);

export const TagType = model<ITagType, TagTypeModel>("TagType", tagTypeSchema);

/**
 * Copyright (c) 2026 Sobhan Rasoulzadeh Asl (Sobhan-SRZA / Mr. Sinre)
 *
 * Licensed under the BSD 3-Clause License.
 * See the LICENSE file in the project root for license information.
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */