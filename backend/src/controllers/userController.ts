import {
    FilterProject,
    Project
} from "../models/Project";
import type {
    Request,
    Response
} from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { ErrorCodes } from "../utils/errorCodes";
import { AppError } from "../utils/AppError";
import { Review } from "../models/Review";
import { User } from "../models/User";

/* ==================================================================
   Helpers
   ================================================================== */

/**
 * Builds a user query using either a MongoDB ObjectId or a username.
 */
function buildUserQuery(idOrUsername: string) {
    const isObjectId = /^[a-f\d]{24}$/i.test(idOrUsername);

    return isObjectId
        ? { _id: idOrUsername }
        : { usernameLower: idOrUsername.toLowerCase() };
}


/* ==========================================================================
 * User Directory
 * ========================================================================== */

/**
 * Returns a paginated list of active users for the public directory.
 *
 * Search (`q`) matches against the display name and username using a
 * case-insensitive prefix-anywhere regular expression. The sort order
 * may be by newest account, alphabetical name, or most published
 * projects.
 *
 * Project counts are computed with a single aggregation pass over the
 * matching users, so the endpoint remains efficient even as the
 * directory grows.
 */
export const listUsers = asyncHandler(
    async (req: Request, res: Response) => {
        /* ---------- Query parameters ---------- */
        const page = Math.max(1, Number(req.query.page) || 1);
        const limit = Math.min(
            60,
            Math.max(1, Number(req.query.limit) || 24)
        );
        const sort = String(req.query.sort || "recent");
        const q = String(req.query.q || "").trim().slice(0, 80);

        /* ---------- Base filter ---------- */
        const filter: Record<string, any> = {
            isBanned: { $ne: true }
        };

        if (q) {
            // Escape regex metacharacters so user input cannot cause
            // unintended matches or catastrophic backtracking.
            const rx = new RegExp(
                q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
                "i"
            );

            filter.$or = [{ name: rx }, { username: rx }];
        }

        /* ---------- Sort spec ---------- */
        let sortSpec: Record<string, 1 | -1> = { createdAt: -1 };

        if (sort === "name") {
            sortSpec = { name: 1, username: 1 };
        } else if (sort === "projects") {
            // Project-count sorting is resolved after aggregation.
            // Fall back to recency for the initial query, then reorder.
            sortSpec = { createdAt: -1 };
        }

        /* ---------- Fetch page ---------- */
        const [users, total] = await Promise.all([
            User.find(filter)
                .sort(sortSpec)
                .skip((page - 1) * limit)
                .limit(limit)
                .select("name username avatar bio createdAt")
                .lean(),
            User.countDocuments(filter)
        ]);

        /* ---------- Project counts ---------- */
        const ids = users.map((u) => u._id);

        let countMap = new Map<string, number>();

        if (ids.length) {
            const counts = await Project.aggregate([
                {
                    $match: {
                        owner: { $in: ids },
                        status: "published",
                        isPublic: true
                    }
                },
                { $group: { _id: "$owner", count: { $sum: 1 } } }
            ]);

            countMap = new Map(
                counts.map((c) => [String(c._id), c.count as number])
            );
        }

        /* ---------- Shape response ---------- */
        let serialized = users.map((u) => ({
            id: u._id,
            name: u.name,
            username: u.username,
            avatar: u.avatar || null,
            bio: u.bio || "",
            projectsCount: countMap.get(String(u._id)) || 0,
            createdAt: u.createdAt
        }));

        /* ---------- Reorder by project count if requested ---------- */
        if (sort === "projects") {
            serialized = serialized.sort(
                (a, b) => b.projectsCount - a.projectsCount
            );
        }

        res.json({
            ok: true,
            users: serialized,
            pagination: {
                page,
                limit,
                total,
                pages: Math.max(1, Math.ceil(total / limit))
            }
        });
    }
);


/* ==================================================================
   GET /api/users/:idOrUsername — Public profile and statistics
   ================================================================== */

export const getPublicProfile = asyncHandler(async (req: Request, res: Response) => {
    const user = await User.findOne(
        buildUserQuery((req.params as any).idOrUsername)
    )
        .select("name username usernameLower avatar bio role createdAt emailVerified")
        .lean();

    if (!user) {
        throw new AppError(404, ErrorCodes.UNAUTHENTICATED, "User not found");
    }

    /* ---------- Statistics ---------- */

    const [
        projectsCount,
        reviewsWritten,
        downloadsAgg,
        reviewStatsAgg
    ] = await Promise.all([
        // Count published projects owned by the user.
        Project.countDocuments({
            owner: user._id,
            status: "published",
            isPublic: true
        }),

        // Count reviews written by the user.
        Review.countDocuments({ user: user._id }),

        // Calculate the total downloads across the user's published projects.
        Project.aggregate([
            {
                $match: {
                    owner: user._id,
                    status: "published",
                    isPublic: true
                }
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: "$downloads" }
                }
            }
        ]),

        // Aggregate review statistics across the user's published projects.
        Project.aggregate([
            {
                $match: {
                    owner: user._id,
                    status: "published",
                    isPublic: true
                }
            },
            {
                $group: {
                    _id: null,
                    avgRating: { $avg: "$rating" },
                    totalReviews: { $sum: "$reviewCount" }
                }
            }
        ])
    ]);

    const avgRating = reviewStatsAgg[0]?.avgRating
        ? Math.round(reviewStatsAgg[0].avgRating * 10) / 10
        : 0;

    const reviewsReceived = reviewStatsAgg[0]?.totalReviews || 0;

    res.json({
        ok: true,
        user: {
            id: user._id,
            name: user.name,
            username: user.username,
            avatar: user.avatar || null,
            bio: user.bio || "",
            role: user.role || "user",
            createdAt: user.createdAt,
            emailVerified: !!user.emailVerified,
            stats: {
                projects: projectsCount,
                reviewsReceived, // Reviews received across the user's projects.
                reviewsGiven: reviewsWritten, // Reviews written by the user.
                downloads: downloadsAgg[0]?.total || 0,
                rating: avgRating
            }
        }
    });
});

/* ==================================================================
   GET /api/users/:idOrUsername/projects
   ================================================================== */

export const getUserProjects = asyncHandler(async (req: Request, res: Response) => {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Number(req.query.limit) || 12);
    const sort = String(req.query.sort || "recent");

    const user = await User.findOne(
        buildUserQuery((req.params as any).idOrUsername)
    )
        .select("_id")
        .lean();

    if (!user) {
        throw new AppError(404, ErrorCodes.UNAUTHENTICATED, "User not found");
    }

    const filter: FilterProject = {
        owner: user._id,
        status: "published",
        isPublic: true
    };

    const sortMap: Record<string, any> = {
        recent: { updatedAt: -1 },
        rating: { rating: -1, reviewCount: -1 },
        downloads: { downloads: -1, updatedAt: -1 },
        stars: { "githubData.stars": -1, updatedAt: -1 }
    };

    const [projects, total] = await Promise.all([
        Project.find(filter)
            .populate("owner", "name username avatar")
            .populate("tags", "name slug color")
            .sort(sortMap[sort] || sortMap.recent)
            .skip((page - 1) * limit)
            .limit(limit)
            .lean(),

        Project.countDocuments(filter)
    ]);

    res.json({
        ok: true,
        projects,
        pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit)
        }
    });
});

/* ==================================================================
   GET /api/users/:idOrUsername/reviews
   ================================================================== */

export const getUserReviews = asyncHandler(async (req: Request, res: Response) => {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Number(req.query.limit) || 10);
    const sort = String(req.query.sort || "recent");

    const user = await User.findOne(
        buildUserQuery((req.params as any).idOrUsername)
    )
        .select("_id")
        .lean();

    if (!user) {
        throw new AppError(404, ErrorCodes.UNAUTHENTICATED, "User not found");
    }

    /* ---------- Retrieve all published projects owned by the user ---------- */

    const projectIds = await Project.find({
        owner: user._id,
        status: "published",
        isPublic: true
    }).distinct("_id");

    if (!projectIds.length) {
        return res.json({
            ok: true,
            reviews: [],
            pagination: {
                page,
                limit,
                total: 0,
                pages: 0
            }
        });
    }

    /* ---------- Sorting ---------- */

    const sortMap: Record<string, any> = {
        recent: { createdAt: -1 },
        oldest: { createdAt: 1 },
        highest: { rating: -1, createdAt: -1 },
        lowest: { rating: 1, createdAt: -1 }
    };

    /* ---------- Retrieve reviews for the user's projects ---------- */

    const filter = {
        project: { $in: projectIds }
    };

    const [reviews, total] = await Promise.all([
        Review.find(filter)
            .populate({
                path: "project",
                select: "title slug shortDescription images rating reviewCount"
            })
            .populate("user", "name username avatar") // Review author.
            .sort(sortMap[sort] || sortMap.recent)
            .skip((page - 1) * limit)
            .limit(limit)
            .lean(),

        Review.countDocuments(filter)
    ]);

    /* ---------- Exclude reviews whose associated projects no longer exist ---------- */

    const validReviews = (reviews as any[]).filter((review) => review.project);

    res.json({
        ok: true,
        reviews: validReviews,
        pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit)
        }
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