import { Router } from "express";
import { requireAuth } from "../../middleware/auth";
import { requireAdmin } from "../../middleware/roles";
import * as ctrl from "../../controllers/ticketController";
import noCache from "../../middleware/noCache";
import ticketsRouter from "../../routes/tickets";

const router = Router();

router.use("/", ticketsRouter);
router.use(requireAuth, requireAdmin, noCache);

/**
 * Return the current user's tickets (matched by userId OR email).
 */
router.get("/my", requireAuth, ctrl.listMyTickets);

export default router;

/**
 * Copyright (c) 2026 Sobhan Rasoulzadeh Asl (Sobhan-SRZA / Mr. Sinre)
 *
 * Licensed under the BSD 3-Clause License.
 * See the LICENSE file in the project root for license information.
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */