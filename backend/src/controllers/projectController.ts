import {
    createProjectSchema,
    updateProjectSchema,
    projectListQuerySchema,
    exploreQuerySchema,
} from "../validators/projectValidator";
import {
    toPublicUrl,
    deleteFile,
    deleteProjectFiles,
} from "../services/fileService";
import {
    parseGitHubUrl,
    fetchFullRepoData,
    shouldResync,
} from "../services/githubService";
import {
    exploreProjects,
    getHomeFeeds,
} from "../services/exploreService";
import {
    cacheGet,
    cacheSet,
} from "../services/cache";
import {
    AppError,
    Conflict,
} from "../utils/AppError";
import type {
    Request,
    Response,
} from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { ErrorCodes } from "../utils/errorCodes";
import { validate } from "../utils/validate";
import { Project } from "../models/Project";
import { Comment } from "../models/Comment";
import { Review } from "../models/Review";
import { Tag } from "../models/Tag";
import {
    assertNotSpam,
    checkSpam,
} from "../services/spamDetection";

/**
 * Normalize a project title into a URL-friendly slug.
 * Falls back to a timestamp-based identifier when the result is empty.
 */
function slugify(input: string): string {
    return (
        input
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9-]+/g, "-")
            .replace(/-+/g, "-")
            .replace(/^-|-$/g, "")
            .slice(0, 80) || `project-${Date.now().toString(36)}`
    );
}

/**
 * Synchronize repository metadata from GitHub and apply it to the project.
 *
 * Synchronization is skipped when no repository is linked, automatic
 * synchronization is disabled, or the configured synchronization interval
 * has not elapsed, unless synchronization is explicitly forced.
 *
 * Errors are propagated to the caller so each controller can determine
 * how synchronization failures should be handled.
 */
async function applyGithubSync(project: any, force = false) {
    if (!project.githubRepo) {
        return false;
    }

    if (!force && !project.autoSync) {
        return false;
    }

    if (!force && !shouldResync(project.githubSyncedAt)) {
        return false;
    }

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
        pushedAtGh: info.pushedAt,
    };

    project.githubSyncedAt = new Date();

    // Preserve manually configured download counts when they exceed
    // the number reported by GitHub.
    if (downloads > (project.downloads || 0)) {
        project.downloads = downloads;
    }

    return true;
}

/**
 * GET /api/projects
 * Retrieve a paginated list of projects.
 *
 * Public requests return published projects marked as public.
 * Authenticated requests with the "mine" filter can access the user's
 * own projects regardless of their publication status.
 */
export const listProjects = asyncHandler(async (req: any, res: Response) => {
    const q = validate(projectListQuerySchema, req.query);

    const filter: Record<string, unknown> = {};

    // Restrict personal project listings to authenticated users.
    if (q.mine) {
        if (!req.user) {
            throw new AppError(401, ErrorCodes.UNAUTHENTICATED);
        }

        filter.owner = req.user._id;
    } else {
        filter.status = "published";
        filter.isPublic = true;
    }

    if (q.status && q.mine) {
        filter.status = q.status;
    }

    if (q.tag) {
        filter.tags = q.tag;
    }

    if (q.search) {
        filter.$or = [
            { title: { $regex: q.search, $options: "i" } },
            { shortDescription: { $regex: q.search, $options: "i" } },
        ];
    }

    // Resolve tags belonging to the requested tag type.
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
        stars: { "githubData.stars": -1, updatedAt: -1 },
    };

    const sort = sortMap[q.sort] || sortMap.recent;
    const skip = (q.page - 1) * q.limit;

    const [projects, total] = await Promise.all([
        Project.find(filter)
            .populate("owner", "name username avatar")
            .populate("tags", "name slug color type")
            .sort(sort)
            .skip(skip)
            .limit(q.limit)
            .lean(),

        Project.countDocuments(filter),
    ]);

    res.json({
        ok: true,
        projects,
        pagination: {
            page: q.page,
            limit: q.limit,
            total,
            pages: Math.ceil(total / q.limit),
        },
    });
});

/**
 * GET /api/projects/:idOrSlug
 * Retrieve a project by its MongoDB ID or URL slug.
 *
 * Private projects and unpublished projects are accessible only
 * to their owners.
 */
export const getProject = asyncHandler(async (req: any, res: Response) => {
    const { idOrSlug } = req.params;

    const isObjectId = /^[a-f\d]{24}$/i.test(idOrSlug);
    const query = isObjectId
        ? { _id: idOrSlug }
        : { slug: idOrSlug };

    const project = await Project.findOne(query)
        .populate("owner", "name username avatar")
        .populate("tags", "name slug color type")
        .lean();

    if (!project) {
        throw new AppError(404, ErrorCodes.PROJECT_NOT_FOUND);
    }

    // Ensure private or unpublished projects are visible only to their owners.
    const isOwner =
        req.user &&
        String(project.owner?._id ?? project.owner) === String(req.user._id);

    if ((!project.isPublic || project.status !== "published") && !isOwner) {
        throw new AppError(403, ErrorCodes.PROJECT_NOT_OWNED);
    }

    // Increment view counts asynchronously without delaying the response.
    if (!isOwner) {
        Project.updateOne(
            { _id: project._id },
            { $inc: { views: 1 } }
        ).catch(() => { });
    }

    // Refresh GitHub metadata when automatic synchronization is due.
    if (
        project.githubRepo &&
        project.autoSync &&
        shouldResync(project.githubSyncedAt)
    ) {
        try {
            const document = await Project.findById(project._id);

            if (document && (await applyGithubSync(document))) {
                await document.save();
                Object.assign(project, document.toObject());
            }
        } catch (err) {
            // GitHub synchronization failures must not prevent project retrieval.
            console.warn(
                "[getProject] GitHub synchronization failed:",
                (err as Error)?.message
            );
        }
    }

    res.json({
        ok: true,
        project,
    });
});

/**
 * POST /api/projects
 * Create a project for the authenticated user.
 *
 * Requires a verified email address and validates project descriptions,
 * GitHub repository links, and associated tags before saving.
 */
export const createProject = asyncHandler(async (req: any, res: Response) => {
    // Require email verification before allowing project creation.
    if (!req.user?.emailVerified) {
        throw new AppError(
            403,
            ErrorCodes.EMAIL_NOT_VERIFIED,
            "Please verify your email address before creating a project."
        );
    }

    const data = validate(createProjectSchema, req.body);

    // Validate the short description to prevent spam and duplicate content.
    await assertNotSpam(data.shortDescription, {
        minLength: 10,
        maxLinks: 1,
        checkHashDuplicate: true,
        userId: String(req.user._id),
        field: "project.shortDescription",
    });

    // Validate the full description against spam and duplicate content.
    await assertNotSpam(data.fullDescription, {
        minLength: 20,
        maxLinks: 40,
        checkHashDuplicate: true,
        userId: String(req.user._id),
        field: "fullDescription",
    });

    const slug = data.slug || slugify(data.title);

    // Ensure the project slug is unique.
    const slugExists = await Project.findOne({ slug }).lean();

    if (slugExists) {
        throw Conflict(ErrorCodes.PROJECT_SLUG_TAKEN);
    }

    // Parse and validate the optional GitHub repository URL.
    let githubRepo: string | null = null;

    if (data.githubUrl) {
        const parsed = parseGitHubUrl(data.githubUrl);

        if (!parsed) {
            throw new AppError(400, ErrorCodes.GITHUB_URL_INVALID);
        }

        githubRepo = `${parsed.owner}/${parsed.repo}`;

        // Prevent the same GitHub repository from being linked more than once.
        const duplicateRepository = await Project.findOne({
            githubRepo,
        }).lean();

        if (duplicateRepository) {
            throw Conflict(ErrorCodes.GITHUB_ALREADY_LINKED);
        }
    }

    // Validate tag IDs after removing duplicates.
    if (data.tags && data.tags.length) {
        const uniqueIds = [...new Set(data.tags)];

        const foundTags = await Tag.find({
            _id: { $in: uniqueIds },
        })
            .select("_id")
            .lean();

        const foundIds = new Set(
            foundTags.map((tag) => String(tag._id))
        );

        const missingIds = uniqueIds.filter((id) => !foundIds.has(id));

        if (missingIds.length) {
            throw new AppError(
                400,
                ErrorCodes.TAG_NOT_FOUND,
                `${missingIds.length} tags could not be found. Please refresh the page and try again.`
            );
        }
    }

    // Create the project using validated input and default values.
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
        isPublic: data.isPublic ?? true,
    });

    // Attempt an initial GitHub synchronization without rolling back
    // project creation if the external API request fails.
    if (githubRepo) {
        try {
            if (await applyGithubSync(project, true)) {
                await project.save();
            }
        } catch (err) {
            console.warn(
                "[createProject] Initial GitHub synchronization failed:",
                (err as Error)?.message
            );
        }
    }

    // Update usage counters for the associated tags.
    if (project.tags.length) {
        await Tag.updateMany(
            { _id: { $in: project.tags } },
            { $inc: { usageCount: 1 } }
        );
    }

    const populated = await project.populate([
        { path: "owner", select: "name username" },
        { path: "tags", select: "name slug color type" },
    ]);

    // Generate non-blocking warnings for potentially problematic descriptions.
    const descriptionCheck = data.fullDescription
        ? await checkSpam(data.fullDescription, {
            minLength: 20,
            maxLinks: 10,
        })
        : null;

    res.status(201).json({
        ok: true,
        project: populated,
        ...(descriptionCheck?.warnings.length
            ? { warnings: descriptionCheck.warnings }
            : {}),
    });
});

/**
 * PATCH /api/projects/:id
 * Update an existing project.
 *
 * The project ownership and authorization checks are handled by middleware,
 * which provides the authorized project through req.project.
 */
export const updateProject = asyncHandler(async (req: any, res: Response) => {
    const project = req.project;
    const data = validate(updateProjectSchema, req.body);

    // Validate a manually supplied slug or generate one when the title changes.
    if (data.slug && data.slug !== project.slug) {
        const duplicateSlug = await Project.findOne({
            slug: data.slug,
        }).lean();

        if (duplicateSlug) {
            throw Conflict(ErrorCodes.PROJECT_SLUG_TAKEN);
        }
    } else if (data.title && !data.slug) {
        const newSlug = slugify(data.title);

        if (newSlug !== project.slug) {
            const duplicateSlug = await Project.findOne({
                slug: newSlug,
            }).lean();

            if (duplicateSlug) {
                throw Conflict(ErrorCodes.PROJECT_SLUG_TAKEN);
            }

            data.slug = newSlug;
        }
    }

    // Revalidate the short description when it is updated.
    if (data.shortDescription !== undefined) {
        await assertNotSpam(data.shortDescription, {
            minLength: 10,
            maxLinks: 1,
            userId: String(req.user._id),
            allowTables: true,
            field: "project.shortDescription",
        });
    }

    // Revalidate the full description when it is updated.
    if (data.fullDescription !== undefined) {
        await assertNotSpam(data.fullDescription, {
            minLength: 20,
            maxLinks: 40,
            userId: String(req.user._id),
            allowTables: true,
            field: "project.fullDescription",
        });
    }

    // Validate and apply changes to the linked GitHub repository.
    let githubChanged = false;

    if (
        data.githubUrl !== undefined &&
        data.githubUrl !== project.githubUrl
    ) {
        if (data.githubUrl) {
            const parsed = parseGitHubUrl(data.githubUrl);

            if (!parsed) {
                throw new AppError(400, ErrorCodes.GITHUB_URL_INVALID);
            }

            const newRepo = `${parsed.owner}/${parsed.repo}`;

            const duplicateRepository = await Project.findOne({
                githubRepo: newRepo,
                _id: { $ne: project._id },
            }).lean();

            if (duplicateRepository) {
                throw Conflict(ErrorCodes.GITHUB_ALREADY_LINKED);
            }

            project.githubRepo = newRepo;
        } else {
            // Clear repository metadata when the GitHub link is removed.
            project.githubRepo = null;
            project.githubData = {};
            project.githubSyncedAt = null;
        }

        githubChanged = true;
    }

    // Validate the updated tag list after removing duplicate IDs.
    if (data.tags) {
        const uniqueIds = [...new Set(data.tags)];

        const foundTags = await Tag.find({
            _id: { $in: uniqueIds },
        })
            .select("_id")
            .lean();

        const foundIds = new Set(
            foundTags.map((tag) => String(tag._id))
        );

        const missingIds = uniqueIds.filter((id) => !foundIds.has(id));

        if (missingIds.length) {
            throw new AppError(
                400,
                ErrorCodes.TAG_NOT_FOUND,
                `${missingIds.length} tags could not be found. Please refresh the page and try again.`
            );
        }
    }

    // Calculate tag usage changes before applying the update.
    const previousTags = new Set(
        (project.tags || []).map(String)
    );

    const updatedTags = new Set(
        (data.tags ?? project.tags).map(String)
    );

    const addedTags = [...updatedTags].filter(
        (tagId) => !previousTags.has(tagId)
    );

    const removedTags = [...previousTags].filter(
        (tagId) => !updatedTags.has(tagId)
    );

    // Apply the validated project updates.
    Object.assign(project, data);

    // Refresh GitHub metadata immediately when the repository link changes.
    if (githubChanged && project.githubRepo) {
        try {
            await applyGithubSync(project, true);
        } catch (err) {
            console.warn(
                "[updateProject] GitHub synchronization failed:",
                (err as Error)?.message
            );
        }
    }

    await project.save();

    // Update tag usage counters to reflect the changes.
    if (addedTags.length) {
        await Tag.updateMany(
            { _id: { $in: addedTags } },
            { $inc: { usageCount: 1 } }
        );
    }

    if (removedTags.length) {
        await Tag.updateMany(
            { _id: { $in: removedTags } },
            { $inc: { usageCount: -1 } }
        );
    }

    const populated = await project.populate([
        { path: "owner", select: "name username" },
        { path: "tags", select: "name slug color type" },
    ]);

    // Generate non-blocking warnings for potentially problematic descriptions.
    const descriptionCheck = data.fullDescription
        ? await checkSpam(data.fullDescription, {
            minLength: 20,
            maxLinks: 10,
        })
        : null;

    res.json({
        ok: true,
        project: populated,
        ...(descriptionCheck?.warnings.length
            ? { warnings: descriptionCheck.warnings }
            : {}),
    });
});

/**
 * POST /api/projects/:id/sync-github
 * Manually synchronize the project's GitHub metadata.
 */
export const syncGithub = asyncHandler(async (req: any, res: Response) => {
    const project = req.project;

    if (!project.githubRepo) {
        throw new AppError(
            400,
            ErrorCodes.GITHUB_URL_INVALID,
            "This project is not linked to a GitHub repository."
        );
    }

    const changed = await applyGithubSync(project, true);

    if (!changed) {
        throw new AppError(
            500,
            ErrorCodes.GITHUB_API_ERROR,
            "GitHub synchronization could not be completed."
        );
    }

    await project.save();

    res.json({
        ok: true,
        message: "GitHub repository information has been updated successfully.",
        githubData: project.githubData,
        syncedAt: project.githubSyncedAt,
    });
});

/**
 * PATCH /api/projects/:id/status
 * Update the project's publication status.
 */
export const toggleStatus = asyncHandler(async (req: any, res: Response) => {
    const project = req.project;

    const { status } = req.body as {
        status?: "draft" | "published" | "archived";
    };

    if (!status || !["draft", "published", "archived"].includes(status)) {
        throw new AppError(
            400,
            ErrorCodes.VALIDATION_ERROR,
            "Invalid project status."
        );
    }

    project.status = status;

    await project.save();

    res.json({
        ok: true,
        status: project.status,
    });
});

/**
 * POST /api/projects/:id/images
 * Upload multiple project images, up to the configured limit of ten.
 *
 * If the upload would exceed the limit, remove the newly uploaded files
 * before returning an error.
 */
export const uploadProjectImages = asyncHandler(
    async (req: any, res: Response) => {
        const project = req.project;
        const files = (req.files as Express.Multer.File[]) || [];

        if (!files.length) {
            throw new AppError(400, ErrorCodes.NO_FILE_PROVIDED);
        }

        const currentCount = project.images?.length || 0;

        if (currentCount + files.length > 10) {
            // Clean up uploaded files when the image limit is exceeded.
            await Promise.all(
                files.map((file) => deleteFile(toPublicUrl(file.path)))
            );

            throw new AppError(
                400,
                ErrorCodes.MEDIA_LIMIT_REACHED,
                "A project can contain a maximum of 10 images."
            );
        }

        const newImages = files.map((file, index) => ({
            url: toPublicUrl(file.path),
            filename: file.originalname,
            mimeType: file.mimetype,
            size: file.size,
            order: currentCount + index,
            uploadedAt: new Date(),
        }));

        project.images.push(...newImages);

        await project.save();

        res.json({
            ok: true,
            images: project.images,
        });
    }
);

/**
 * DELETE /api/projects/:id/images/:imageId
 * Delete a project image and remove its metadata from the project.
 */
export const deleteProjectImage = asyncHandler(
    async (req: any, res: Response) => {
        const project = req.project;
        const { imageId } = req.params;

        const image = project.images.id(imageId);

        if (!image) {
            throw new AppError(
                404,
                ErrorCodes.FILE_UPLOAD_FAILED,
                "The requested image could not be found."
            );
        }

        await deleteFile(image.url);

        image.deleteOne();

        await project.save();

        res.json({
            ok: true,
            message: "Project image deleted successfully.",
        });
    }
);

/**
 * PATCH /api/projects/:id/images/order
 * Update the display order of project images.
 */
export const reorderImages = asyncHandler(async (req: any, res: Response) => {
    const project = req.project;
    const { order } = req.body as { order?: string[] };

    if (!Array.isArray(order)) {
        throw new AppError(
            400,
            ErrorCodes.VALIDATION_ERROR,
            "The order field must be an array of image IDs."
        );
    }

    order.forEach((imageId, index) => {
        const image = project.images.id(imageId);

        if (image) {
            image.order = index;
        }
    });

    await project.save();

    res.json({
        ok: true,
        images: project.images,
    });
});

/**
 * POST /api/projects/:id/video
 * Upload a project demonstration video, replacing any existing video.
 */
export const uploadProjectVideo = asyncHandler(
    async (req: any, res: Response) => {
        const project = req.project;
        const file = req.file as Express.Multer.File | undefined;

        if (!file) {
            throw new AppError(400, ErrorCodes.NO_FILE_PROVIDED);
        }

        // Remove the existing video before assigning the replacement.
        if (project.demoVideo?.url) {
            await deleteFile(project.demoVideo.url);
        }

        project.demoVideo = {
            url: toPublicUrl(file.path),
            filename: file.originalname,
            mimeType: file.mimetype,
            size: file.size,
            uploadedAt: new Date(),
        };

        await project.save();

        res.json({
            ok: true,
            video: project.demoVideo,
        });
    }
);

/**
 * DELETE /api/projects/:id/video
 * Delete the project's demonstration video.
 */
export const deleteProjectVideo = asyncHandler(
    async (req: any, res: Response) => {
        const project = req.project;

        if (!project.demoVideo) {
            throw new AppError(
                404,
                ErrorCodes.FILE_UPLOAD_FAILED,
                "No demonstration video is available for this project."
            );
        }

        await deleteFile(project.demoVideo.url);

        project.demoVideo = null;

        await project.save();

        res.json({
            ok: true,
            message: "Project demonstration video deleted successfully.",
        });
    }
);

/**
 * POST /api/projects/:id/download-file
 * Upload a project ZIP archive, replacing any existing download file.
 */
export const uploadProjectZip = asyncHandler(
    async (req: any, res: Response) => {
        const project = req.project;
        const file = req.file as Express.Multer.File | undefined;
        const version = (req.body?.version as string) || undefined;

        if (!file) {
            throw new AppError(400, ErrorCodes.NO_FILE_PROVIDED);
        }

        // Remove the previously uploaded archive before storing the replacement.
        if (project.downloadFile?.url) {
            await deleteFile(project.downloadFile.url);
        }

        project.downloadFile = {
            url: toPublicUrl(file.path),
            filename: file.originalname,
            mimeType: file.mimetype,
            size: file.size,
            version,
            downloads: 0,
            uploadedAt: new Date(),
        };

        await project.save();

        res.json({
            ok: true,
            file: project.downloadFile,
        });
    }
);

/**
 * DELETE /api/projects/:id/download-file
 * Remove the project's downloadable archive.
 */
export const deleteProjectZip = asyncHandler(
    async (req: any, res: Response) => {
        const project = req.project;

        if (!project.downloadFile) {
            throw new AppError(
                404,
                ErrorCodes.FILE_UPLOAD_FAILED,
                "No downloadable file is available for this project."
            );
        }

        await deleteFile(project.downloadFile.url);

        project.downloadFile = null;

        await project.save();

        res.json({
            ok: true,
            message: "Project download file deleted successfully.",
        });
    }
);

/**
 * GET /api/projects/:id/download
 * Increment project and file download counters, then redirect to the file.
 */
export const downloadProject = asyncHandler(async (req: any, res: Response) => {
    const project = req.project;

    if (!project.downloadFile?.url) {
        throw new AppError(
            404,
            ErrorCodes.FILE_UPLOAD_FAILED,
            "No downloadable file is available for this project."
        );
    }

    // Increment the project-level and file-level download counters.
    project.downloads = (project.downloads || 0) + 1;

    project.downloadFile.downloads =
        (project.downloadFile.downloads || 0) + 1;

    await project.save();

    // Preserve the original filename in the download response header.
    const safeName = encodeURIComponent(project.downloadFile.filename);

    res.setHeader(
        "Content-Disposition",
        `attachment; filename*=UTF-8''${safeName}`
    );

    // Redirect the client to the hosted download file.
    return res.redirect(project.downloadFile.url);
});

/**
 * DELETE /api/projects/:id
 * Delete a project and clean up its associated files, reviews, comments,
 * and tag usage counters.
 */
export const deleteProject = asyncHandler(async (req: any, res: Response) => {
    const project = req.project;

    // Decrement usage counters for all tags associated with the project.
    if (project.tags?.length) {
        await Tag.updateMany(
            { _id: { $in: project.tags } },
            { $inc: { usageCount: -1 } }
        );
    }

    // Remove all files associated with the project from storage.
    await deleteProjectFiles(String(project._id));

    // Delete dependent reviews and comments.
    await Promise.all([
        Review.deleteMany({ project: project._id }),
        Comment.deleteMany({ project: project._id }),
    ]);

    await project.deleteOne();

    res.json({
        ok: true,
        message: "Project deleted successfully.",
    });
});

/**
 * GET /api/projects/explore
 * Retrieve a filtered, paginated list of projects for the Explore page.
 *
 * Cache the result for five minutes to reduce repeated database queries.
 */
export const explore = asyncHandler(async (req: Request, res: Response) => {
    const q = validate(exploreQuerySchema, req.query);

    // Generate a cache key from the validated query parameters.
    const cacheKey = `explore:${JSON.stringify(q)}`;
    const cached = cacheGet<any>(cacheKey);

    if (cached) {
        return res.json({
            ok: true,
            ...cached,
            cached: true,
        });
    }

    const result = await exploreProjects({
        sort: q.sort,
        window: q.window,
        tag: q.tag,
        tagType: q.tagType,
        search: q.search,
        page: q.page,
        limit: q.limit,
    });

    cacheSet(cacheKey, result, 300);

    res.json({
        ok: true,
        ...result,
    });
});

/**
 * GET /api/projects/home
 * Retrieve the data required to populate the home page.
 *
 * Cache the response for five minutes to reduce repeated queries.
 */
export const homeFeeds = asyncHandler(
    async (_req: Request, res: Response) => {
        const cacheKey = "home:feeds";
        const cached = cacheGet<any>(cacheKey);

        if (cached) {
            return res.json({
                ok: true,
                ...cached,
                cached: true,
            });
        }

        const data = await getHomeFeeds({ limit: 8 });

        cacheSet(cacheKey, data, 300);

        res.json({
            ok: true,
            ...data,
        });
    }
);

/**
 * Copyright (c) 2026 Sobhan Rasoulzadeh Asl (Sobhan-SRZA / Mr. Sinre)
 *
 * Licensed under the BSD 3-Clause License.
 * See the LICENSE file in the project root for license information.
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */