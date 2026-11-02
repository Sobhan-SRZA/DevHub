import {
    optionalAuth,
    requireAuth
} from "../../middleware/auth";
import { requireAdmin } from "../../middleware/roles";
import { apiRateLimit } from "../../middleware/apiRateLimit";
import { apiGuard } from "../../middleware/apiGuard";
import { Router } from "express";
import * as ctrl from "../../controllers/tagController";
import noCache from "../../middleware/noCache";

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
        path: "/api/v1/tag-types",
        method: "GET",
        visibility: "public",
        description: "List all approved tag categories.",
        tags: ["tags"]
    }),
    ctrl.listTagTypes
);

router.get(
    "/:id",
    optionalAuth,
    noCache,
    apiRateLimit("public"),
    apiGuard({
        path: "/api/v1/tag-types/:id",
        method: "GET",
        visibility: "public",
        description: "Retrieve a single tag category.",
        tags: ["tags"]
    }),
    ctrl.getTagType
);

/* ==========================================================================
 * Admin Routes — Tag Category Management
 * ==========================================================================
 * Tag categories are a controlled taxonomy. Only administrators may
 * create, edit, or remove them. Allow authenticated users to do so
 * would permit arbitrary taxonomy manipulation, breaking search and
 * discovery for every user on the platform.
 * ========================================================================== */

router.post(
    "/",
    requireAuth,
    requireAdmin,
    noCache,
    apiRateLimit("admin", { windowMs: 60_000, max: 20 }),
    apiGuard({
        path: "/api/v1/tag-types",
        method: "POST",
        visibility: "admin",
        description: "Create a new tag category.",
        tags: ["tags", "admin"]
    }),
    ctrl.createTagType
);

router.put(
    "/:id",
    requireAuth,
    requireAdmin,
    noCache,
    apiRateLimit("admin"),
    apiGuard({
        path: "/api/v1/tag-types/:id",
        method: "PUT",
        visibility: "admin",
        description: "Update a tag category.",
        tags: ["tags", "admin"]
    }),
    ctrl.updateTagType
);

router.delete(
    "/:id",
    requireAuth,
    requireAdmin,
    noCache,
    apiRateLimit("admin"),
    apiGuard({
        path: "/api/v1/tag-types/:id",
        method: "DELETE",
        visibility: "admin",
        description: "Delete a tag category.",
        tags: ["tags", "admin"]
    }),
    ctrl.deleteTagType
);

/* ==========================================================================
 * Admin Routes — Moderation
 * ========================================================================== */

router.post(
    "/:id/approve",
    requireAuth,
    requireAdmin,
    noCache,
    apiRateLimit("admin"),
    apiGuard({
        path: "/api/v1/tag-types/:id/approve",
        method: "POST",
        visibility: "admin",
        description: "Approve a pending tag category.",
        tags: ["tags", "admin", "moderation"]
    }),
    ctrl.approveTagType
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