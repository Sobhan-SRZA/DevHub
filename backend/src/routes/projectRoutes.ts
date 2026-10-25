import {
    mwUploadImages,
    mwUploadVideo,
    mwUploadZip,
} from "../middleware/upload";
import {
    loadProject,
    requireProjectOwnership
} from "../middleware/ownership";
import {
    requireAuth,
    optionalAuth
} from "../middleware/auth";
import { Router } from "express";
import commentRoutes from "./commentRoutes";
import reviewRoutes from "./reviewRoutes";
import * as ctrl from "../controllers/projectController";


const router = Router();

/* ==================================================================
   Public
   ================================================================== */
router.get("/", optionalAuth, ctrl.listProjects);
router.get("/explore", ctrl.explore);
router.get("/home-feed", ctrl.homeFeeds);
router.get("/:idOrSlug", optionalAuth, ctrl.getProject);

/* ==================================================================
   Nested routes — reviews و comments
   ================================================================== */
router.use("/:idOrSlug/reviews", reviewRoutes);
router.use("/:idOrSlug/comments", commentRoutes);

/* ==================================================================
   Protected — CRUD پروژه
   ================================================================== */
router.post("/", requireAuth, ctrl.createProject);
router.put("/:id", requireAuth, requireProjectOwnership, ctrl.updateProject);
router.delete("/:id", requireAuth, requireProjectOwnership, ctrl.deleteProject);
router.post("/:id/sync-github", requireAuth, requireProjectOwnership, ctrl.syncGithub);
router.patch("/:id/status", requireAuth, requireProjectOwnership, ctrl.toggleStatus);

/* ==================================================================
   Uploads
   ================================================================== */
router.post(
    "/:id/images",
    requireAuth,
    requireProjectOwnership,
    mwUploadImages,
    ctrl.uploadProjectImages
);
router.delete(
    "/:id/images/:imageId",
    requireAuth,
    requireProjectOwnership,
    ctrl.deleteProjectImage
);
router.patch(
    "/:id/images/order",
    requireAuth,
    requireProjectOwnership,
    ctrl.reorderImages
);

router.post(
    "/:id/video",
    requireAuth,
    requireProjectOwnership,
    mwUploadVideo,
    ctrl.uploadProjectVideo
);
router.delete(
    "/:id/video",
    requireAuth,
    requireProjectOwnership,
    ctrl.deleteProjectVideo
);

router.post(
    "/:id/file",
    requireAuth,
    requireProjectOwnership,
    mwUploadZip,
    ctrl.uploadProjectZip
);
router.delete(
    "/:id/file",
    requireAuth,
    requireProjectOwnership,
    ctrl.deleteProjectZip
);

/* ==================================================================
   Download
   ================================================================== */
router.get("/:idOrSlug/download", optionalAuth, loadProject, ctrl.downloadProject);

export default router;

/**
 * Copyright (c) 2026 Sobhan Rasoulzadeh Asl (Sobhan-SRZA / Mr. Sinre)
 *
 * Licensed under the BSD 3-Clause License.
 * See the LICENSE file in the project root for license information.
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */