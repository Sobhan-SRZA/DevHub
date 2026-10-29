import { Router } from "express";
import * as ctrl from "../controllers/profileController";
import { requireAuth } from "../middleware/auth";
import { mwUploadAvatar } from "../middleware/upload";

const router = Router();

/**
 * All profile routes require an authenticated user.
 * This protects personal information and account modification endpoints.
 */
router.use(requireAuth);

/* -------------------------------------------------------------------------- */
/*                            Profile Management                              */
/* -------------------------------------------------------------------------- */

router.get("/me", ctrl.getMe);
router.patch("/me", ctrl.updateProfile);
router.patch("/username", ctrl.changeUsername);

/* -------------------------------------------------------------------------- */
/*                              Avatar Management                             */
/* -------------------------------------------------------------------------- */

// Apply avatar-specific upload middleware before processing the uploaded file.
router.post("/avatar", mwUploadAvatar, ctrl.uploadAvatar);
router.delete("/avatar", ctrl.deleteAvatar);

/* -------------------------------------------------------------------------- */
/*                              Email Management                              */
/* -------------------------------------------------------------------------- */

// Email changes use dedicated request, verification, and cancellation steps.
router.post("/email/request", ctrl.requestEmailChange);
router.post("/email/verify", ctrl.verifyEmailChange);
router.post("/email/verify-old", ctrl.verifyOldEmailForChange);
router.delete("/email/pending", ctrl.cancelEmailChange);

/* -------------------------------------------------------------------------- */
/*                            Password Management                             */
/* -------------------------------------------------------------------------- */

// Separate password change requests from their confirmation step.
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