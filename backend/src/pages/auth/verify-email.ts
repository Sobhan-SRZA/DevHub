import { Router } from "express";
import noCache from "../../middleware/noCache";

const router = Router();

/* -------------------- Email Verification Page -------------------- */

router.get(
    "/verify-email",
    noCache,
    (req, res) => {
        return res.render("auth/verify-email", req);
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