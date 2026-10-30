import { requireDeveloper } from "../../middleware/roles";
import { requireAuth } from "../../middleware/auth";
import * as ctrl from "../../controllers/healthController";
import { Router } from "express";

const router = Router();

router.get("/", (req, res) => res.json({ status: "ok" }));

router.get("/detailed", requireAuth, requireDeveloper, ctrl.healthCheck);

export default router;

/**
 * Copyright (c) 2026 Sobhan Rasoulzadeh Asl (Sobhan-SRZA / Mr. Sinre)
 *
 * Licensed under the BSD 3-Clause License.
 * See the LICENSE file in the project root for license information.
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */