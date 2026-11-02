import { Router } from "express";
import { optionalAuth, requireAuth } from "../../middleware/auth";
import { apiGuard } from "../../middleware/apiGuard";
import { apiRateLimit } from "../../middleware/apiRateLimit";
import noCache from "../../middleware/noCache";
import * as ctrl from "../../controllers/reviewController";

const router = Router({ mergeParams: true });

/* ==========================================================================
 * Public Routes
 * ========================================================================== */

router.get(
    "/",
    optionalAuth,
    noCache,
    apiRateLimit("public"),
    apiGuard({
        path: "/api/v1/projects/:idOrSlug/reviews",
        method: "GET",
        visibility: "public",
        description: "List reviews for a project.",
        tags: ["reviews"]
    }),
    ctrl.listReviews
);

/* ==========================================================================
 * Authenticated Routes
 * ==========================================================================
 * `me` is registered before any parameterised route so it is not
 * shadowed by `/:id`.
 * ========================================================================== */

router.get(
    "/me",
    requireAuth,
    noCache,
    apiRateLimit("authenticated"),
    apiGuard({
        path: "/api/v1/projects/:idOrSlug/reviews/me",
        method: "GET",
        visibility: "authenticated",
        description: "Return the caller's review for this project.",
        tags: ["reviews"]
    }),
    ctrl.getMyReview
);

router.post(
    "/",
    requireAuth,
    noCache,
    apiRateLimit("authenticated", { windowMs: 60 * 60_000, max: 10 }),
    apiGuard({
        path: "/api/v1/projects/:idOrSlug/reviews",
        method: "POST",
        visibility: "authenticated",
        description: "Submit a review for the project.",
        tags: ["reviews"]
    }),
    ctrl.createReview
);

router.put(
    "/",
    requireAuth,
    noCache,
    apiRateLimit("authenticated", { windowMs: 60 * 60_000, max: 20 }),
    apiGuard({
        path: "/api/v1/projects/:idOrSlug/reviews",
        method: "PUT",
        visibility: "authenticated",
        description: "Update the caller's review.",
        tags: ["reviews"]
    }),
    ctrl.updateReview
);

router.delete(
    "/",
    requireAuth,
    noCache,
    apiRateLimit("authenticated", { windowMs: 60 * 60_000, max: 20 }),
    apiGuard({
        path: "/api/v1/projects/:idOrSlug/reviews",
        method: "DELETE",
        visibility: "authenticated",
        description: "Delete the caller's review.",
        tags: ["reviews"]
    }),
    ctrl.deleteReview
);

router.post(
    "/:id/helpful",
    requireAuth,
    noCache,
    apiRateLimit("authenticated", { windowMs: 60_000, max: 60 }),
    apiGuard({
        path: "/api/v1/projects/:idOrSlug/reviews/:id/helpful",
        method: "POST",
        visibility: "authenticated",
        description: "Mark a review as helpful.",
        tags: ["reviews"]
    }),
    ctrl.markHelpful
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