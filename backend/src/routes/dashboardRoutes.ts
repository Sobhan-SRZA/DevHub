import {
    pageAdminGuard,
    pageDeveloperGuard
} from "../middleware/roles";
import { attachUserLocals } from "../middleware/locals";
import { pageAuth } from "../middleware/pageAuth";
import { Router } from "express";

const router = Router();

router.use(pageAuth);
router.use(attachUserLocals);

/* ---------- Common dashboard pages ---------- */
router.get("/", (req, res) => res.render("dashboard/home"));
router.get("/projects", (req, res) => res.render("dashboard/projects"));
router.get("/profile", (req, res) => res.render("dashboard/profile"));
router.get("/security", (req, res) => res.render("dashboard/security"));
router.get("/settings", (req, res) => res.render("dashboard/settings"));

/* ---------- Admin only ---------- */
router.get("/tag-types", pageAdminGuard, (req, res) => res.render("dashboard/tag-types"));
router.get("/tags", pageAdminGuard, (req, res) => res.render("dashboard/tags"));
router.get("/users", pageAdminGuard, (req, res) => res.render("dashboard/users"));

/* ---------- Developer only ---------- */
router.get("/system", pageDeveloperGuard, (req, res) => res.render("dashboard/system"));
router.get("/logs", pageDeveloperGuard, (req, res) => res.render("dashboard/logs"));


export default router;

/**
 * Copyright (c) 2026 Sobhan Rasoulzadeh Asl (Sobhan-SRZA / Mr. Sinre)
 *
 * Licensed under the BSD 3-Clause License.
 * See the LICENSE file in the project root for license information.
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */