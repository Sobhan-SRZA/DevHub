import {
    createReviewSchema,
    updateReviewSchema,
    reviewListQuerySchema
} from "../validators/reviewValidator";
import {
    AppError,
    Conflict,
    Forbidden
} from "../utils/AppError";
import { recalculateProjectStats } from "../services/ratingService";
import type { Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { ErrorCodes } from "../utils/errorCodes";
import { validate } from "../utils/validate";
import { Project } from "../models/Project";
import { Review } from "../models/Review";

/* ==================================================================
   Helper — Find a project by its ID or slug
   ================================================================== */
async function findProject(idOrSlug: string) {
    const isId = /^[a-f\d]{24}$/i.test(idOrSlug);

    const project = await Project.findOne(
        isId ? { _id: idOrSlug } : { slug: idOrSlug }
    ).lean();

    if (!project) {
        throw new AppError(404, ErrorCodes.PROJECT_NOT_FOUND);
    }

    return project;
}

/* ==================================================================
   LIST — Retrieve paginated reviews for a project
   ================================================================== */
export const listReviews = asyncHandler(async (req: any, res: Response) => {
    const { idOrSlug } = req.params;

    const query = validate(reviewListQuerySchema, req.query);
    const project = await findProject(idOrSlug);

    const sortMap: Record<string, Record<string, 1 | -1>> = {
        recent: { createdAt: -1 },
        oldest: { createdAt: 1 },
        highest: { rating: -1, createdAt: -1 },
        lowest: { rating: 1, createdAt: -1 },
        helpful: { helpfulCount: -1, createdAt: -1 }
    };

    const sort = sortMap[query.sort] || sortMap.recent;
    const skip = (query.page - 1) * query.limit;

    const [reviews, total, distribution] = await Promise.all([
        Review.find({ project: project._id })
            .populate("user", "name username avatar")
            .sort(sort)
            .skip(skip)
            .limit(query.limit)
            .lean(),

        Review.countDocuments({ project: project._id }),

        // Aggregate review counts by rating for the five-star distribution chart.
        Review.aggregate([
            { $match: { project: project._id } },
            { $group: { _id: { $floor: "$rating" }, count: { $sum: 1 } } }
        ])
    ]);

    // Initialize every rating category, including categories with no reviews.
    const ratingDistribution: Record<number, number> = {
        0: 0,
        1: 0,
        2: 0,
        3: 0,
        4: 0,
        5: 0
    };

    for (const entry of distribution) {
        ratingDistribution[entry._id] = entry.count;
    }

    // Include the authenticated user's review when available.
    let myReview = null;

    if (req.user) {
        myReview = await Review.findOne({
            project: project._id,
            user: req.user._id
        }).lean();
    }

    res.json({
        ok: true,
        reviews,
        myReview,
        distribution: ratingDistribution,
        summary: {
            rating: project.rating,
            satisfaction: project.satisfaction,
            reviewCount: project.reviewCount
        },
        pagination: {
            page: query.page,
            limit: query.limit,
            total,
            pages: Math.ceil(total / query.limit)
        }
    });
});

/* ==================================================================
   GET ONE — Retrieve the authenticated user's review for a project
   ================================================================== */
export const getMyReview = asyncHandler(async (req: any, res: Response) => {
    const project = await findProject(req.params.idOrSlug);

    const review = await Review.findOne({
        project: project._id,
        user: req.user._id
    }).lean();

    res.json({ ok: true, review });
});

/* ==================================================================
   CREATE — Enforce one review per user for each project
   ================================================================== */
export const createReview = asyncHandler(async (req: any, res: Response) => {
    const project = await findProject(req.params.idOrSlug);
    const data = validate(createReviewSchema, req.body);

    // Prevent project owners from reviewing their own projects.
    if (String(project.owner) === String(req.user._id)) {
        throw Forbidden(ErrorCodes.CANNOT_REVIEW_OWN);
    }

    // Ensure the user has not already reviewed this project.
    const existingReview = await Review.findOne({
        project: project._id,
        user: req.user._id
    }).lean();

    if (existingReview) {
        throw Conflict(ErrorCodes.REVIEW_ALREADY_EXISTS);
    }

    const review = await Review.create({
        project: project._id,
        user: req.user._id,
        rating: data.rating,
        satisfaction: data.satisfaction,
        title: data.title,
        body: data.body
    });

    await recalculateProjectStats(project._id);

    const populatedReview = await review.populate("user", "name username");

    res.status(201).json({ ok: true, review: populatedReview });
});

/* ==================================================================
   UPDATE — Allow only the review author to modify a review
   ================================================================== */
export const updateReview = asyncHandler(async (req: any, res: Response) => {
    const project = await findProject(req.params.idOrSlug);
    const data = validate(updateReviewSchema, req.body);

    const review = await Review.findOne({
        project: project._id,
        user: req.user._id
    });

    if (!review) {
        throw new AppError(404, ErrorCodes.REVIEW_NOT_FOUND);
    }

    if (data.rating !== undefined) {
        review.rating = data.rating;
    }

    if (data.satisfaction !== undefined) {
        review.satisfaction = data.satisfaction;
    }

    if (data.title !== undefined) {
        review.title = data.title;
    }

    if (data.body !== undefined) {
        review.body = data.body;
    }

    review.isEdited = true;
    review.editedAt = new Date();

    await review.save();
    await recalculateProjectStats(project._id);

    const populatedReview = await review.populate("user", "name username");

    res.json({ ok: true, review: populatedReview });
});

/* ==================================================================
   DELETE — Delete the authenticated user's review
   ================================================================== */
export const deleteReview = asyncHandler(async (req: any, res: Response) => {
    const project = await findProject(req.params.idOrSlug);

    const review = await Review.findOne({
        project: project._id,
        user: req.user._id
    });

    if (!review) {
        throw new AppError(404, ErrorCodes.REVIEW_NOT_FOUND);
    }

    await review.deleteOne();
    await recalculateProjectStats(project._id);

    res.json({
        ok: true,
        message: "Review deleted successfully."
    });
});

/* ==================================================================
   MARK HELPFUL — Mark a review as helpful
   ================================================================== */
export const markHelpful = asyncHandler(async (req: any, res: Response) => {
    const review = await Review.findById(req.params.id);

    if (!review) {
        throw new AppError(404, ErrorCodes.REVIEW_NOT_FOUND);
    }

    review.helpfulCount += 1;
    await review.save();

    res.json({
        ok: true,
        helpfulCount: review.helpfulCount
    });
});

/**
 * Copyright (c) 2026 Sobhan Rasoulzadeh Asl (Sobhan-SRZA / Mr. Sinre)
 *
 * Licensed under the BSD 3-Clause License.
 * See the LICENSE file in the project root for licensing details.
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */