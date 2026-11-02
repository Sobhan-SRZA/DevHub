import { Router } from "express";
import { optionalAuth, requireAuth } from "../../middleware/auth";
import { apiGuard } from "../../middleware/apiGuard";
import { apiRateLimit } from "../../middleware/apiRateLimit";
import noCache from "../../middleware/noCache";
import * as ctrl from "../../controllers/userController";

const router = Router();

/* ==========================================================================
 * Authenticated — My Stats
 * ==========================================================================
 * Placed FIRST so it is not shadowed by `/:idOrUsername`. Restricted
 * to the authenticated user; no parameterised access is provided to
 * avoid users probing each other's analytics.
 * ========================================================================== */

router.get(
    "/me/stats",
    requireAuth,
    noCache,
    apiRateLimit("authenticated", { windowMs: 60_000, max: 20 }),
    apiGuard({
        path: "/api/v1/users/me/stats",
        method: "GET",
        visibility: "authenticated",
        description: "Aggregated analytics for the current user.",
        tags: ["users", "stats"]
    }),
    ctrl.getMyStats
);

/* ==========================================================================
 * Public Routes
 * ========================================================================== */

router.get(
    "/",
    optionalAuth,
    noCache,
    apiRateLimit("public"),
    apiGuard({
        path: "/api/v1/users",
        method: "GET",
        visibility: "public",
        description: "List users with search and pagination.",
        tags: ["users"]
    }),
    ctrl.listUsers
);

router.get(
    "/:idOrUsername/projects",
    optionalAuth,
    noCache,
    apiRateLimit("public"),
    apiGuard({
        path: "/api/v1/users/:idOrUsername/projects",
        method: "GET",
        visibility: "public",
        description: "List projects created by a user.",
        tags: ["users", "projects"]
    }),
    ctrl.getUserProjects
);

router.get(
    "/:idOrUsername/reviews",
    optionalAuth,
    noCache,
    apiRateLimit("public"),
    apiGuard({
        path: "/api/v1/users/:idOrUsername/reviews",
        method: "GET",
        visibility: "public",
        description: "List reviews submitted by a user.",
        tags: ["users", "reviews"]
    }),
    ctrl.getUserReviews
);

router.get(
    "/:idOrUsername",
    optionalAuth,
    noCache,
    apiRateLimit("public"),
    apiGuard({
        path: "/api/v1/users/:idOrUsername",
        method: "GET",
        visibility: "public",
        description: "Retrieve a public user profile.",
        tags: ["users"]
    }),
    ctrl.getPublicProfile
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