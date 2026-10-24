import { requireDeveloper } from "../middleware/roles";
import { requireAuth } from "../middleware/auth";
import { Router } from "express";
import * as ctrl from "../controllers/systemController";

const router = Router();

router.use(requireAuth);
router.use(requireDeveloper);

router.get("/stats", ctrl.getSystemStats);
router.get("/logs", ctrl.getLogs);
router.get("/logs/download", ctrl.downloadLogs);
router.post("/logs/clear", ctrl.clearLogs);

export default router;

/**
 * Copyright (c) 2026 Sobhan Rasoulzadeh Asl (Sobhan-SRZA / Mr. Sinre)
 *
 * Licensed under the BSD 3-Clause License.
 * See the LICENSE file in the project root for license information.
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */