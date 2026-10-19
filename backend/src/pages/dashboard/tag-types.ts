import { pageAuth } from "../../middleware/pageAuth";
import { Router } from "express";

const router = Router();

router.get("/tag-types", pageAuth, (req, res) => res.render("dashboard/tag-types"));


export default router;

/**
 * Copyright (c) 2026 Sobhan Rasoulzadeh Asl (Sobhan-SRZA / Mr. Sinre)
 *
 * Licensed under the BSD 3-Clause License.
 * See the LICENSE file in the project root for license information.
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */