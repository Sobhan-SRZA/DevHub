import { Router } from "express";
import {
    optionalAuth,
    requireAuth,
} from "../middleware/auth";
import * as ctrl from "../controllers/commentController";

const router = Router({ mergeParams: true });

// Allow public access to comments while providing authentication context
// for features that depend on the current user's identity.
router.get("/", optionalAuth, ctrl.listComments);

// Require authentication to create and manage comments.
router.post("/", requireAuth, ctrl.createComment);

// These routes operate on comment IDs, not project IDs.
router.put("/:id", requireAuth, ctrl.updateComment);
router.delete("/:id", requireAuth, ctrl.deleteComment);
router.post("/:id/like", requireAuth, ctrl.toggleLike);

export default router;

/**
 * Copyright (c) 2026 Sobhan Rasoulzadeh Asl (Sobhan-SRZA / Mr. Sinre)
 *
 * Licensed under the BSD 3-Clause License.
 * See the LICENSE file in the project root for license information.
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */