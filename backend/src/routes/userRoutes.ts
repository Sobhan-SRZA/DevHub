import { Router } from "express";
import { optionalAuth } from "../middleware/auth";
import noCache from "../middleware/noCache";
import * as ctrl from "../controllers/userController";

const router = Router();

/* ==========================================================================
 * Public User Routes
 * ==========================================================================
 * All routes are public. `optionalAuth` populates `req.user` when a valid
 * session is present, allowing controllers to personalize responses
 * (for example, to hide private-profile data from non-owners).
 * ========================================================================== */

/*
 * List users with search, sort, and pagination.
 *
 * Query parameters:
 *   - q:      free-text search across name and username
 *   - sort:   recent | name | projects
 *   - page:   1-based page index (default 1)
 *   - limit:  page size, capped by the controller (default 24)
 */
router.get("/", optionalAuth, noCache, ctrl.listUsers);

/*
 * Retrieve a single user's public profile.
 *
 * Accepts either a user id or a username in `:idOrUsername`.
 */
router.get("/:idOrUsername", optionalAuth, noCache, ctrl.getPublicProfile);

/*
 * Retrieve a paginated list of projects created by a specific user.
 * Respects privacy: draft and non-public projects are only returned
 * to the owner or to administrators.
 */
router.get(
    "/:idOrUsername/projects",
    optionalAuth,
    noCache,
    ctrl.getUserProjects
);

/*
 * Retrieve reviews submitted by a specific user.
 */
router.get(
    "/:idOrUsername/reviews",
    optionalAuth,
    noCache,
    ctrl.getUserReviews
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