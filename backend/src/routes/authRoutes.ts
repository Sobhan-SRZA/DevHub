import { Router } from "express";
import * as ctrl from "../controllers/authController";
import { requireAuth } from "../middleware/auth";
import noCache from "../middleware/noCache";
import {
    authLimiter,
    sensitiveLimiter,
} from "../middleware/security";

const router = Router();

/* -------------------------------------------------------------------------- */
/*                         Public Authentication Routes                       */
/* -------------------------------------------------------------------------- */

router.post("/register", authLimiter, ctrl.register);
router.post("/login", authLimiter, ctrl.login);
router.post("/refresh", authLimiter, ctrl.refresh);
router.post("/logout", ctrl.logout);

router.post("/forgot-password", sensitiveLimiter, ctrl.forgotPassword);
router.post("/reset-password", sensitiveLimiter, ctrl.resetPassword);
router.post("/resend-password-reset", sensitiveLimiter, ctrl.resendPasswordReset);

/* -------------------------------------------------------------------------- */
/*                        Email Verification Routes                           */
/* -------------------------------------------------------------------------- */

/*
 * The POST /verify-email route is intentionally public. The signed
 * `verifyToken` in the request body is the sole proof of identity — it
 * cannot be forged and is scoped to a single user and email address.
 *
 * Requiring an additional session cookie here would prevent users from
 * verifying their email after their session expires (e.g. after closing
 * the browser mid-flow), which is the primary bug this route addresses.
 *
 * On successful verification the controller issues a fresh session and
 * sets authentication cookies, so the user lands authenticated on the
 * dashboard.
 */
router.post(
    "/verify-email",
    noCache,
    sensitiveLimiter,
    ctrl.verifyEmail,
);

/*
 * Resend is available both to authenticated users (uses req.user._id —
 * this is the recovery path the frontend relies on when restoring a
 * verification state) and to callers holding a valid verifyToken.
 * requireAuth is kept so req.user is populated in the common case;
 * the controller transparently falls back to the token when needed.
 */
router.post(
    "/resend-verification",
    noCache,
    requireAuth,
    sensitiveLimiter,
    ctrl.resendVerification,
);

/* -------------------------------------------------------------------------- */
/*                       Protected Authentication Routes                      */
/* -------------------------------------------------------------------------- */

router.get("/me", requireAuth, ctrl.me);
router.post("/logout-all", requireAuth, ctrl.logoutAll);
router.get("/sessions", requireAuth, ctrl.listSessions);
router.delete("/sessions/:id", requireAuth, ctrl.revokeSession);

export default router;

/**
 * Copyright (c) 2026 Sobhan Rasoulzadeh Asl (Sobhan-SRZA / Mr. Sinre)
 *
 * Licensed under the BSD 3-Clause License.
 * See the LICENSE file in the project root for license information.
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */