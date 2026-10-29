
import {
    requireAuth,
    optionalAuth,
} from "../middleware/auth";
import { Router } from "express";
import * as ctrl from "../controllers/tagController";

const router = Router();

/* ==========================================================================
 * Public Routes
 * ========================================================================== */

// Retrieve all tag types
router.get("/", optionalAuth, ctrl.listTagTypes);

// Retrieve a specific tag type
router.get("/:id", ctrl.getTagType);

/* ==========================================================================
 * Authenticated Routes
 * ========================================================================== */

// Create a new tag type
router.post("/", requireAuth, ctrl.createTagType);

// Update an existing tag type
router.put("/:id", requireAuth, ctrl.updateTagType);

// Delete an existing tag type
router.delete("/:id", requireAuth, ctrl.deleteTagType);

/* ==========================================================================
 * Tag Type Moderation
 * ========================================================================== */

// Approve a pending tag type
router.post("/:id/approve", requireAuth, ctrl.approveTagType);

export default router;

/**
 * Copyright (c) 2026 Sobhan Rasoulzadeh Asl (Sobhan-SRZA / Mr. Sinre)
 *
 * Licensed under the BSD 3-Clause License.
 * See the LICENSE file in the project root for license information.
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */