import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { requireAdmin } from "../middleware/roles";
import * as ctrl from "../controllers/adminController";

const router = Router();

router.use(requireAuth);
router.use(requireAdmin);

// User management
router.get("/users", ctrl.listUsers);
router.post("/users/:id/role", ctrl.changeRole);
router.post("/users/:id/ban", ctrl.toggleBan);

export default router;

/**
 * Copyright (c) 2026 Sobhan Rasoulzadeh Asl (Sobhan-SRZA / Mr. Sinre)
 *
 * Licensed under the BSD 3-Clause License.
 * See the LICENSE file in the project root for license information.
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */