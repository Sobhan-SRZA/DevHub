import { Router } from "express";

const router = Router();

/**
 * Legal pages — Privacy Policy and Terms of Service.
 *
 * Both routes are public, cacheable, and intentionally
 * unauthenticated. They render static views with only SEO metadata
 * injected by the layout component.
 */

router.get("/privacy", (req, res) => {
    res.render("pages/legal/privacy", { req });
});

router.get("/terms", (req, res) => {
    res.render("pages/legal/terms", { req });
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