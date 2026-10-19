import {
    requireAuth,
    optionalAuth
} from "../middleware/auth";
import { Router } from "express";
import * as ctrl from "../controllers/reviewController";

const router = Router({ mergeParams: true });
// mergeParams: true → بتونیم :idOrSlug رو از router والد بگیریم

router.get("/", optionalAuth, ctrl.listReviews);
router.get("/me", requireAuth, ctrl.getMyReview);

router.post("/", requireAuth, ctrl.createReview);
router.put("/", requireAuth, ctrl.updateReview);
router.delete("/", requireAuth, ctrl.deleteReview);

// helpful روی review id مستقل
router.post("/:id/helpful", requireAuth, ctrl.markHelpful);

export default router;

/**
 * Copyright (c) 2026 Sobhan Rasoulzadeh Asl (Sobhan-SRZA / Mr. Sinre)
 *
 * Licensed under the BSD 3-Clause License.
 * See the LICENSE file in the project root for license information.
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */