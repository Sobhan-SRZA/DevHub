import { Router } from "express";
import { requireAuth } from "../../middleware/auth";
import { mwUploadAvatar } from "../../middleware/upload";
import { apiGuard } from "../../middleware/apiGuard";
import { apiRateLimit } from "../../middleware/apiRateLimit";
import noCache from "../../middleware/noCache";
import * as ctrl from "../../controllers/profileController";

const router = Router();

/* Every profile route requires authentication. */
router.use(requireAuth, noCache);

/* ==========================================================================
 * Profile Management
 * ========================================================================== */

router.get(
    "/me",
    apiRateLimit("authenticated"),
    apiGuard({
        path: "/api/v1/profile/me",
        method: "GET",
        visibility: "authenticated",
        description: "Return the caller's profile.",
        tags: ["profile"]
    }),
    ctrl.getMe
);

router.patch(
    "/me",
    apiRateLimit("authenticated", { windowMs: 60_000, max: 20 }),
    apiGuard({
        path: "/api/v1/profile/me",
        method: "PATCH",
        visibility: "authenticated",
        description: "Update the caller's profile.",
        tags: ["profile"]
    }),
    ctrl.updateProfile
);

router.patch(
    "/username",
    apiRateLimit("authenticated", { windowMs: 60 * 60_000, max: 3 }),
    apiGuard({
        path: "/api/v1/profile/username",
        method: "PATCH",
        visibility: "authenticated",
        description: "Change the caller's username.",
        tags: ["profile"]
    }),
    ctrl.changeUsername
);

/* ==========================================================================
 * Avatar Management
 * ==========================================================================
 * Avatar uploads are throttled aggressively because they consume disk
 * and bandwidth. Three uploads per hour is sufficient for legitimate
 * use and prevents rapid replacement loops.
 * ========================================================================== */

router.post(
    "/avatar",
    apiRateLimit("authenticated", { windowMs: 60 * 60_000, max: 3 }),
    apiGuard({
        path: "/api/v1/profile/avatar",
        method: "POST",
        visibility: "authenticated",
        description: "Upload a new avatar.",
        tags: ["profile", "upload"]
    }),
    mwUploadAvatar,
    ctrl.uploadAvatar
);

router.delete(
    "/avatar",
    apiRateLimit("authenticated", { windowMs: 60 * 60_000, max: 3 }),
    apiGuard({
        path: "/api/v1/profile/avatar",
        method: "DELETE",
        visibility: "authenticated",
        description: "Delete the current avatar.",
        tags: ["profile"]
    }),
    ctrl.deleteAvatar
);

/* ==========================================================================
 * Email Management
 * ==========================================================================
 * Each email step is rate-limited individually to prevent OTP-brute-force
 * and mail-flood attacks.
 * ========================================================================== */

router.post(
    "/email/request",
    apiRateLimit("authenticated", { windowMs: 60 * 60_000, max: 5 }),
    apiGuard({
        path: "/api/v1/profile/email/request",
        method: "POST",
        visibility: "authenticated",
        description: "Request an email change.",
        tags: ["profile", "email"]
    }),
    ctrl.requestEmailChange
);

router.post(
    "/email/verify",
    apiRateLimit("authenticated", { windowMs: 15 * 60_000, max: 10 }),
    apiGuard({
        path: "/api/v1/profile/email/verify",
        method: "POST",
        visibility: "authenticated",
        description: "Confirm the new email with a verification code.",
        tags: ["profile", "email"]
    }),
    ctrl.verifyEmailChange
);

router.post(
    "/email/verify-old",
    apiRateLimit("authenticated", { windowMs: 15 * 60_000, max: 10 }),
    apiGuard({
        path: "/api/v1/profile/email/verify-old",
        method: "POST",
        visibility: "authenticated",
        description: "Confirm the current email before applying the change.",
        tags: ["profile", "email"]
    }),
    ctrl.verifyOldEmailForChange
);

router.delete(
    "/email/pending",
    apiRateLimit("authenticated", { windowMs: 60 * 60_000, max: 10 }),
    apiGuard({
        path: "/api/v1/profile/email/pending",
        method: "DELETE",
        visibility: "authenticated",
        description: "Cancel a pending email change.",
        tags: ["profile", "email"]
    }),
    ctrl.cancelEmailChange
);

/* ==========================================================================
 * Password Management
 * ========================================================================== */

router.post(
    "/password/request",
    apiRateLimit("authenticated", { windowMs: 60 * 60_000, max: 5 }),
    apiGuard({
        path: "/api/v1/profile/password/request",
        method: "POST",
        visibility: "authenticated",
        description: "Request a password change code.",
        tags: ["profile", "password"]
    }),
    ctrl.requestPasswordChange
);

router.post(
    "/password/confirm",
    apiRateLimit("authenticated", { windowMs: 15 * 60_000, max: 10 }),
    apiGuard({
        path: "/api/v1/profile/password/confirm",
        method: "POST",
        visibility: "authenticated",
        description: "Confirm the password change with the code.",
        tags: ["profile", "password"]
    }),
    ctrl.confirmPasswordChange
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