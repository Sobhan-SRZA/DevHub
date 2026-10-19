import { pageAdminGuard } from "../../middleware/roles";
import { pageAuth } from "../../middleware/pageAuth";
import { Router } from "express";

const router = Router();

router.get("/users", pageAuth, pageAdminGuard, (req, res) => {
    res.render("dashboard/users");
});

export default router;

/**
 * Copyright (c) 2026 Sobhan Rasoulzadeh Asl (Sobhan-SRZA / Mr. Sinre)
 *
 * Licensed under the BSD 3-Clause License.
 * See the LICENSE file in the project root for license information.
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */