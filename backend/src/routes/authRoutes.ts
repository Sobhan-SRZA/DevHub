import { requireAuth } from "../middleware/auth";
import { authLimiter, sensitiveLimiter } from "../middleware/security";
import { Router } from "express";
import * as ctrl from "../controllers/authController";

const router = Router();

// ---------- public (rate-limited) ----------
router.post("/register", authLimiter, ctrl.register);
router.post("/login", authLimiter, ctrl.login);
router.post("/refresh", authLimiter, ctrl.refresh);
router.post("/logout", ctrl.logout);
router.post("/forgot-password", sensitiveLimiter, ctrl.forgotPassword);
router.post("/reset-password", sensitiveLimiter, ctrl.resetPassword);
router.post("/resend-password-reset", sensitiveLimiter, ctrl.resendPasswordReset);
router.post(
    "/resend-verification-for-me",
    requireAuth,
    sensitiveLimiter,
    ctrl.resendVerificationForMe
);

// ---------- protected ----------
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
