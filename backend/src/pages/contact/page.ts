import { optionalAuth } from "../../middleware/auth";
import { Router } from "express";
import noCache from "../../middleware/noCache";
const router = Router();

/* -------------------- Contact Page -------------------- */

router.get("/", optionalAuth, noCache, (req, res) => {
    res.render("pages/contact", { req });
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