import { Router } from "express";
import { requireAuth } from "../../middleware/auth";
import { requireAdmin } from "../../middleware/roles";
import { sensitiveLimiter } from "../../middleware/security";
import { apiGuard } from "../../middleware/apiGuard";
import { apiRateLimit } from "../../middleware/apiRateLimit";
import noCache from "../../middleware/noCache";
import * as ctrl from "../../controllers/ticketController";

const router = Router();

/* ==========================================================================
 * Public Ticket Tracking (token-based)
 * ==========================================================================
 * Tracking tokens are the sole auth mechanism here. They are scoped to
 * a single ticket, expire in 30 days, and can be revoked.
 * ========================================================================== */

router.get(
    "/track/:token",
    noCache,
    apiRateLimit("public", { windowMs: 60_000, max: 30 }),
    apiGuard({
        path: "/api/v1/tickets/track/:token",
        method: "GET",
        visibility: "public",
        description: "Retrieve a ticket via tracking token.",
        tags: ["tickets"]
    }),
    ctrl.getTicketByToken
);

router.post(
    "/track/:token/reply",
    noCache,
    sensitiveLimiter,
    apiGuard({
        path: "/api/v1/tickets/track/:token/reply",
        method: "POST",
        visibility: "public",
        description: "Reply to a ticket via tracking token.",
        tags: ["tickets"]
    }),
    ctrl.replyToTicketByToken
);

/* ==========================================================================
 * Email Lookup (public)
 * ========================================================================== */

router.post(
    "/lookup",
    noCache,
    sensitiveLimiter,
    apiGuard({
        path: "/api/v1/tickets/lookup",
        method: "POST",
        visibility: "public",
        description: "Request an email-lookup code.",
        tags: ["tickets"]
    }),
    ctrl.requestTicketLookup
);

router.post(
    "/lookup/verify",
    noCache,
    sensitiveLimiter,
    apiGuard({
        path: "/api/v1/tickets/lookup/verify",
        method: "POST",
        visibility: "public",
        description: "Verify the lookup code and list tickets.",
        tags: ["tickets"]
    }),
    ctrl.verifyTicketLookup
);

/* ==========================================================================
 * Authenticated — My Tickets
 * ========================================================================== */

router.get(
    "/my",
    requireAuth,
    noCache,
    apiRateLimit("authenticated"),
    apiGuard({
        path: "/api/v1/tickets/my",
        method: "GET",
        visibility: "authenticated",
        description: "List tickets associated with the caller.",
        tags: ["tickets"]
    }),
    ctrl.listMyTickets
);

/* ==========================================================================
 * Admin Routes
 * ==========================================================================
 * Everything below requires both authentication and admin privileges.
 * The `router.use()` order is important — it must come after all public
 * and user-scoped routes, or those would inherit admin requirements.
 * ========================================================================== */

router.use(requireAuth, requireAdmin, noCache);

router.get(
    "/",
    apiRateLimit("admin"),
    apiGuard({
        path: "/api/v1/tickets",
        method: "GET",
        visibility: "admin",
        description: "List all tickets.",
        tags: ["tickets", "admin"]
    }),
    ctrl.listTickets
);

router.get(
    "/:id",
    apiRateLimit("admin"),
    apiGuard({
        path: "/api/v1/tickets/:id",
        method: "GET",
        visibility: "admin",
        description: "Retrieve a single ticket.",
        tags: ["tickets", "admin"]
    }),
    ctrl.getTicket
);

router.post(
    "/:id/reply",
    apiRateLimit("admin"),
    apiGuard({
        path: "/api/v1/tickets/:id/reply",
        method: "POST",
        visibility: "admin",
        description: "Post a staff reply and notify the author.",
        tags: ["tickets", "admin"]
    }),
    ctrl.replyToTicket
);

router.patch(
    "/:id",
    apiRateLimit("admin"),
    apiGuard({
        path: "/api/v1/tickets/:id",
        method: "PATCH",
        visibility: "admin",
        description: "Update ticket status, priority, or assignment.",
        tags: ["tickets", "admin"]
    }),
    ctrl.updateTicket
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