import { mwUploadAvatar } from "../middleware/upload";
import { requireAuth } from "../middleware/auth";
import { Router } from "express";
import * as ctrl from "../controllers/profileController";

const router = Router();

// همه روت‌ها نیاز به لاگین دارن
router.use(requireAuth);

/* ---------- Base ---------- */
router.get("/me", ctrl.getMe);
router.patch("/me", ctrl.updateProfile);
router.patch("/username", ctrl.changeUsername);

/* ---------- Avatar ---------- */
router.post("/avatar", mwUploadAvatar, ctrl.uploadAvatar);
router.delete("/avatar", ctrl.deleteAvatar);

/* ---------- Email change ---------- */
router.post("/email/request", ctrl.requestEmailChange);
router.post("/email/verify", ctrl.verifyEmailChange);
router.post('/email/verify-old', ctrl.verifyOldEmailForChange);
router.delete("/email/pending", ctrl.cancelEmailChange);

/* ---------- Password change ---------- */
router.post("/password/request", ctrl.requestPasswordChange);
router.post("/password/confirm", ctrl.confirmPasswordChange);

export default router;

/**
 * Copyright (c) 2026 Sobhan Rasoulzadeh Asl (Sobhan-SRZA / Mr. Sinre)
 *
 * Licensed under the BSD 3-Clause License.
 * See the LICENSE file in the project root for license information.
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */