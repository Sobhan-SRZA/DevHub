import { Router } from "express";
import { optionalAuth, requireAuth } from "../../middleware/auth";
import { apiGuard } from "../../middleware/apiGuard";
import { apiRateLimit } from "../../middleware/apiRateLimit";
import noCache from "../../middleware/noCache";
import * as ctrl from "../../controllers/commentController";

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
        path: "/api/v1/projects/:idOrSlug/comments",
        method: "GET",
        visibility: "public",
        description: "List comments on a project.",
        tags: ["comments"]
    }),
    ctrl.listComments
);

/* ==========================================================================
 * Authenticated Routes
 * ==========================================================================
 * Every handler receives both `idOrSlug` (from the parent project route)
 * and `id` (the comment). Controllers must verify that the comment
 * belongs to the project resolved from `idOrSlug`.
 * ========================================================================== */

router.post(
    "/",
    requireAuth,
    noCache,
    apiRateLimit("authenticated", { windowMs: 60_000, max: 15 }),
    apiGuard({
        path: "/api/v1/projects/:idOrSlug/comments",
        method: "POST",
        visibility: "authenticated",
        description: "Create a comment on a project.",
        tags: ["comments"]
    }),
    ctrl.createComment
);

router.put(
    "/:id",
    requireAuth,
    noCache,
    apiRateLimit("authenticated", { windowMs: 60_000, max: 20 }),
    apiGuard({
        path: "/api/v1/projects/:idOrSlug/comments/:id",
        method: "PUT",
        visibility: "authenticated",
        description: "Update a comment. Ownership is verified in the controller.",
        tags: ["comments"]
    }),
    ctrl.updateComment
);

router.delete(
    "/:id",
    requireAuth,
    noCache,
    apiRateLimit("authenticated", { windowMs: 60_000, max: 20 }),
    apiGuard({
        path: "/api/v1/projects/:idOrSlug/comments/:id",
        method: "DELETE",
        visibility: "authenticated",
        description: "Delete a comment. Ownership is verified in the controller.",
        tags: ["comments"]
    }),
    ctrl.deleteComment
);

router.post(
    "/:id/like",
    requireAuth,
    noCache,
    apiRateLimit("authenticated", { windowMs: 60_000, max: 60 }),
    apiGuard({
        path: "/api/v1/projects/:idOrSlug/comments/:id/like",
        method: "POST",
        visibility: "authenticated",
        description: "Toggle a like on a comment.",
        tags: ["comments"]
    }),
    ctrl.toggleLike
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