import type { Request, Response } from "express";
import { Types } from "mongoose";
import { Review } from "../models/Review";
import { Project } from "../models/Project";
import { AppError, Conflict, Forbidden } from "../utils/AppError";
import { ErrorCodes } from "../utils/errorCodes";
import { asyncHandler } from "../utils/asyncHandler";
import { validate } from "../utils/validate";
import {
    createReviewSchema,
    updateReviewSchema,
    reviewListQuerySchema,
} from "../validators/reviewValidator";
import { recalculateProjectStats } from "../services/ratingService";

/* ==================================================================
   Helper — پیدا کردن پروژه با idOrSlug
   ================================================================== */
async function findProject(idOrSlug: string) {
    const isId = /^[a-f\d]{24}$/i.test(idOrSlug);
    const project = await Project.findOne(isId ? { _id: idOrSlug } : { slug: idOrSlug }).lean();
    if (!project) throw new AppError(404, ErrorCodes.PROJECT_NOT_FOUND);
    return project;
}

/* ==================================================================
   LIST — ریویوهای یک پروژه
   ================================================================== */
export const listReviews = asyncHandler(async (req: any, res: Response) => {
    const { idOrSlug } = req.params;

    const q = validate(reviewListQuerySchema, req.query);
    const project = await findProject(idOrSlug);

    const sortMap: Record<string, Record<string, 1 | -1>> = {
        recent: { createdAt: -1 },
        oldest: { createdAt: 1 },
        highest: { rating: -1, createdAt: -1 },
        lowest: { rating: 1, createdAt: -1 },
        helpful: { helpfulCount: -1, createdAt: -1 },
    };
    const sort = sortMap[q.sort] || sortMap.recent;

    const skip = (q.page - 1) * q.limit;

    const [reviews, total, distribution] = await Promise.all([
        Review.find({ project: project._id })
            .populate("user", "name username avatar")
            .sort(sort)
            .skip(skip)
            .limit(q.limit)
            .lean(),
        Review.countDocuments({ project: project._id }),

        // توزیع امتیازات (برای نمودار 5 ستاره‌ای)
        Review.aggregate([
            { $match: { project: project._id } },
            { $group: { _id: { $floor: "$rating" }, count: { $sum: 1 } } },
        ]),
    ]);

    // پر کردن ستون‌های خالی
    const distMap: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const d of distribution) distMap[d._id] = d.count;

    // آمار کاربر فعلی (اگه لاگینه)
    let myReview = null;
    if (req.user) {
        myReview = await Review.findOne({ project: project._id, user: req.user._id }).lean();
    }

    res.json({
        ok: true,
        reviews,
        myReview,
        distribution: distMap,
        summary: {
            rating: project.rating,
            satisfaction: project.satisfaction,
            reviewCount: project.reviewCount,
        },
        pagination: {
            page: q.page,
            limit: q.limit,
            total,
            pages: Math.ceil(total / q.limit),
        },
    });
});

/* ==================================================================
   GET ONE — ریویو خودم برای این پروژه
   ================================================================== */
export const getMyReview = asyncHandler(async (req: any, res: Response) => {
    const project = await findProject(req.params.idOrSlug);
    const review = await Review.findOne({
        project: project._id,
        user: req.user._id,
    }).lean();

    res.json({ ok: true, review });
});

/* ==================================================================
   CREATE — یک بار برای هر کاربر
   ================================================================== */
export const createReview = asyncHandler(async (req: any, res: Response) => {
    const project = await findProject(req.params.idOrSlug);
    const data = validate(createReviewSchema, req.body);

    // صاحب پروژه نمی‌تونه به خودش امتیاز بده
    if (String(project.owner) === String(req.user._id)) {
        throw Forbidden(ErrorCodes.CANNOT_REVIEW_OWN);
    }

    // چک یکتایی
    const existing = await Review.findOne({
        project: project._id,
        user: req.user._id,
    }).lean();
    if (existing) throw Conflict(ErrorCodes.REVIEW_ALREADY_EXISTS);

    const review = await Review.create({
        project: project._id,
        user: req.user._id,
        rating: data.rating,
        satisfaction: data.satisfaction,
        title: data.title,
        body: data.body,
    });

    await recalculateProjectStats(project._id);

    const populated = await review.populate("user", "name username");
    res.status(201).json({ ok: true, review: populated });
});

/* ==================================================================
   UPDATE — فقط صاحب ریویو
   ================================================================== */
export const updateReview = asyncHandler(async (req: any, res: Response) => {
    const project = await findProject(req.params.idOrSlug);
    const data = validate(updateReviewSchema, req.body);

    const review = await Review.findOne({
        project: project._id,
        user: req.user._id,
    });
    if (!review) throw new AppError(404, ErrorCodes.REVIEW_NOT_FOUND);

    if (data.rating !== undefined) review.rating = data.rating;
    if (data.satisfaction !== undefined) review.satisfaction = data.satisfaction;
    if (data.title !== undefined) review.title = data.title;
    if (data.body !== undefined) review.body = data.body;

    review.isEdited = true;
    review.editedAt = new Date();
    await review.save();

    await recalculateProjectStats(project._id);

    const populated = await review.populate("user", "name username");
    res.json({ ok: true, review: populated });
});

/* ==================================================================
   DELETE
   ================================================================== */
export const deleteReview = asyncHandler(async (req: any, res: Response) => {
    const project = await findProject(req.params.idOrSlug);

    const review = await Review.findOne({
        project: project._id,
        user: req.user._id,
    });
    if (!review) throw new AppError(404, ErrorCodes.REVIEW_NOT_FOUND);

    await review.deleteOne();
    await recalculateProjectStats(project._id);

    res.json({ ok: true, message: "ریویو حذف شد" });
});

/* ==================================================================
   MARK HELPFUL
   ================================================================== */
export const markHelpful = asyncHandler(async (req: any, res: Response) => {
    const review = await Review.findById(req.params.id);
    if (!review) throw new AppError(404, ErrorCodes.REVIEW_NOT_FOUND);

    review.helpfulCount += 1;
    await review.save();

    res.json({ ok: true, helpfulCount: review.helpfulCount });
});

/**
 * Copyright (c) 2026 Sobhan Rasoulzadeh Asl (Sobhan-SRZA / Mr. Sinre)
 *
 * Licensed under the BSD 3-Clause License.
 * See the LICENSE file in the project root for license information.
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */