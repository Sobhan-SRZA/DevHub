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

// Apply rate limiting to authentication endpoints to mitigate brute-force
// attacks and reduce abuse.
router.post("/register", authLimiter, ctrl.register);
router.post("/login", authLimiter, ctrl.login);
router.post("/refresh", authLimiter, ctrl.refresh);
router.post("/logout", ctrl.logout);

// Apply stricter rate limits to password recovery endpoints.
router.post(
    "/forgot-password",
    sensitiveLimiter,
    ctrl.forgotPassword,
);

router.post(
    "/reset-password",
    sensitiveLimiter,
    ctrl.resetPassword,
);

router.post(
    "/resend-password-reset",
    sensitiveLimiter,
    ctrl.resendPasswordReset,
);

// Email verification endpoints require authentication to prevent unauthenticated
// users from manipulating verification flows. Disable caching to avoid storing
// sensitive verification responses.
router.post(
    "/verify-email",
    noCache,
    requireAuth,
    sensitiveLimiter,
    ctrl.verifyEmail,
);

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

// Require an authenticated session before accessing account or session data.
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