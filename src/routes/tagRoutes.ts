import { requireTagOwnership } from "../middleware/ownership";
import { requireAuth } from "../middleware/auth";
import { Router } from "express";
import * as ctrl from "../controllers/tagController";

const router = Router();

router.get("/", ctrl.listTags);
router.get("/:id", ctrl.getTag);

router.post("/", requireAuth, ctrl.createTag);
router.put("/:id", requireAuth, requireTagOwnership, ctrl.updateTag);
router.delete("/:id", requireAuth, requireTagOwnership, ctrl.deleteTag);
router.post("/merge", requireAuth, ctrl.mergeTags);

export default router;

/**
 * Copyright (c) 2026 Sobhan Rasoulzadeh Asl (Sobhan-SRZA / Mr. Sinre)
 *
 * Licensed under the BSD 3-Clause License.
 * See the LICENSE file in the project root for license information.
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */