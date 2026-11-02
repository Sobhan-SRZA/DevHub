import { sensitiveLimiter } from "../../middleware/security";
import { Router } from "express";
import * as ctrl from "../../controllers/ticketController";
import noCache from "../../middleware/noCache";
import { requireAuth } from "../../middleware/auth";
import { requireAdmin } from "../../middleware/roles";

const router = Router();


/* ==========================================================================
 * Public Ticket Tracking (token-based)
 * ==========================================================================
 * A ticket tracking token is the sole authentication mechanism here.
 * It is scoped to a single ticket, single user, expires in 30 days,
 * and can be revoked.
 * ========================================================================== */

router.get(
    "/track/:token",
    noCache,
    ctrl.getTicketByToken
);

router.post(
    "/track/:token/reply",
    noCache,
    sensitiveLimiter,
    ctrl.replyToTicketByToken
);

/* ==========================================================================
 * Email-based Lookup
 * ==========================================================================
 * Two-step OTP flow for users who lost the tracking link.
 * ========================================================================== */

router.post(
    "/lookup",
    noCache,
    sensitiveLimiter,
    ctrl.requestTicketLookup
);

router.post(
    "/lookup/verify",
    noCache,
    sensitiveLimiter,
    ctrl.verifyTicketLookup
);

router.get("/my", requireAuth, ctrl.listMyTickets);

// dashboard - admin

/**
 * Return the current user's tickets (matched by userId OR email).
*/

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