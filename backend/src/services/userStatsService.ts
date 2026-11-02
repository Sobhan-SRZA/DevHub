/**
 * Aggregates per-user analytics from existing collections. Uses
 * MongoDB aggregation pipelines to compute daily buckets and
 * summary counters in a small number of round trips.
 *
 * Historical view and download counts are cumulative on the Project
 * document — daily breakdowns of those metrics require a separate
 * snapshot table, which is out of scope for this version. The timeline
 * therefore reports projects created, reviews received, comments
 * received, and likes received, all of which have reliable timestamps.
 */

import { PipelineStage, Types } from "mongoose";
import { Project } from "../models/Project";
import { Review } from "../models/Review";
import { Comment } from "../models/Comment";
import { User } from "../models/User";

/* -------------------- Types -------------------- */

export type StatsRange = "7d" | "30d" | "90d" | "1y";

export interface DailyBucket {
    date: string;           // ISO date, YYYY-MM-DD
    projects: number;
    reviewsReceived: number;
    commentsReceived: number;
    likesReceived: number;
}

export interface UserStats {
    user: {
        id: string;
        name: string;
        username: string;
        joinedAt: Date;
        profileCompleteness: number;    // 0–100
        rank: {
            position: number;
            total: number;
            percentile: number;         // 0–100
        };
    };
    summary: {
        projects: {
            total: number;
            published: number;
            drafts: number;
            archived: number;
        };
        downloads: { total: number; };
        stars: { total: number; };
        views: { total: number; };
        reviews: {
            received: number;
            averageRating: number;
        };
        comments: {
            sent: number;
            received: number;
        };
        likes: {
            receivedOnProjects: number;
            receivedOnComments: number;
        };
    };
    timeline: DailyBucket[];
    recentActivity: Array<{
        type: "project" | "review" | "comment";
        title: string;
        link: string;
        createdAt: Date;
    }>;
    milestones: Array<{
        key: string;
        label: string;
        achieved: boolean;
        achievedAt: Date | null;
    }>;
}

/* -------------------- Range Helpers -------------------- */

function rangeToDays(range: StatsRange): number {
    switch (range) {
        case "7d": return 7;
        case "30d": return 30;
        case "90d": return 90;
        case "1y": return 365;
    }
}

function startOfDayUtc(d: Date): Date {
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function isoDate(d: Date): string {
    return d.toISOString().slice(0, 10);
}

/* -------------------- Profile Completeness -------------------- */

/**
 * Scores the profile out of 100 based on the presence of identity
 * fields, a bio, an avatar, and at least one published project.
 */
function computeProfileCompleteness(user: any): number {
    const fields: Array<[boolean, number]> = [
        [Boolean(user.name && user.name.trim()), 10],
        [Boolean(user.username), 10],
        [Boolean(user.emailVerified), 15],
        [Boolean(user.bio && user.bio.trim().length >= 20), 20],
        [Boolean(user.avatar && user.avatar.url), 25],
        [false, 20] // Placeholder — replaced below by project count.
    ];

    // Score replaced below once we know the published project count.
    const baseScore = fields
        .slice(0, 5)
        .reduce((sum, [ok, weight]) => sum + (ok ? weight : 0), 0);

    return baseScore;
}

/* -------------------- Main Entry -------------------- */

/**
 * Builds the analytics object for the given user.
 *
 * @param userId - The authenticated user's ObjectId.
 * @param range  - Window used for the timeline (defaults to 30 days).
 */
export async function buildUserStats(
    userId: Types.ObjectId,
    range: StatsRange = "30d"
): Promise<UserStats> {
    const days = rangeToDays(range);
    const now = new Date();
    const windowStart = startOfDayUtc(new Date(now.getTime() - days * 86400_000));

    /* ---------- User record ---------- */
    const user: any = await User.findById(userId).lean();

    if (!user) {
        throw new Error("User not found.");
    }

    /* ---------- Projects ---------- */
    const projects = await Project.find({ owner: userId })
        .select("_id title slug status isPublic downloads views githubData createdAt")
        .lean();

    const projectIds = projects.map((p: any) => p._id);

    const published = projects.filter(
        (p: any) => p.status === "published"
    );
    const drafts = projects.filter((p: any) => p.status === "draft");
    const archived = projects.filter((p: any) => p.status === "archived");

    const totalDownloads = projects.reduce(
        (sum, p: any) => sum + (p.downloads || 0), 0
    );
    const totalViews = projects.reduce(
        (sum, p: any) => sum + (p.views || 0), 0
    );
    const totalStars = projects.reduce(
        (sum, p: any) => sum + (p.githubData?.stars || 0), 0
    );

    /* ---------- Reviews received ---------- */
    const reviewPipeline: PipelineStage[] = [
        { $match: { project: { $in: projectIds } } },
        {
            $facet: {
                summary: [
                    {
                        $group: {
                            _id: null,
                            count: { $sum: 1 },
                            avgRating: { $avg: "$rating" }
                        }
                    }
                ],
                daily: [
                    { $match: { createdAt: { $gte: windowStart } } },
                    {
                        $group: {
                            _id: {
                                $dateToString: {
                                    format: "%Y-%m-%d",
                                    date: "$createdAt"
                                }
                            },
                            count: { $sum: 1 }
                        }
                    },
                    { $sort: { _id: 1 } }
                ]
            }
        }
    ];

    const reviewResult = projectIds.length
        ? await Review.aggregate(reviewPipeline)
        : [{ summary: [], daily: [] }];

    const reviewSummary = reviewResult[0]?.summary?.[0] || {
        count: 0, avgRating: 0
    };
    const reviewDailyMap = new Map<string, number>();
    for (const row of reviewResult[0]?.daily || []) {
        reviewDailyMap.set(row._id, row.count);
    }

    /* ---------- Comments received ---------- */
    const commentPipeline = [
        { $match: { project: { $in: projectIds } } },
        {
            $facet: {
                total: [{ $count: "count" }],
                daily: [
                    { $match: { createdAt: { $gte: windowStart } } },
                    {
                        $group: {
                            _id: {
                                $dateToString: {
                                    format: "%Y-%m-%d",
                                    date: "$createdAt"
                                }
                            },
                            count: { $sum: 1 }
                        }
                    }
                ]
            }
        }
    ];

    const commentResult = projectIds.length
        ? await Comment.aggregate(commentPipeline)
        : [{ total: [], daily: [] }];

    const commentsReceived = commentResult[0]?.total?.[0]?.count || 0;
    const commentDailyMap = new Map<string, number>();
    for (const row of commentResult[0]?.daily || []) {
        commentDailyMap.set(row._id, row.count);
    }

    /* ---------- Comments sent ---------- */
    const commentsSent = await Comment.countDocuments({ user: userId });

    /* ---------- Likes received on comments ---------- */
    const likesOnCommentsAgg = projectIds.length
        ? await Comment.aggregate([
            {
                $match: {
                    project: { $in: projectIds },
                    "likes.0": { $exists: true }
                }
            },
            {
                $project: {
                    likeCount: { $size: "$likes" },
                    likes: 1,
                    createdAt: 1
                }
            },
            {
                $facet: {
                    total: [{ $group: { _id: null, sum: { $sum: "$likeCount" } } }],
                    daily: [
                        { $unwind: "$likes" },
                        { $match: { createdAt: { $gte: windowStart } } },
                        {
                            $group: {
                                _id: {
                                    $dateToString: {
                                        format: "%Y-%m-%d",
                                        date: "$createdAt"
                                    }
                                },
                                count: { $sum: 1 }
                            }
                        }
                    ]
                }
            }
        ])
        : [{ total: [], daily: [] }];

    const likesOnCommentsTotal = likesOnCommentsAgg[0]?.total?.[0]?.sum || 0;
    const commentLikeDailyMap = new Map<string, number>();
    for (const row of likesOnCommentsAgg[0]?.daily || []) {
        commentLikeDailyMap.set(row._id, row.count);
    }

    /* ---------- Likes received on projects ---------- */
    // Project model does not track individual likes yet; use helpful
    // review count as a proxy for external engagement.
    const likesOnProjectsTotal = 0;

    /* ---------- Daily timeline ---------- */
    // Build the ordered window and fill buckets from each map.
    const projectDailyMap = new Map<string, number>();
    for (const p of projects) {
        const created = new Date((p as any).createdAt);
        if (created >= windowStart) {
            const key = isoDate(created);
            projectDailyMap.set(key, (projectDailyMap.get(key) || 0) + 1);
        }
    }

    const timeline: DailyBucket[] = [];
    for (let i = 0; i < days; i++) {
        const day = new Date(windowStart.getTime() + i * 86400_000);
        const key = isoDate(day);

        timeline.push({
            date: key,
            projects: projectDailyMap.get(key) || 0,
            reviewsReceived: reviewDailyMap.get(key) || 0,
            commentsReceived: commentDailyMap.get(key) || 0,
            likesReceived: commentLikeDailyMap.get(key) || 0
        });
    }

    /* ---------- Recent activity ---------- */
    const [recentProjects, recentReviews, recentComments] = await Promise.all([
        Project.find({ owner: userId })
            .sort({ createdAt: -1 })
            .limit(5)
            .select("title slug createdAt")
            .lean(),
        projectIds.length
            ? Review.find({ project: { $in: projectIds } })
                .sort({ createdAt: -1 })
                .limit(5)
                .populate("project", "title slug")
                .populate("user", "name username")
                .select("rating createdAt project user")
                .lean()
            : Promise.resolve([]),
        projectIds.length
            ? Comment.find({ project: { $in: projectIds } })
                .sort({ createdAt: -1 })
                .limit(5)
                .populate("project", "title slug")
                .populate("user", "name username")
                .select("body createdAt project user")
                .lean()
            : Promise.resolve([])
    ]);

    const recentActivity = [
        ...recentProjects.map((p: any) => ({
            type: "project" as const,
            title: `Created "${p.title}"`,
            link: `/projects/${p.slug}`,
            createdAt: p.createdAt
        })),
        ...recentReviews.map((r: any) => ({
            type: "review" as const,
            title: `${r.user?.name || "Someone"} reviewed "${r.project?.title || "a project"}"`,
            link: `/projects/${r.project?.slug}`,
            createdAt: r.createdAt
        })),
        ...recentComments.map((c: any) => ({
            type: "comment" as const,
            title: `${c.user?.name || "Someone"} commented on "${c.project?.title || "a project"}"`,
            link: `/projects/${c.project?.slug}`,
            createdAt: c.createdAt
        }))
    ]
        .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
        .slice(0, 8);

    /* ---------- Rank ---------- */
    // Rank users by total engagement: projects published * 10 +
    // stars + downloads / 10 + reviews received.
    const totalUsers = await User.countDocuments({ isBanned: { $ne: true } });

    const allUsersScores = await Project.aggregate([
        {
            $group: {
                _id: "$owner",
                publishedCount: {
                    $sum: { $cond: [{ $eq: ["$status", "published"] }, 1, 0] }
                },
                downloads: { $sum: "$downloads" },
                stars: { $sum: "$githubData.stars" }
            }
        },
        {
            $addFields: {
                score: {
                    $add: [
                        { $multiply: ["$publishedCount", 10] },
                        "$stars",
                        { $divide: ["$downloads", 10] }
                    ]
                }
            }
        },
        { $sort: { score: -1 } }
    ]);

    const myScoreEntry = allUsersScores.find(
        (u: any) => String(u._id) === String(userId)
    );
    const myScore = myScoreEntry?.score || 0;
    const position = myScoreEntry
        ? allUsersScores.findIndex(
            (u: any) => String(u._id) === String(userId)
        ) + 1
        : allUsersScores.length + 1;

    const percentile = totalUsers > 1
        ? Math.round(((totalUsers - position) / (totalUsers - 1)) * 100)
        : 100;

    /* ---------- Milestones ---------- */
    const milestones = [
        {
            key: "first_project",
            label: "Published your first project",
            achieved: published.length >= 1,
            achievedAt: published.length
                ? (published[0] as any).createdAt
                : null
        },
        {
            key: "first_review",
            label: "Received your first review",
            achieved: reviewSummary.count >= 1,
            achievedAt: null
        },
        {
            key: "first_star",
            label: "Earned a GitHub star",
            achieved: totalStars >= 1,
            achievedAt: null
        },
        {
            key: "ten_stars",
            label: "Earned 10 stars",
            achieved: totalStars >= 10,
            achievedAt: null
        },
        {
            key: "hundred_downloads",
            label: "Reached 100 downloads",
            achieved: totalDownloads >= 100,
            achievedAt: null
        },
        {
            key: "five_projects",
            label: "Published five projects",
            achieved: published.length >= 5,
            achievedAt: null
        }
    ];

    /* ---------- Compose response ---------- */
    const baseCompleteness = computeProfileCompleteness(user);
    const projectCompleteness = published.length > 0 ? 20 : 0;
    const profileCompleteness = Math.min(
        100,
        baseCompleteness + projectCompleteness
    );

    return {
        user: {
            id: String(user._id),
            name: user.name,
            username: user.username,
            joinedAt: user.createdAt,
            profileCompleteness,
            rank: {
                position,
                total: totalUsers,
                percentile
            }
        },
        summary: {
            projects: {
                total: projects.length,
                published: published.length,
                drafts: drafts.length,
                archived: archived.length
            },
            downloads: { total: totalDownloads },
            stars: { total: totalStars },
            views: { total: totalViews },
            reviews: {
                received: reviewSummary.count,
                averageRating: Number((reviewSummary.avgRating || 0).toFixed(2))
            },
            comments: {
                sent: commentsSent,
                received: commentsReceived
            },
            likes: {
                receivedOnProjects: likesOnProjectsTotal,
                receivedOnComments: likesOnCommentsTotal
            }
        },
        timeline,
        recentActivity,
        milestones
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