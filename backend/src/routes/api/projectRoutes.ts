import { Router } from "express";
import { requireAuth, optionalAuth } from "../../middleware/auth";
import { loadProject, requireProjectOwnership } from "../../middleware/ownership";
import { mwUploadImages, mwUploadVideo, mwUploadZip } from "../../middleware/upload";
import { apiGuard } from "../../middleware/apiGuard";
import { apiRateLimit } from "../../middleware/apiRateLimit";
import noCache from "../../middleware/noCache";
import commentRoutes from "./commentRoutes";
import reviewRoutes from "./reviewRoutes";
import * as ctrl from "../../controllers/projectController";

const router = Router();

/* ==========================================================================
 * Public Routes
 * ========================================================================== */

router.get(
    "/",
    optionalAuth,
    noCache,
    apiRateLimit("public"),
    apiGuard({
        path: "/api/v1/projects",
        method: "GET",
        visibility: "public",
        description: "List projects with search and pagination.",
        tags: ["projects"]
    }),
    ctrl.listProjects
);

router.get(
    "/explore",
    noCache,
    apiRateLimit("public"),
    apiGuard({
        path: "/api/v1/projects/explore",
        method: "GET",
        visibility: "public",
        description: "Explore projects using the Hot Score algorithm.",
        tags: ["projects"]
    }),
    ctrl.explore
);

router.get(
    "/home-feed",
    noCache,
    apiRateLimit("public"),
    apiGuard({
        path: "/api/v1/projects/home-feed",
        method: "GET",
        visibility: "public",
        description: "Home page feed sections and aggregate statistics.",
        tags: ["projects"]
    }),
    ctrl.homeFeeds
);

router.get(
    "/:idOrSlug",
    optionalAuth,
    noCache,
    apiRateLimit("public"),
    apiGuard({
        path: "/api/v1/projects/:idOrSlug",
        method: "GET",
        visibility: "public",
        description: "Retrieve a project by id or slug.",
        tags: ["projects"]
    }),
    ctrl.getProject
);

/* ==========================================================================
 * Nested Routes
 * ========================================================================== */

router.use("/:idOrSlug/reviews", reviewRoutes);
router.use("/:idOrSlug/comments", commentRoutes);

/* ==========================================================================
 * Project Management
 * ========================================================================== */

router.post(
    "/",
    requireAuth,
    noCache,
    apiRateLimit("authenticated", { windowMs: 60 * 60_000, max: 10 }),
    apiGuard({
        path: "/api/v1/projects",
        method: "POST",
        visibility: "authenticated",
        description: "Create a new project.",
        tags: ["projects"]
    }),
    ctrl.createProject
);

router.put(
    "/:id",
    requireAuth,
    requireProjectOwnership,
    noCache,
    apiRateLimit("authenticated"),
    apiGuard({
        path: "/api/v1/projects/:id",
        method: "PUT",
        visibility: "authenticated",
        description: "Update a project owned by the caller.",
        tags: ["projects"]
    }),
    ctrl.updateProject
);

router.delete(
    "/:id",
    requireAuth,
    requireProjectOwnership,
    noCache,
    apiRateLimit("authenticated"),
    apiGuard({
        path: "/api/v1/projects/:id",
        method: "DELETE",
        visibility: "authenticated",
        description: "Delete a project owned by the caller.",
        tags: ["projects"]
    }),
    ctrl.deleteProject
);

router.post(
    "/:id/sync-github",
    requireAuth,
    requireProjectOwnership,
    noCache,
    apiRateLimit("authenticated", { windowMs: 60 * 60_000, max: 10 }),
    apiGuard({
        path: "/api/v1/projects/:id/sync-github",
        method: "POST",
        visibility: "authenticated",
        description: "Synchronize project metadata with GitHub.",
        tags: ["projects", "github"]
    }),
    ctrl.syncGithub
);

router.patch(
    "/:id/status",
    requireAuth,
    requireProjectOwnership,
    noCache,
    apiRateLimit("authenticated"),
    apiGuard({
        path: "/api/v1/projects/:id/status",
        method: "PATCH",
        visibility: "authenticated",
        description: "Toggle the project's publication status.",
        tags: ["projects"]
    }),
    ctrl.toggleStatus
);

/* ==========================================================================
 * Media Uploads — Strict Rate Limits
 * ==========================================================================
 * Uploads are the most expensive endpoints in the application. A tight
 * limit prevents disk-exhaustion and bandwidth abuse. Each user gets
 * 30 uploads per hour across all projects.
 * ========================================================================== */

const UPLOAD_LIMIT = { windowMs: 60 * 60_000, max: 30 };

router.post(
    "/:id/images",
    requireAuth,
    requireProjectOwnership,
    noCache,
    apiRateLimit("authenticated", UPLOAD_LIMIT),
    apiGuard({
        path: "/api/v1/projects/:id/images",
        method: "POST",
        visibility: "authenticated",
        description: "Upload project images.",
        tags: ["projects", "upload"]
    }),
    mwUploadImages,
    ctrl.uploadProjectImages
);

router.delete(
    "/:id/images/:imageId",
    requireAuth,
    requireProjectOwnership,
    noCache,
    apiRateLimit("authenticated", UPLOAD_LIMIT),
    apiGuard({
        path: "/api/v1/projects/:id/images/:imageId",
        method: "DELETE",
        visibility: "authenticated",
        description: "Delete a project image.",
        tags: ["projects", "upload"]
    }),
    ctrl.deleteProjectImage
);

router.patch(
    "/:id/images/order",
    requireAuth,
    requireProjectOwnership,
    noCache,
    apiRateLimit("authenticated"),
    apiGuard({
        path: "/api/v1/projects/:id/images/order",
        method: "PATCH",
        visibility: "authenticated",
        description: "Reorder project images.",
        tags: ["projects"]
    }),
    ctrl.reorderImages
);

router.post(
    "/:id/video",
    requireAuth,
    requireProjectOwnership,
    noCache,
    apiRateLimit("authenticated", UPLOAD_LIMIT),
    apiGuard({
        path: "/api/v1/projects/:id/video",
        method: "POST",
        visibility: "authenticated",
        description: "Upload a demo video.",
        tags: ["projects", "upload"]
    }),
    mwUploadVideo,
    ctrl.uploadProjectVideo
);

router.delete(
    "/:id/video",
    requireAuth,
    requireProjectOwnership,
    noCache,
    apiRateLimit("authenticated", UPLOAD_LIMIT),
    apiGuard({
        path: "/api/v1/projects/:id/video",
        method: "DELETE",
        visibility: "authenticated",
        description: "Delete the demo video.",
        tags: ["projects", "upload"]
    }),
    ctrl.deleteProjectVideo
);

router.post(
    "/:id/file",
    requireAuth,
    requireProjectOwnership,
    noCache,
    apiRateLimit("authenticated", UPLOAD_LIMIT),
    apiGuard({
        path: "/api/v1/projects/:id/file",
        method: "POST",
        visibility: "authenticated",
        description: "Upload an archive.",
        tags: ["projects", "upload"]
    }),
    mwUploadZip,
    ctrl.uploadProjectZip
);

router.delete(
    "/:id/file",
    requireAuth,
    requireProjectOwnership,
    noCache,
    apiRateLimit("authenticated", UPLOAD_LIMIT),
    apiGuard({
        path: "/api/v1/projects/:id/file",
        method: "DELETE",
        visibility: "authenticated",
        description: "Delete the archive.",
        tags: ["projects", "upload"]
    }),
    ctrl.deleteProjectZip
);

/* ==========================================================================
 * Downloads
 * ==========================================================================
 * Downloads are unauthenticated but rate-limited to prevent abuse of
 * the download counter and bandwidth consumption.
 * ========================================================================== */

router.get(
    "/:idOrSlug/download",
    optionalAuth,
    noCache,
    apiRateLimit("public", { windowMs: 60_000, max: 20 }),
    apiGuard({
        path: "/api/v1/projects/:idOrSlug/download",
        method: "GET",
        visibility: "public",
        description: "Download the project archive.",
        tags: ["projects", "download"]
    }),
    loadProject,
    ctrl.downloadProject
);

export default router;

/**
 * Copyright (c) 2026 Sobhan Rasoulzadeh Asl (Sobhan-SRZA / Mr. Sinre)
 *
 * Licensed under the BSD 3-Clause License.
 * See the LICENSE file in the project root for license information.
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */