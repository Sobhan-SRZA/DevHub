import {
    requireAuth,
    optionalAuth
} from "../middleware/auth";
import { requireProjectOwnership } from "../middleware/ownership";
import { Router } from "express";
import * as ctrl from "../controllers/projectController";

const router = Router();

// عمومی
router.get("/", optionalAuth, ctrl.listProjects);
router.get("/:idOrSlug", optionalAuth, ctrl.getProject);

// نیاز به auth
router.post("/", requireAuth, ctrl.createProject);
router.put("/:id", requireAuth, requireProjectOwnership, ctrl.updateProject);
router.delete("/:id", requireAuth, requireProjectOwnership, ctrl.deleteProject);
router.post("/:id/sync-github", requireAuth, requireProjectOwnership, ctrl.syncGithub);
router.patch("/:id/status", requireAuth, requireProjectOwnership, ctrl.toggleStatus);

export default router;

/**
 * Copyright (c) 2026 Sobhan Rasoulzadeh Asl (Sobhan-SRZA / Mr. Sinre)
 *
 * Licensed under the BSD 3-Clause License.
 * See the LICENSE file in the project root for license information.
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */