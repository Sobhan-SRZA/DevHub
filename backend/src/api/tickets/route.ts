import { Router } from "express";
import { requireAuth } from "../../middleware/auth";
import { requireAdmin } from "../../middleware/roles";
import * as ctrl from "../../controllers/ticketController";
import noCache from "../../middleware/noCache";

const router = Router();

router.use(requireAuth, requireAdmin, noCache);

router.get("/", ctrl.listTickets);
router.get("/:id", ctrl.getTicket);
router.post("/:id/reply", ctrl.replyToTicket);
router.patch("/:id", ctrl.updateTicket);

export default router;

/**
 * Copyright (c) 2026 Sobhan Rasoulzadeh Asl (Sobhan-SRZA / Mr. Sinre)
 *
 * Licensed under the BSD 3-Clause License.
 * See the LICENSE file in the project root for license information.
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */