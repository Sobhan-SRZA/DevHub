import {
    createProjectSchema,
    updateProjectSchema,
    projectListQuerySchema,
} from "../validators/projectValidator";
import {
    parseGitHubUrl,
    fetchFullRepoData,
    shouldResync,
} from "../services/githubService";
import {
    AppError,
    Conflict
} from "../utils/AppError";
import type { Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { ErrorCodes } from "../utils/errorCodes";
import { validate } from "../utils/validate";
import { Project } from "../models/Project";
import { Tag } from "../models/Tag";

/* ==================================================================
   Helpers
   ================================================================== */
function slugify(input: string): string {
    return input
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9-]+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 80) || `project-${Date.now().toString(36)}`;
}

/**
 * سینک داده‌های GitHub رو روی پروژه اعمال می‌کنه.
 * خطا رو می‌ندازه بیرون — کنترلر تصمیم می‌گیره چیکار کنه.
 */
async function applyGithubSync(project: any, force = false) {
    if (!project.githubRepo)
        return false;

    if (!force && !project.autoSync)
        return false;

    if (!force && !shouldResync(project.githubSyncedAt))
        return false;

    const [owner, repo] = project.githubRepo.split("/");
    const { info, downloads } = await fetchFullRepoData(owner, repo);

    project.githubData = {
        fullName: info.fullName,
        description: info.description,
        homepage: info.homepage,
        language: info.language,
        stars: info.stars,
        watchers: info.watchers,
        forks: info.forks,
        openIssues: info.openIssues,
        downloads,
        size: info.size,
        license: info.license,
        topics: info.topics,
        defaultBranch: info.defaultBranch,
        isArchived: info.isArchived,
        isFork: info.isFork,
        createdAtGh: info.createdAt,
        updatedAtGh: info.updatedAt,
        pushedAtGh: info.pushedAt
    };
    project.githubSyncedAt = new Date();

    // آپدیت downloads اگه بیشتر از مقدار دستی کاربره
    if (downloads > (project.downloads || 0)) {
        project.downloads = downloads;
    }

    return true;
}

/* ==================================================================
   LIST — عمومی (فقط published و isPublic)
   ================================================================== */
export const listProjects = asyncHandler(async (req: any, res: Response) => {
    const q = validate(projectListQuerySchema, req.query);

    const filter: Record<string, unknown> = {};

    // اگه "mine" باشه، نیاز به auth داریم و همه statuses رو می‌بینیم
    if (q.mine) {
        if (!req.user)
            throw new AppError(401, ErrorCodes.UNAUTHENTICATED);

        filter.owner = req.user._id;
    }

    else {
        filter.status = "published";
        filter.isPublic = true;
    }

    if (q.status && q.mine)
        filter.status = q.status;

    if (q.tag)
        filter.tags = q.tag;

    if (q.search) {
        filter.$or = [
            { title: { $regex: q.search, $options: "i" } },
            { shortDescription: { $regex: q.search, $options: "i" } },
        ];
    }

    // فیلتر بر اساس tagType: اول تگ‌های اون نوع رو پیدا کن
    if (q.tagType) {
        const tagIds = await Tag.find({ type: q.tagType }).distinct("_id");
        filter.tags = filter.tags
            ? { $in: [filter.tags, ...tagIds] }
            : { $in: tagIds };
    }

    const sortMap: Record<string, Record<string, 1 | -1>> = {
        recent: { updatedAt: -1 },
        rating: { rating: -1, updatedAt: -1 },
        downloads: { downloads: -1, updatedAt: -1 },
        stars: { "githubData.stars": -1, updatedAt: -1 }
    };
    const sort = sortMap[q.sort] || sortMap.recent;

    const skip = (q.page - 1) * q.limit;

    const [projects, total] = await Promise.all([
        Project.find(filter)
            .populate("owner", "name username")
            .populate("tags", "name slug color type")
            .sort(sort)
            .skip(skip)
            .limit(q.limit)
            .lean(),
        Project.countDocuments(filter)
    ]);

    res.json({
        ok: true,
        projects,
        pagination: {
            page: q.page,
            limit: q.limit,
            total,
            pages: Math.ceil(total / q.limit)
        }
    });
});

/* ==================================================================
   GET ONE — با slug یا id
   ================================================================== */
export const getProject = asyncHandler(async (req: any, res: Response) => {
    const { idOrSlug } = req.params;

    const isObjectId = /^[a-f\d]{24}$/i.test(idOrSlug);
    const query = isObjectId ? { _id: idOrSlug } : { slug: idOrSlug };

    const project = await Project.findOne(query)
        .populate("owner", "name username")
        .populate("tags", "name slug color type")
        .lean();

    if (!project)
        throw new AppError(404, ErrorCodes.PROJECT_NOT_FOUND);

    // اگه private/draft هست، فقط owner می‌تونه ببینه
    const isOwner = req.user && String(project.owner?._id ?? project.owner) === String(req.user._id);
    if ((!project.isPublic || project.status !== "published") && !isOwner) {
        throw new AppError(403, ErrorCodes.PROJECT_NOT_OWNED);
    }

    // افزایش view (fire and forget)
    if (!isOwner) {
        Project.updateOne({ _id: project._id }, { $inc: { views: 1 } }).catch(() => { });
    }

    // سینک خودکار با GitHub اگه لازمه (فقط وقتی autoSync فعاله)
    if (project.githubRepo && project.autoSync && shouldResync(project.githubSyncedAt)) {
        try {
            const doc = await Project.findById(project._id);
            if (doc && (await applyGithubSync(doc))) {
                await doc.save();
                Object.assign(project, doc.toObject());
            }
        }

        catch (err) {
            // خطای GitHub رو ignore کن، ولی لاگ بذار
            console.warn("[getProject] github sync failed:", (err as Error)?.message);
        }
    }

    res.json({ ok: true, project });
});

/* ==================================================================
   CREATE
   ================================================================== */
export const createProject = asyncHandler(async (req: any, res: Response) => {
    const data = validate(createProjectSchema, req.body);

    const slug = data.slug || slugify(data.title);

    // چک slug یکتا
    const slugExists = await Project.findOne({ slug }).lean();
    if (slugExists)
        throw Conflict(ErrorCodes.PROJECT_SLUG_TAKEN);

    /* -------- پردازش GitHub -------- */
    let githubRepo: string | null = null;
    if (data.githubUrl) {
        const parsed = parseGitHubUrl(data.githubUrl);
        if (!parsed)
            throw new AppError(400, ErrorCodes.GITHUB_URL_INVALID);

        githubRepo = `${parsed.owner}/${parsed.repo}`;

        // چک نباشه قبلاً لینک شده
        const dup = await Project.findOne({ githubRepo }).lean();
        if (dup)
            throw Conflict(ErrorCodes.GITHUB_ALREADY_LINKED);
    }

    /* -------- چک وجود تگ‌ها -------- */
    if (data.tags && data.tags.length) {
        const found = await Tag.countDocuments({ _id: { $in: data.tags } });
        if (found !== data.tags.length) {
            throw new AppError(400, ErrorCodes.TAG_NOT_FOUND);
        }
    }

    /* -------- ساخت پروژه -------- */
    const project = await Project.create({
        owner: req.user._id,
        title: data.title,
        slug,
        githubUrl: data.githubUrl || null,
        githubRepo,
        autoSync: data.autoSync ?? true,
        shortDescription: data.shortDescription,
        fullDescription: data.fullDescription,
        rating: data.rating ?? 0,
        satisfaction: data.satisfaction ?? 0,
        downloads: data.downloads ?? 0,
        tags: data.tags ?? [],
        status: data.status ?? "draft",
        isPublic: data.isPublic ?? true
    });

    /* -------- سینک اولیه GitHub (اختیاری) -------- */
    if (githubRepo) {
        try {
            if (await applyGithubSync(project, true)) {
                await project.save();
            }
        }

        catch (err) {
            // خطای GitHub رو نگه دار، ولی پروژه ساخته شده
            console.warn("[createProject] initial sync failed:", (err as Error)?.message);
        }
    }

    /* -------- آپدیت usageCount تگ‌ها -------- */
    if (project.tags.length) {
        await Tag.updateMany(
            { _id: { $in: project.tags } },
            { $inc: { usageCount: 1 } }
        );
    }

    const populated = await project.populate([
        { path: "owner", select: "name username" },
        { path: "tags", select: "name slug color type" }
    ]);

    res.status(201).json({ ok: true, project: populated });
});

/* ==================================================================
   UPDATE — req.project از middleware میاد
   ================================================================== */
export const updateProject = asyncHandler(async (req: any, res: Response) => {
    const project = req.project;
    const data = validate(updateProjectSchema, req.body);

    /* -------- slug جدید؟ -------- */
    if (data.slug && data.slug !== project.slug) {
        const dup = await Project.findOne({ slug: data.slug }).lean();
        if (dup)
            throw Conflict(ErrorCodes.PROJECT_SLUG_TAKEN);
    }

    else if (data.title && !data.slug) {
        const newSlug = slugify(data.title);
        if (newSlug !== project.slug) {
            const dup = await Project.findOne({ slug: newSlug }).lean();
            if (dup)
                throw Conflict(ErrorCodes.PROJECT_SLUG_TAKEN);

            data.slug = newSlug;
        }
    }

    /* -------- GitHub URL جدید؟ -------- */
    let githubChanged = false;
    if (data.githubUrl !== undefined && data.githubUrl !== project.githubUrl) {
        if (data.githubUrl) {
            const parsed = parseGitHubUrl(data.githubUrl);
            if (!parsed)
                throw new AppError(400, ErrorCodes.GITHUB_URL_INVALID);

            const newRepo = `${parsed.owner}/${parsed.repo}`;

            const dup = await Project.findOne({
                githubRepo: newRepo,
                _id: { $ne: project._id },
            }).lean();
            if (dup)
                throw Conflict(ErrorCodes.GITHUB_ALREADY_LINKED);

            project.githubRepo = newRepo;
        }

        else {
            project.githubRepo = null;
            project.githubData = {};
            project.githubSyncedAt = null;
        }

        githubChanged = true;
    }

    /* -------- چک تگ‌ها -------- */
    if (data.tags) {
        const found = await Tag.countDocuments({ _id: { $in: data.tags } });
        if (found !== data.tags.length) {
            throw new AppError(400, ErrorCodes.TAG_NOT_FOUND);
        }
    }

    /* -------- محاسبه diff تگ‌ها برای usageCount -------- */
    const oldTags = new Set((project.tags || []).map(String));
    const newTags = new Set((data.tags ?? project.tags).map(String));

    const addedTags = [...newTags].filter((t) => !oldTags.has(t));
    const removedTags = [...oldTags].filter((t) => !newTags.has(t));

    /* -------- اعمال تغییرات -------- */
    Object.assign(project, data);

    /* -------- سینک مجدد GitHub اگه URL عوض شد -------- */
    if (githubChanged && project.githubRepo) {
        try {
            if (await applyGithubSync(project, true)) {
                // ذخیره خودکار پایین انجام می‌شه
            }
        }

        catch (err) {
            console.warn("[updateProject] sync failed:", (err as Error)?.message);
        }
    }

    await project.save();

    /* -------- آپدیت usageCount -------- */
    if (addedTags.length) {
        await Tag.updateMany({ _id: { $in: addedTags } }, { $inc: { usageCount: 1 } });
    }

    if (removedTags.length) {
        await Tag.updateMany({ _id: { $in: removedTags } }, { $inc: { usageCount: -1 } });
    }

    const populated = await project.populate([
        { path: "owner", select: "name username" },
        { path: "tags", select: "name slug color type" }
    ]);

    res.json({ ok: true, project: populated });
});

/* ==================================================================
   DELETE — req.project از middleware
   ================================================================== */
export const deleteProject = asyncHandler(async (req: any, res: Response) => {
    const project = req.project;

    // کاهش usageCount تگ‌ها
    if (project.tags?.length) {
        await Tag.updateMany(
            { _id: { $in: project.tags } },
            { $inc: { usageCount: -1 } }
        );
    }

    await project.deleteOne();
    res.json({ ok: true, message: "پروژه حذف شد" });
});

/* ==================================================================
   SYNC GITHUB — آپدیت دستی
   ================================================================== */
export const syncGithub = asyncHandler(async (req: any, res: Response) => {
    const project = req.project;

    if (!project.githubRepo) {
        throw new AppError(400, ErrorCodes.GITHUB_URL_INVALID, "این پروژه به GitHub لینک نشده است");
    }

    const changed = await applyGithubSync(project, true);
    if (!changed) {
        throw new AppError(500, ErrorCodes.GITHUB_API_ERROR, "سینک انجام نشد");
    }

    await project.save();

    res.json({
        ok: true,
        message: "اطلاعات از GitHub آپدیت شد",
        githubData: project.githubData,
        syncedAt: project.githubSyncedAt
    });
});

/* ==================================================================
   TOGGLE STATUS
   ================================================================== */
export const toggleStatus = asyncHandler(async (req: any, res: Response) => {
    const project = req.project;
    const { status } = req.body as { status?: "draft" | "published" | "archived" };

    if (!status || !["draft", "published", "archived"].includes(status)) {
        throw new AppError(400, ErrorCodes.VALIDATION_ERROR, "وضعیت نامعتبر است");
    }

    project.status = status;
    await project.save();

    res.json({ ok: true, status: project.status });
});

/**
 * Copyright (c) 2026 Sobhan Rasoulzadeh Asl (Sobhan-SRZA / Mr. Sinre)
 *
 * Licensed under the BSD 3-Clause License.
 * See the LICENSE file in the project root for license information.
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */