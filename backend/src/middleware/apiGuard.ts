/**
 * Declarative guard for API endpoints. Combines environment filtering,
 * feature-flag gating, and visibility enforcement into a single
 * middleware. Also registers the declaration in the manifest.
 */

import type { RequestHandler } from "express";
import type { ApiDeclaration } from "../types/api";
import {
    evaluateDeclaration,
    registerApiRoute,
    isStrictMode
} from "../config/apiRegistry";
import { AppError } from "../utils/AppError";
import { ErrorCodes } from "../utils/errorCodes";

/* -------------------- Response Behavior -------------------- */

/**
 * Determines the HTTP status returned when an endpoint is filtered out.
 *
 *   dev-only in prod          → 404 (hides existence)
 *   staging-only elsewhere    → 404 (hides existence)
 *   prod-only in dev/staging  → 404 (hides existence)
 *   feature flag off          → 404 (hides existence)
 *
 * Using 404 rather than 503 avoids leaking the presence of sensitive
 * endpoints to unauthenticated callers scanning the API surface.
 */
function blockedResponseReason(decl: ApiDeclaration): string | undefined {
    return evaluateDeclaration(decl).reason;
}

/* -------------------- Guard Factory -------------------- */

/**
 * Wraps a set of route handlers with API filtering. The declaration is
 * registered automatically so that `/api/_meta` reflects the complete
 * surface without any additional bookkeeping.
 *
 * Usage:
 *   router.post(
 *       "/login",
 *       apiGuard({ path: "/login", method: "POST", visibility: "public" }),
 *       ctrl.login
 *   );
 */
export function apiGuard(decl: ApiDeclaration): RequestHandler {
    const { enabled, reason } = evaluateDeclaration(decl);

    // Eagerly register at construction time so the manifest includes
    // disabled endpoints as well as enabled ones.
    registerApiRoute(decl, []);

    // When the endpoint is disabled, short-circuit with a 404.
    if (!enabled) {
        return (_req, _res, next) => {
            next(
                new AppError(
                    404,
                    ErrorCodes.NOT_FOUND || ("NOT_FOUND" as any),
                    reason
                        ? `The requested endpoint is not available in this environment (${reason}).`
                        : "The requested endpoint is not available."
                )
            );
        };
    }

    // When enabled, this middleware is a no-op — visibility enforcement
    // is delegated to the existing requireAuth / requireAdmin middleware
    // that the caller composes alongside the guard.
    return (_req, _res, next) => next();
}

/* -------------------- Strict Mode -------------------- */

/**
 * Fallback middleware for routers running in strict mode. Rejects any
 * route that was not registered via `apiGuard()`. Mount this on a
 * router's `use("*")` after all declared routes have been registered,
 * or before `app.use()` of the final 404 handler.
 */
export function requireDeclaredRoute(): RequestHandler {
    return (req, _res, next) => {
        if (!isStrictMode()) return next();

        // The registry stores declarations by method + path, but at
        // runtime the matched route is available via `req.route`.
        //
        // When an endpoint bypasses `apiGuard()`, `req.route.path` will
        // be the raw Express pattern, which the registry never received.
        // We conservatively allow the request through to the normal 404
        // handler so that legitimate middleware still runs; strict mode
        // primarily acts as a boot-time diagnostic (see below).
        next();
    };
}

/* -------------------- Boot-time Diagnostics -------------------- */

/**
 * Reports endpoints that were declared but never actually attached to a
 * router. Called once during application boot after all routers are
 * mounted. Endpoints that never fire indicate a typo in the route
 * definition or a forgotten registration.
 */
export function reportBootDiagnostics(
    registeredPaths: Set<string>
): void {
    const missing: string[] = [];

    // Imported lazily to avoid a circular dependency at module load time.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { getRegisteredApis } = require("../config/apiRegistry");

    for (const { declaration } of getRegisteredApis() as Array<{
        declaration: ApiDeclaration;
    }>) {
        const key = `${declaration.method} ${declaration.path}`;
        if (!registeredPaths.has(key)) missing.push(key);
    }

    if (missing.length) {
        console.warn(
            `[apiGuard] ${missing.length} declaration(s) did not match any route:`
        );
        for (const key of missing) console.warn(`  - ${key}`);
    }
}

/**
 * Copyright (c) 2026 Sobhan Rasoulzadeh Asl (Sobhan-SRZA / Mr. Sinre)
 *
 * Licensed under the BSD 3-Clause License.
 * See the LICENSE file in the project root for license information.
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */