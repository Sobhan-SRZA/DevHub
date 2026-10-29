
import { optionalAuth } from "../middleware/auth";
import { Router } from "express";
import * as ctrl from "../controllers/userController";

const router = Router();

/* ==========================================================================
 * Public User Profile Routes
 * ========================================================================== */

// Retrieve a user's public profile
router.get("/:idOrUsername", optionalAuth, ctrl.getPublicProfile);

// Retrieve projects created by a specific user
router.get("/:idOrUsername/projects", ctrl.getUserProjects);

// Retrieve reviews submitted by a specific user
router.get("/:idOrUsername/reviews", ctrl.getUserReviews);

export default router;

/**
 * Copyright (c) 2026 Sobhan Rasoulzadeh Asl (Sobhan-SRZA / Mr. Sinre)
 *
 * Licensed under the BSD 3-Clause License.
 * See the LICENSE file in the project root for license information.
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */