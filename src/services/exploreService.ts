import { Types } from 'mongoose';
import { Project } from '../models/Project';
import { Tag } from '../models/Tag';
import { User } from '../models/User';

/* ==================================================================
   Types
   ================================================================== */
export type ExploreSort =
    | 'trending'
    | 'hot'
    | 'top'
    | 'new'
    | 'top-rated'
    | 'top-downloaded';

export type ExploreWindow = '24h' | '7d' | '30d' | 'all';

/* ==================================================================
   تنظیمات الگوریتم
   ================================================================== */
const GRAVITY: Record<ExploreWindow, number> = {
    '24h': 1.5,
    '7d': 1.8,
    '30d': 2.0,
    'all': 0,
};

const WINDOW_MS: Record<ExploreWindow, number> = {
    '24h': 24 * 60 * 60 * 1000,
    '7d': 7 * 24 * 60 * 60 * 1000,
    '30d': 30 * 24 * 60 * 60 * 1000,
    'all': 0,
};

/* ==================================================================
   محاسبه‌ی Hot Score (سمت Node — برای تک پروژه)
   ================================================================== */
export function computeHotScore(project: any, window: ExploreWindow = '7d'): number {
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

    if (gravity === 0) return points;

    const ageHours = (Date.now() - new Date(project.createdAt).getTime()) / (1000 * 60 * 60);
    return points / Math.pow(ageHours + 2, gravity);
}

/* ==================================================================
   ساخت aggregation pipeline برای Hot Score
   ================================================================== */
function buildHotScorePipeline(window: ExploreWindow) {
    const gravity = GRAVITY[window];

    const pipeline: any[] = [
        // فیلتر زمانی
        ...(WINDOW_MS[window] > 0
            ? [{ $match: { createdAt: { $gte: new Date(Date.now() - WINDOW_MS[window]) } } }]
            : []),

        // سن پروژه به ساعت
        {
            $addFields: {
                _ageHours: {
                    $divide: [
                        { $subtract: [new Date(), '$createdAt'] },
                        1000 * 60 * 60,
                    ],
                },
            },
        },

        // امتیاز پایه
        {
            $addFields: {
                _points: {
                    $add: [
                        { $multiply: [1.0, { $ifNull: ['$githubData.stars', 0] }] },
                        { $multiply: [2.5, { $ifNull: ['$githubData.forks', 0] }] },
                        { $multiply: [0.3, { $ifNull: ['$downloads', 0] }] },
                        { $multiply: [0.01, { $ifNull: ['$views', 0] }] },
                        { $multiply: [5.0, { $ifNull: ['$rating', 0] }] },
                        { $multiply: [4.0, { $ifNull: ['$reviewCount', 0] }] },
                        { $cond: [{ $gt: [{ $size: { $ifNull: ['$images', []] } }, 0] }, 10, 0] },
                        { $cond: [{ $ne: [{ $ifNull: ['$demoVideo.url', null] }, null] }, 10, 0] },
                        { $cond: [{ $ne: [{ $ifNull: ['$downloadFile.url', null] }, null] }, 5, 0] },
                    ],
                },
            },
        },
    ];

    // اعمال gravity
    if (gravity > 0) {
        pipeline.push({
            $addFields: {
                _hotScore: {
                    $divide: [
                        '$_points',
                        { $pow: [{ $add: ['$_ageHours', 2] }, gravity] },
                    ],
                },
            },
        });
    } else {
        pipeline.push({ $addFields: { _hotScore: '$_points' } });
    }

    return pipeline;
}

/* ==================================================================
   لیست پروژه‌های اکسپلور
   ================================================================== */
export interface ExploreOptions {
    sort: ExploreSort;
    window?: ExploreWindow;
    tag?: string;
    tagType?: string;
    search?: string;
    page?: number;
    limit?: number;
}

export async function exploreProjects(opts: ExploreOptions) {
    const {
        sort,
        window = sort === 'hot' ? '24h' : sort === 'trending' ? '7d' : 'all',
        tag,
        tagType,
        search,
        page = 1,
        limit = 20,
    } = opts;

    /* ---------- base match ---------- */
    const match: Record<string, any> = {
        status: 'published',
        isPublic: true,
    };

    if (tag) match.tags = new Types.ObjectId(tag);
    if (search) {
        match.$or = [
            { title: { $regex: search, $options: 'i' } },
            { shortDescription: { $regex: search, $options: 'i' } },
        ];
    }

    /* ---------- tagType filter ---------- */
    if (tagType) {
        const tagIds = await Tag.find({ type: tagType }).distinct('_id');
        match.tags = { $in: tagIds };
    }

    const skip = (page - 1) * limit;

    /* ---------- sort strategy ---------- */
    const needsHotScore = sort === 'trending' || sort === 'hot';
    let sortStage: Record<string, any>;
    let pipeline: any[];

    if (needsHotScore) {
        pipeline = [
            { $match: match },
            ...buildHotScorePipeline(window),
            { $sort: { _hotScore: -1, createdAt: -1 } },
            { $skip: skip },
            { $limit: limit },
        ];
        sortStage = { _hotScore: -1 };
    } else {
        const sortMap: Record<ExploreSort, Record<string, 1 | -1>> = {
            'trending': { 'githubData.stars': -1 },
            'hot': { createdAt: -1 },
            'top': { rating: -1, reviewCount: -1 },
            'new': { createdAt: -1 },
            'top-rated': { rating: -1, reviewCount: -1 },
            'top-downloaded': { downloads: -1, createdAt: -1 },
        };
        sortStage = sortMap[sort];

        pipeline = [
            { $match: match },
            { $sort: sortStage },
            { $skip: skip },
            { $limit: limit },
        ];
    }

    /* ---------- اجرا ---------- */
    const [projects, total] = await Promise.all([
        Project.aggregate(pipeline).then((docs) =>
            Project.populate(docs, [
                { path: 'owner', select: 'name username avatar' },
                { path: 'tags', select: 'name slug color type' },
            ])
        ),
        Project.countDocuments(match),
    ]);

    return {
        projects,
        pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit),
        },
        sort,
        window: needsHotScore ? window : null,
    };
}

/* ==================================================================
   فیدهای صفحه اصلی (Home feeds)
   ================================================================== */
export interface HomeFeedOptions {
    limit?: number;
}

export async function getHomeFeeds(opts: HomeFeedOptions = {}) {
    const limit = opts.limit || 8;

    const [trending, newProjects, topRated, topDownloaded, featured] = await Promise.all([
        /* 1. داغ‌ترین‌های ۷ روز اخیر */
        exploreProjects({ sort: 'trending', window: '7d', limit }).then((r) => r.projects),

        /* 2. جدیدترین‌ها */
        exploreProjects({ sort: 'new', limit: 6 }).then((r) => r.projects),

        /* 3. بهترین امتیازها */
        exploreProjects({ sort: 'top-rated', limit: 6 }).then((r) => r.projects),

        /* 4. پرطرفدارترین دانلودها */
        exploreProjects({ sort: 'top-downloaded', limit: 6 }).then((r) => r.projects),

        /* 5. پروژه‌های ویژه (featured) */
        Project.find({ status: 'published', isPublic: true, featured: true })
            .populate('owner', 'name username avatar')
            .populate('tags', 'name slug color type')
            .sort({ featuredOrder: 1, updatedAt: -1 })
            .limit(6)
            .lean(),
    ]);

    /* ---------- آمار کلی ---------- */
    const [totalProjects, totalUsers, totalTags, downloadsAgg] = await Promise.all([
        Project.countDocuments({ status: 'published', isPublic: true }),
        User.countDocuments({}),
        Tag.countDocuments({ isApproved: true }),
        Project.aggregate([
            { $match: { status: 'published', isPublic: true } },
            { $group: { _id: null, total: { $sum: '$downloads' } } },
        ]),
    ]);

    return {
        sections: {
            trending: { title: 'داغ‌ترین‌ها', subtitle: 'محبوب‌ترین پروژه‌های هفت روز اخیر', projects: trending },
            featured: { title: 'پروژه‌های ویژه', subtitle: 'انتخاب تیم ما', projects: featured },
            newProjects: { title: 'تازه‌ها', subtitle: 'آخرین پروژه‌های منتشرشده', projects: newProjects },
            topRated: { title: 'بهترین امتیازها', subtitle: 'بر اساس نظرات کاربران', projects: topRated },
            topDownloaded: { title: 'پرطرفدارترین دانلودها', subtitle: 'بیشترین بارگیری', projects: topDownloaded },
        },
        stats: {
            projects: totalProjects,
            users: totalUsers,
            tags: totalTags,
            downloads: downloadsAgg[0]?.total || 0,
        },
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