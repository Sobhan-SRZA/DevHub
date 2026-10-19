import {
    requireAuth,
    optionalAuth
} from "../middleware/auth";
import { requireTagOwnership } from "../middleware/ownership";
import { Router } from "express";
import * as ctrl from "../controllers/tagController";

const router = Router();

/* ---------- عمومی ---------- */
router.get("/", optionalAuth, ctrl.listTags);
router.get("/suggest", optionalAuth, ctrl.suggestTags);

/* ---------- کاربر لاگین‌شده ---------- */
router.post("/find-or-create", requireAuth, ctrl.findOrCreateTag);
router.post("/", requireAuth, ctrl.createTag);
router.put("/:id", requireAuth, requireTagOwnership, ctrl.updateTag);
router.delete("/:id", requireAuth, requireTagOwnership, ctrl.deleteTag);

/* ---------- admin ---------- */
router.get("/pending", requireAuth, ctrl.listPending);
router.post("/:id/approve", requireAuth, ctrl.approveTag);

router.get("/:id", ctrl.getTag);

export default router;

/**
 * Copyright (c) 2026 Sobhan Rasoulzadeh Asl (Sobhan-SRZA / Mr. Sinre)
 *
 * Licensed under the BSD 3-Clause License.
 * See the LICENSE file in the project root for license information.
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */