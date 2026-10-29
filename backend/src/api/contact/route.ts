import { sensitiveLimiter } from "../../middleware/security";
import { optionalAuth } from "../../middleware/auth";
import { Router } from "express";
import noCache from "../../middleware/noCache";
import * as ctrl from "../../controllers/contactController";
const router = Router();

/* -------------------- Ticket Submission -------------------- */

router.post(
    "/",
    optionalAuth,
    sensitiveLimiter,
    noCache,
    ctrl.createTicket
);

export default router;

/**
 * Copyright (c) 2026 Sobhan Rasoulzadeh Asl (Sobhan-SRZA / Mr. Sinre)
 *
 * Licensed under the BSD 3-Clause License.
 * See the LICENSE file in the project root for license information.
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */