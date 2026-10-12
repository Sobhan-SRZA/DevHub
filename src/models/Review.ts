import { Schema, model, Model, Types } from "mongoose";

export interface IReview {
    project: Types.ObjectId;
    user: Types.ObjectId;

    rating: number;         // 0..5 (step 0.5 مثلاً)
    satisfaction: number;   // 0..100

    title?: string;         // "خیلی خوب بود"
    body?: string;          // متن نظر

    isEdited: boolean;
    editedAt?: Date | null;

    /* برای آینده: واکنش‌ها به ریویو */
    helpfulCount: number;

    createdAt: Date;
    updatedAt: Date;
}

type ReviewModel = Model<IReview>;

const reviewSchema = new Schema<IReview, ReviewModel>(
    {
        project: {
            type: Schema.Types.ObjectId,
            ref: "Project",
            required: true,
            index: true,
        },
        user: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },

        rating: { type: Number, required: true, min: 0, max: 5 },
        satisfaction: { type: Number, required: true, min: 0, max: 100 },

        title: { type: String, trim: true, maxlength: 100 },
        body: { type: String, trim: true, maxlength: 3000 },

        isEdited: { type: Boolean, default: false },
        editedAt: { type: Date, default: null },

        helpfulCount: { type: Number, default: 0, min: 0 },
    },
    { timestamps: true }
);

/* ---------------- indexes ---------------- */
// هر کاربر فقط یک ریویو برای هر پروژه
reviewSchema.index({ project: 1, user: 1 }, { unique: true });

// برای مرتب‌سازی (helpful first)
reviewSchema.index({ project: 1, helpfulCount: -1, createdAt: -1 });
reviewSchema.index({ project: 1, createdAt: -1 });

export const Review = model<IReview, ReviewModel>("Review", reviewSchema);

/**
 * Copyright (c) 2026 Sobhan Rasoulzadeh Asl (Sobhan-SRZA / Mr. Sinre)
 *
 * Licensed under the BSD 3-Clause License.
 * See the LICENSE file in the project root for license information.
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */