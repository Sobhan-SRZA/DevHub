import {
    optionalAuth,
    requireAuth
} from "../../middleware/auth";
import { requireTagOwnership } from "../../middleware/ownership";
import { apiRateLimit } from "../../middleware/apiRateLimit";
import { requireAdmin } from "../../middleware/roles";
import { apiGuard } from "../../middleware/apiGuard";
import { Router } from "express";
import noCache from "../../middleware/noCache";
import * as ctrl from "../../controllers/tagController";

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
        path: "/api/v1/tags",
        method: "GET",
        visibility: "public",
        description: "List approved tags with pagination and search.",
        tags: ["tags"]
    }),
    ctrl.listTags
);

router.get(
    "/suggest",
    optionalAuth,
    noCache,
    apiRateLimit("public"),
    apiGuard({
        path: "/api/v1/tags/suggest",
        method: "GET",
        visibility: "public",
        description: "Suggest tags for autocomplete.",
        tags: ["tags"]
    }),
    ctrl.suggestTags
);

/* ==========================================================================
 * Authenticated User Routes
 * ==========================================================================
 * These are defined BEFORE `/:id` so that named routes are not
 * swallowed by the parameterised route.
 * ========================================================================== */

router.post(
    "/find-or-create",
    requireAuth,
    noCache,
    apiRateLimit("authenticated", { windowMs: 60_000, max: 20 }),
    apiGuard({
        path: "/api/v1/tags/find-or-create",
        method: "POST",
        visibility: "authenticated",
        description: "Resolve a tag by name or create it if it does not exist.",
        tags: ["tags"]
    }),
    ctrl.findOrCreateTag
);

router.post(
    "/",
    requireAuth,
    noCache,
    apiRateLimit("authenticated", { windowMs: 60_000, max: 10 }),
    apiGuard({
        path: "/api/v1/tags",
        method: "POST",
        visibility: "authenticated",
        description: "Create a new tag.",
        tags: ["tags"]
    }),
    ctrl.createTag
);

/* ==========================================================================
 * Admin Routes — Moderation
 * ==========================================================================
 * Placed BEFORE `/:id` so they are not shadowed by the parameterised
 * route. Restricted to admins — pending content is confidential and
 * approval is a privileged action.
 * ========================================================================== */

router.get(
    "/pending",
    requireAuth,
    requireAdmin,
    noCache,
    apiRateLimit("admin"),
    apiGuard({
        path: "/api/v1/tags/pending",
        method: "GET",
        visibility: "admin",
        description: "List tags awaiting approval.",
        tags: ["tags", "admin", "moderation"]
    }),
    ctrl.listPending
);

router.post(
    "/:id/approve",
    requireAuth,
    requireAdmin,
    noCache,
    apiRateLimit("admin"),
    apiGuard({
        path: "/api/v1/tags/:id/approve",
        method: "POST",
        visibility: "admin",
        description: "Approve a pending tag.",
        tags: ["tags", "admin", "moderation"]
    }),
    ctrl.approveTag
);

/* ==========================================================================
 * Ownership-Scoped Routes
 * ==========================================================================
 * `/:id` must be LAST so all named routes above take precedence.
 * ========================================================================== */

router.put(
    "/:id",
    requireAuth,
    requireTagOwnership,
    noCache,
    apiRateLimit("authenticated"),
    apiGuard({
        path: "/api/v1/tags/:id",
        method: "PUT",
        visibility: "authenticated",
        description: "Update a tag owned by the caller.",
        tags: ["tags"]
    }),
    ctrl.updateTag
);

router.delete(
    "/:id",
    requireAuth,
    requireTagOwnership,
    noCache,
    apiRateLimit("authenticated"),
    apiGuard({
        path: "/api/v1/tags/:id",
        method: "DELETE",
        visibility: "authenticated",
        description: "Delete a tag owned by the caller.",
        tags: ["tags"]
    }),
    ctrl.deleteTag
);

router.get(
    "/:id",
    optionalAuth,
    noCache,
    apiRateLimit("public"),
    apiGuard({
        path: "/api/v1/tags/:id",
        method: "GET",
        visibility: "public",
        description: "Retrieve a single tag.",
        tags: ["tags"]
    }),
    ctrl.getTag
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