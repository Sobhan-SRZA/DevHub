
import { Project } from "../models/Project";
import { Types } from "mongoose";
import { User } from "../models/User";
import { Tag } from "../models/Tag";

/* ========================================================================== */
/* Types                                                                      */
/* ========================================================================== */

export type ExploreSort =
    | "trending"
    | "hot"
    | "top"
    | "new"
    | "top-rated"
    | "top-downloaded";

export type ExploreWindow = "24h" | "7d" | "30d" | "all";

/* ========================================================================== */
/* Ranking Algorithm Configuration                                            */
/* ========================================================================== */

/**
 * Controls the rate at which project popularity scores decay over time.
 * A gravity value of zero disables time-based decay.
 */
const GRAVITY: Record<ExploreWindow, number> = {
    "24h": 1.5,
    "7d": 1.8,
    "30d": 2.0,
    all: 0
};

/**
 * Defines the maximum project age considered by each ranking window.
 */
const WINDOW_MS: Record<ExploreWindow, number> = {
    "24h": 24 * 60 * 60 * 1000,
    "7d": 7 * 24 * 60 * 60 * 1000,
    "30d": 30 * 24 * 60 * 60 * 1000,
    all: 0
};

/* ========================================================================== */
/* Hot Score Calculation                                                      */
/* ========================================================================== */

/**
 * Calculates a project's popularity score using engagement metrics,
 * content completeness, and the age of the project.
 *
 * Higher scores indicate greater relevance within the selected time window.
 */
export function computeHotScore(
    project: any,
    window: ExploreWindow = "7d"
): number {
    const gravity = GRAVITY[window];

    const points =
        1.0 * (project.githubData?.stars || 0) +
        2.5 * (project.githubData?.forks || 0) +
        0.3 * (project.downloads || 0) +
        0.01 * (project.views || 0) +
        5.0 * (project.rating || 0) +
        4.0 * (project.reviewCount || 0) +
        (project.images?.length ? 10 : 0) +
        (project.demoVideo?.url ? 10 : 0) +
        (project.downloadFile?.url ? 5 : 0);

    if (gravity === 0) {
        return points;
    }

    const ageHours =
        (Date.now() - new Date(project.createdAt).getTime()) /
        (1000 * 60 * 60);

    return points / Math.pow(ageHours + 2, gravity);
}

/* ========================================================================== */
/* Hot Score Aggregation Pipeline                                             */
/* ========================================================================== */

/**
 * Builds a MongoDB aggregation pipeline that calculates popularity scores
 * directly in the database, avoiding per-document calculations in Node.js.
 */
function buildHotScorePipeline(window: ExploreWindow) {
    const gravity = GRAVITY[window];

    const pipeline: any[] = [
        // Restrict results to projects created within the selected time window.
        ...(WINDOW_MS[window] > 0
            ? [
                {
                    $match: {
                        createdAt: {
                            $gte: new Date(Date.now() - WINDOW_MS[window])
                        }
                    }
                }
            ]
            : []),

        // Calculate the project's age in hours.
        {
            $addFields: {
                _ageHours: {
                    $divide: [
                        { $subtract: [new Date(), "$createdAt"] },
                        1000 * 60 * 60
                    ]
                }
            }
        },

        // Calculate the base score from engagement and content metadata.
        {
            $addFields: {
                _points: {
                    $add: [
                        {
                            $multiply: [
                                1.0,
                                { $ifNull: ["$githubData.stars", 0] }
                            ]
                        },
                        {
                            $multiply: [
                                2.5,
                                { $ifNull: ["$githubData.forks", 0] }
                            ]
                        },
                        {
                            $multiply: [
                                0.3,
                                { $ifNull: ["$downloads", 0] }
                            ]
                        },
                        {
                            $multiply: [
                                0.01,
                                { $ifNull: ["$views", 0] }
                            ]
                        },
                        {
                            $multiply: [
                                5.0,
                                { $ifNull: ["$rating", 0] }
                            ]
                        },
                        {
                            $multiply: [
                                4.0,
                                { $ifNull: ["$reviewCount", 0] }
                            ]
                        },
                        {
                            $cond: [
                                {
                                    $gt: [
                                        {
                                            $size: {
                                                $ifNull: ["$images", []]
                                            }
                                        },
                                        0
                                    ]
                                },
                                10,
                                0
                            ]
                        },
                        {
                            $cond: [
                                {
                                    $ne: [
                                        { $ifNull: ["$demoVideo.url", null] },
                                        null
                                    ]
                                },
                                10,
                                0
                            ]
                        },
                        {
                            $cond: [
                                {
                                    $ne: [
                                        { $ifNull: ["$downloadFile.url", null] },
                                        null
                                    ]
                                },
                                5,
                                0
                            ]
                        }
                    ]
                }
            }
        }
    ];

    // Apply time-based score decay when the selected window requires it.
    if (gravity > 0) {
        pipeline.push({
            $addFields: {
                _hotScore: {
                    $divide: [
                        "$_points",
                        {
                            $pow: [
                                { $add: ["$_ageHours", 2] },
                                gravity
                            ]
                        }
                    ]
                }
            }
        });
    } else {
        pipeline.push({
            $addFields: {
                _hotScore: "$_points"
            }
        });
    }

    return pipeline;
}

/* ========================================================================== */
/* Explore Project Options                                                    */
/* ========================================================================== */

export interface ExploreOptions {
    sort: ExploreSort;
    window?: ExploreWindow;
    tag?: string;
    tagType?: string;
    search?: string;
    page?: number;
    limit?: number;
}

/* ========================================================================== */
/* Explore Projects                                                           */
/* ========================================================================== */

/**
 * Retrieves published, publicly accessible projects using the selected
 * ranking strategy, filters, and pagination settings.
 */
export async function exploreProjects(opts: ExploreOptions) {
    const {
        sort,
        window = sort === "hot"
            ? "24h"
            : sort === "trending"
                ? "7d"
                : "all",
        tag,
        tagType,
        search,
        page = 1,
        limit = 20
    } = opts;

    // Restrict results to published projects available to the public.
    const match: Record<string, any> = {
        status: "published",
        isPublic: true
    };

    if (tag) {
        match.tags = new Types.ObjectId(tag);
    }

    if (search) {
        match.$or = [
            { title: { $regex: search, $options: "i" } },
            { shortDescription: { $regex: search, $options: "i" } }
        ];
    }

    // Resolve tag IDs before applying the tag-type filter.
    if (tagType) {
        const tagIds = await Tag.find({ type: tagType }).distinct("_id");
        match.tags = { $in: tagIds };
    }

    const skip = (page - 1) * limit;

    // Determine whether ranking requires a calculated popularity score.
    const needsHotScore = sort === "trending" || sort === "hot";

    let sortStage: Record<string, any>;
    let pipeline: any[];

    if (needsHotScore) {
        pipeline = [
            { $match: match },
            ...buildHotScorePipeline(window),
            { $sort: { _hotScore: -1, createdAt: -1 } },
            { $skip: skip },
            { $limit: limit }
        ];

        sortStage = { _hotScore: -1 };
    } else {
        const sortMap: Record<
            ExploreSort,
            Record<string, 1 | -1>
        > = {
            trending: { "githubData.stars": -1 },
            hot: { createdAt: -1 },
            top: { rating: -1, reviewCount: -1 },
            new: { createdAt: -1 },
            "top-rated": { rating: -1, reviewCount: -1 },
            "top-downloaded": { downloads: -1, createdAt: -1 }
        };

        sortStage = sortMap[sort];

        pipeline = [
            { $match: match },
            { $sort: sortStage },
            { $skip: skip },
            { $limit: limit }
        ];
    }

    // Retrieve the requested page and total count concurrently.
    const [projects, total] = await Promise.all([
        Project.aggregate(pipeline).then((documents) =>
            Project.populate(documents, [
                {
                    path: "owner",
                    select: "name username avatar"
                },
                {
                    path: "tags",
                    select: "name slug color type"
                }
            ])
        ),

        Project.countDocuments(match)
    ]);

    return {
        projects,
        pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit)
        },
        sort,
        window: needsHotScore ? window : null
    };
}

/* ========================================================================== */
/* Home Feed Options                                                          */
/* ========================================================================== */

export interface HomeFeedOptions {
    limit?: number;
}

/* ========================================================================== */
/* Home Feeds                                                                  */
/* ========================================================================== */

/**
 * Builds the homepage feeds and retrieves aggregate platform statistics.
 *
 * Feed sections are fetched concurrently to reduce overall response time.
 */
export async function getHomeFeeds(opts: HomeFeedOptions = {}) {
    const limit = opts.limit || 8;

    const [
        trending,
        newProjects,
        topRated,
        topDownloaded,
        featured
    ] = await Promise.all([
        // Trending projects from the last seven days.
        exploreProjects({
            sort: "trending",
            window: "7d",
            limit
        }).then((result) => result.projects),

        // Most recently published projects.
        exploreProjects({
            sort: "new",
            limit: 6
        }).then((result) => result.projects),

        // Projects with the highest ratings and review counts.
        exploreProjects({
            sort: "top-rated",
            limit: 6
        }).then((result) => result.projects),

        // Projects with the highest download counts.
        exploreProjects({
            sort: "top-downloaded",
            limit: 6
        }).then((result) => result.projects),

        // Manually curated projects, ordered by featured priority.
        Project.find({
            status: "published",
            isPublic: true,
            featured: true
        })
            .populate("owner", "name username avatar")
            .populate("tags", "name slug color type")
            .sort({ featuredOrder: 1, updatedAt: -1 })
            .limit(6)
            .lean()
    ]);

    // Aggregate platform-wide statistics concurrently.
    const [
        totalProjects,
        totalUsers,
        totalTags,
        downloadsAgg
    ] = await Promise.all([
        Project.countDocuments({
            status: "published",
            isPublic: true
        }),

        User.countDocuments({}),

        Tag.countDocuments({
            isApproved: true
        }),

        Project.aggregate([
            {
                $match: {
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
        ])
    ]);

    return {
        sections: {
            trending: {
                title: "Trending Projects",
                subtitle: "The most popular projects from the last seven days",
                projects: trending
            },
            featured: {
                title: "Featured Projects",
                subtitle: "Handpicked by our team",
                projects: featured
            },
            newProjects: {
                title: "Latest Projects",
                subtitle: "Recently published projects",
                projects: newProjects
            },
            topRated: {
                title: "Top-Rated Projects",
                subtitle: "Ranked by user ratings and reviews",
                projects: topRated
            },
            topDownloaded: {
                title: "Most Downloaded Projects",
                subtitle: "Projects with the highest download counts",
                projects: topDownloaded
            }
        },
        stats: {
            projects: totalProjects,
            users: totalUsers,
            tags: totalTags,
            downloads: downloadsAgg[0]?.total || 0
        }
    };
}

/**
 * Copyright (c) 2026 Sobhan Rasoulzadeh Asl (Sobhan-SRZA / Mr. Sinre)
 *
 * Licensed under the BSD 3-Clause License.
 * See the LICENSE file in the project root for license information.
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */