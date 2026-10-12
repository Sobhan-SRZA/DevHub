import {
    requireAuth,
    optionalAuth
} from "../middleware/auth";
import { Router } from "express";
import * as ctrl from "../controllers/commentController";

const router = Router({ mergeParams: true });

router.get("/", optionalAuth, ctrl.listComments);
router.post("/", requireAuth, ctrl.createComment);

// اینها با comment id کار می‌کنن — نه پروژه
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