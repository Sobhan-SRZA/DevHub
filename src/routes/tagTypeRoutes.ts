import { requireAuth } from "../middleware/auth";
import { Router } from "express";
import * as ctrl from "../controllers/tagTypeController";

const router = Router();

router.get("/", ctrl.listTagTypes);
router.get("/:id", ctrl.getTagType);

router.post("/", requireAuth, ctrl.createTagType);
router.put("/:id", requireAuth, ctrl.updateTagType);
router.delete("/:id", requireAuth, ctrl.deleteTagType);

export default router;

/**
 * Copyright (c) 2026 Sobhan Rasoulzadeh Asl (Sobhan-SRZA / Mr. Sinre)
 *
 * Licensed under the BSD 3-Clause License.
 * See the LICENSE file in the project root for license information.
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */