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
function buildUserQuery(idOrUsername: string) {
    const isObjectId = /^[a-f\d]{24}$/i.test(idOrUsername);
    return isObjectId
        ? { _id: idOrUsername }
        : { usernameLower: idOrUsername.toLowerCase() };
}

/* ==================================================================
   GET /api/users/:idOrUsername — profile + stats
   ================================================================== */
export const getPublicProfile = asyncHandler(async (req: Request, res: Response) => {
    const user = await User.findOne(buildUserQuery((req.params as any).idOrUsername))
        .select("name username usernameLower avatar bio role createdAt emailVerified")
        .lean();

    if (!user) {
        throw new AppError(404, ErrorCodes.UNAUTHENTICATED, "کاربر یافت نشد");
    }

    /* ---------- stats ---------- */
    const [projectsCount, reviewsWritten, downloadsAgg, reviewStatsAgg] = await Promise.all([
        // تعداد پروژه‌های منتشرشده
        Project.countDocuments({ owner: user._id, status: "published", isPublic: true }),

        // تعداد ریویوهایی که این کاربر داده (برای آمار در صورت نیاز)
        Review.countDocuments({ user: user._id }),

        // مجموع دانلودها
        Project.aggregate([
            { $match: { owner: user._id, status: "published", isPublic: true } },
            { $group: { _id: null, total: { $sum: "$downloads" } } }
        ]),

        // آمار ریویوهای دریافتی از aggregate Project
        Project.aggregate([
            { $match: { owner: user._id, status: "published", isPublic: true } },
            {
                $group: {
                    _id: null,
                    avgRating: { $avg: "$rating" },
                    totalReviews: { $sum: "$reviewCount" }
                }
            }
        ])
    ]);

    const avgRating = reviewStatsAgg[0]?.avgRating ? Math.round(reviewStatsAgg[0].avgRating * 10) / 10 : 0;
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
                reviewsReceived,      // ✅ ریویوهای دریافتی (روی پروژه‌های این کاربر)
                reviewsGiven: reviewsWritten, // ✅ (اختیاری) ریویوهایی که داده
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

    const user = await User.findOne(buildUserQuery((req.params as any).idOrUsername))
        .select("_id")
        .lean();

    if (!user)
        throw new AppError(404, ErrorCodes.UNAUTHENTICATED, "کاربر یافت نشد");

    const filter: FilterProject = { owner: user._id, status: "published", isPublic: true };

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

    const user = await User.findOne(buildUserQuery((req.params as any).idOrUsername))
        .select("_id")
        .lean();

    if (!user)
        throw new AppError(404, ErrorCodes.UNAUTHENTICATED, "کاربر یافت نشد");

    /* ---------- پیدا کردن همه‌ی پروژه‌های منتشرشده‌ی این کاربر ---------- */
    const projectIds = await Project.find({
        owner: user._id,
        status: "published",
        isPublic: true
    }).distinct("_id");

    if (!projectIds.length) {
        return res.json({
            ok: true,
            reviews: [],
            pagination: { page, limit, total: 0, pages: 0 }
        });
    }

    /* ---------- مرتب‌سازی ---------- */
    const sortMap: Record<string, any> = {
        recent: { createdAt: -1 },
        oldest: { createdAt: 1 },
        highest: { rating: -1, createdAt: -1 },
        lowest: { rating: 1, createdAt: -1 }
    };

    /* ---------- ریویوهای روی این پروژه‌ها ---------- */
    const filter = { project: { $in: projectIds } };

    const [reviews, total] = await Promise.all([
        Review.find(filter)
            .populate({
                path: "project",
                select: "title slug shortDescription images rating reviewCount"
            })
            .populate("user", "name username avatar")   // ← نویسنده‌ی ریویو
            .sort(sortMap[sort] || sortMap.recent)
            .skip((page - 1) * limit)
            .limit(limit)
            .lean(),

        Review.countDocuments(filter)
    ]);

    /* ---------- فیلتر پروژه‌هایی که user هنوز داره ---------- */
    const valid = (reviews as any[]).filter((r) => r.project);

    res.json({
        ok: true,
        reviews: valid,
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