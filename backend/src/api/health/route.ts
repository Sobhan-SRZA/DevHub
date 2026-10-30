import { healthCheck } from "../../controllers/healthController";
import { Router } from "express";
import { pageDeveloperGuard } from "../../middleware/roles";
import { requireAuth } from "../../middleware/auth";

const router = Router();

router.get("/", requireAuth, pageDeveloperGuard, healthCheck);

export default router;

/**
 * Copyright (c) 2026 Sobhan Rasoulzadeh Asl (Sobhan-SRZA / Mr. Sinre)
 *
 * Licensed under the BSD 3-Clause License.
 * See the LICENSE file in the project root for license information.
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */