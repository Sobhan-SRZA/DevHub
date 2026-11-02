/**
 * Shared types for the API registry and filtering middleware.
 */

import type { RequestHandler } from "express";

/* ==========================================================================
 * Enumerations
 * ========================================================================== */

/**
 * Determines who may access the endpoint.
 *
 *   public        — no authentication required
 *   authenticated — a valid session is required
 *   admin         — admin or developer role required
 *   developer     — developer role only
 *   internal      — never exposed; callable only from server-side code
 */
export type ApiVisibility =
    | "public"
    | "authenticated"
    | "admin"
    | "developer"
    | "internal";

/**
 * Deployment environments an endpoint may be exposed in. Endpoints are
 * assumed to be available in every environment unless one of these is set.
 *
 *   dev-only     — development only; hidden from staging and production
 *   staging-only — staging only; hidden from development and production
 *   prod-only    — production only; hidden from development and staging
 *   all          — available everywhere (default)
 */
export type ApiEnvironment =
    | "dev-only"
    | "staging-only"
    | "prod-only"
    | "all";

/* ==========================================================================
 * Declaration
 * ========================================================================== */

export interface ApiRateLimit {
    /** Window duration in milliseconds. */
    windowMs: number;
    /** Maximum requests permitted within the window. */
    max: number;
}

/**
 * Declarative metadata for an endpoint. Registered automatically when
 * `apiGuard()` is used, and exposed via the `/api/_meta` manifest.
 */
export interface ApiDeclaration {
    /** Route path relative to its router mount point (e.g. "/login"). */
    path: string;
    /** HTTP method. */
    method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    /** Who may access the endpoint. */
    visibility: ApiVisibility;
    /** Deployment environments in which the endpoint is available. */
    environment?: ApiEnvironment;
    /** Human-readable description used in the manifest and docs. */
    description?: string;
    /** Optional per-endpoint rate limit. Overrides the visibility default. */
    rateLimit?: ApiRateLimit;
    /** Optional feature flag key. When set, the endpoint is disabled unless the flag is on. */
    featureFlag?: string;
    /** Tags for grouping in the manifest. */
    tags?: string[];
}

/* ==========================================================================
 * Manifest
 * ========================================================================== */

export type AppEnvironment = "development" | "staging" | "production";

export interface ApiManifestEntry {
    path: string;
    method: string;
    visibility: ApiVisibility;
    environment: ApiEnvironment;
    enabled: boolean;
    reason?: string;
    description?: string;
    tags: string[];
    featureFlag?: string;
}

export interface ApiManifest {
    environment: AppEnvironment;
    strict: boolean;
    version: string;
    generatedAt: string;
    featureFlags: Record<string, boolean>;
    endpoints: ApiManifestEntry[];
    summary: {
        total: number;
        enabled: number;
        disabled: number;
        byVisibility: Record<ApiVisibility, number>;
        byEnvironment: Record<ApiEnvironment, number>;
    };
}

/* ==========================================================================
 * Internal
 * ========================================================================== */

/**
 * A stored declaration paired with the handlers that were attached. The
 * handler list is retained only for boot-time diagnostics; it is never
 * returned by the manifest.
 */
export interface RegisteredApi {
    declaration: ApiDeclaration;
    handlers: RequestHandler[];
}

/**
 * Copyright (c) 2026 Sobhan Rasoulzadeh Asl (Sobhan-SRZA / Mr. Sinre)
 *
 * Licensed under the BSD 3-Clause License.
 * See the LICENSE file in the project root for license information.
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */