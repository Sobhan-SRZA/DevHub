import { Router } from "express";
import { redirectProfile } from "../../middleware/auth";
import noCache from "../../middleware/noCache";

const router = Router();

/* -------------------- Login Page -------------------- */

router.get(
    "/login",
    noCache,
    redirectProfile,
    (req, res) => {
        return res.render("auth/login");
    }
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