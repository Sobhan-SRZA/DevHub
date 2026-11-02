/**
 * Exposes the API manifest. Intended for:
 *   - Frontend feature detection (which endpoints are available here?)
 *   - Operations dashboards (diff between dev and prod surface)
 *   - Automated CI checks (ensure the surface matches expectations)
 */

import { Router } from "express";
import { buildManifest, isStrictMode } from "../../config/apiRegistry";
import { requireAuth } from "../../middleware/auth";
import { requireDeveloper } from "../../middleware/roles";
import { apiGuard } from "../../middleware/apiGuard";
import { apiRateLimit } from "../../middleware/apiRateLimit";
import noCache from "../../middleware/noCache";

const router = Router();

/* ==========================================================================
 * Public Manifest — Summary Only
 * ==========================================================================
 * Returns a minimal summary suitable for the frontend. It lists only
 * publicly visible endpoints in the current environment, so the client
 * can hide UI affordances that would otherwise 404.
 * ========================================================================== */

router.get(
    "/",
    noCache,
    apiRateLimit("public"),
    apiGuard({
        path: "/api/_meta",
        method: "GET",
        visibility: "public",
        description: "Public summary of available API endpoints.",
        tags: ["meta"]
    }),
    (_req, res) => {
        const manifest = buildManifest();

        res.json({
            ok: true,
            environment: manifest.environment,
            version: manifest.version,
            strict: manifest.strict,
            featureFlags: manifest.featureFlags,
            endpoints: manifest.endpoints
                .filter((e) => e.visibility === "public" && e.enabled)
                .map((e) => ({
                    path: e.path,
                    method: e.method,
                    description: e.description
                }))
        });
    }
);

/* ==========================================================================
 * Detailed Manifest — Developer Only
 * ==========================================================================
 * Returns the complete surface, including disabled endpoints and the
 * reasons they were filtered out. Restricted to developers.
 * ========================================================================== */

router.get(
    "/full",
    noCache,
    requireAuth,
    requireDeveloper,
    apiRateLimit("developer"),
    apiGuard({
        path: "/api/_meta/full",
        method: "GET",
        visibility: "developer",
        description: "Complete API manifest including disabled endpoints.",
        tags: ["meta", "developer"]
    }),
    (_req, res) => {
        res.json({ ok: true, ...buildManifest() });
    }
);

/* ==========================================================================
 * Environment Diff — Developer Only
 * ==========================================================================
 * Compares the current surface against what would be exposed in a target
 * environment. Useful for verifying "what will disappear when I deploy?"
 * before merging.
 * ========================================================================== */

router.get(
    "/diff",
    noCache,
    requireAuth,
    requireDeveloper,
    apiRateLimit("developer"),
    apiGuard({
        path: "/api/_meta/diff",
        method: "GET",
        visibility: "developer",
        description: "Diff of API surface against a target environment.",
        tags: ["meta", "developer"]
    }),
    (req, res) => {
        const target = String(req.query.target || "production");
        const manifest = buildManifest();

        const currentlyEnabled = manifest.endpoints.filter((e) => e.enabled);
        const wouldEnableInTarget = currentlyEnabled.filter((e) => {
            if (e.environment === "all") return true;

            const requiredEnv =
                e.environment === "dev-only" ? "development" :
                e.environment === "staging-only" ? "staging" :
                "production";

            return requiredEnv === target;
        });

        const wouldDisable = currentlyEnabled.filter(
            (e) => !wouldEnableInTarget.includes(e)
        );
        const wouldEnable = manifest.endpoints.filter(
            (e) => !e.enabled &&
                (e.environment === "all" ||
                    (e.environment === "dev-only" && target === "development") ||
                    (e.environment === "staging-only" && target === "staging") ||
                    (e.environment === "prod-only" && target === "production"))
        );

        res.json({
            ok: true,
            current: manifest.environment,
            target,
            strict: isStrictMode(),
            wouldDisable: wouldDisable.map((e) => ({
                method: e.method,
                path: e.path,
                reason: e.environment
            })),
            wouldEnable: wouldEnable.map((e) => ({
                method: e.method,
                path: e.path,
                reason: e.environment
            }))
        });
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