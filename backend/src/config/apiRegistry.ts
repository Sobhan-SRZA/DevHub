/**
 * Central registry of API endpoints. Populated lazily as `apiGuard()` is
 * invoked during router construction. Consumed by the manifest endpoint
 * and boot-time diagnostics.
 */

import type {
    ApiDeclaration,
    ApiEnvironment,
    ApiManifest,
    ApiManifestEntry,
    ApiVisibility,
    AppEnvironment,
    RegisteredApi
} from "../types/api";

/* -------------------- State -------------------- */

const registry = new Map<string, RegisteredApi>();

/** Feature flags resolved once at boot from `FEATURE_FLAGS`. */
let featureFlags: Record<string, boolean> = {};

/** App environment resolved once at boot. */
let appEnvironment: AppEnvironment = "development";

/** Whether undeclared routes are rejected. */
let strictMode = false;

/** Build version reported in the manifest. */
let buildVersion = "unknown";

/* -------------------- Helpers -------------------- */

function registryKey(method: string, path: string): string {
    return `${method.toUpperCase()} ${path}`;
}

/**
 * Maps `NODE_ENV` and `APP_ENV` into a single application environment.
 * `APP_ENV` takes precedence when set, allowing staging to run with
 * `NODE_ENV=production` without ambiguity.
 */
function resolveEnvironment(): AppEnvironment {
    const explicit = (process.env.APP_ENV || "").toLowerCase();

    if (explicit === "production" || explicit === "prod") return "production";
    if (explicit === "staging" || explicit === "stage") return "staging";
    if (explicit === "development" || explicit === "dev") return "development";

    const nodeEnv = (process.env.NODE_ENV || "development").toLowerCase();

    if (nodeEnv === "production") return "production";
    if (nodeEnv === "staging") return "staging";

    return "development";
}

/**
 * Parses `FEATURE_FLAGS` as a comma-separated list of enabled flags.
 * Example: `FEATURE_FLAGS=beta-ui,new-search`.
 */
function parseFeatureFlags(): Record<string, boolean> {
    const raw = process.env.FEATURE_FLAGS || "";
    const flags: Record<string, boolean> = {};

    for (const name of raw.split(",").map((s) => s.trim()).filter(Boolean)) {
        flags[name] = true;
    }

    return flags;
}

/* -------------------- Initialization -------------------- */

/**
 * Loads environment, feature flags, and version metadata. Must be called
 * once during application boot, before any router is mounted.
 */
export function initializeApiRegistry(): void {
    appEnvironment = resolveEnvironment();
    featureFlags = parseFeatureFlags();
    strictMode =
        process.env.API_STRICT === "true" ||
        (appEnvironment === "production" && process.env.API_STRICT !== "false");

    try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        buildVersion = require("../../package.json").version || "unknown";
    } catch {
        buildVersion = "unknown";
    }

    console.log(
        `[apiRegistry] environment=${appEnvironment} strict=${strictMode} ` +
        `flags=[${Object.keys(featureFlags).join(", ") || "none"}]`
    );
}

/* -------------------- Registration -------------------- */

/** Registers a declaration. Called by `apiGuard()`. */
export function registerApiRoute(
    declaration: ApiDeclaration,
    handlers: RegisteredApi["handlers"]
): void {
    const key = registryKey(declaration.method, declaration.path);

    if (registry.has(key)) {
        console.warn(
            `[apiRegistry] Duplicate declaration for ${key}; overwriting.`
        );
    }

    registry.set(key, { declaration, handlers });
}

/** Returns all registered declarations. */
export function getRegisteredApis(): RegisteredApi[] {
    return Array.from(registry.values());
}

/** Returns the number of registered endpoints. */
export function getApiCount(): number {
    return registry.size;
}

/* -------------------- Filtering -------------------- */

/**
 * Determines whether the declaration is enabled in the current environment.
 * Returns `{ enabled, reason }` so the caller can produce a diagnostic.
 */
export function evaluateDeclaration(decl: ApiDeclaration): {
    enabled: boolean;
    reason?: string;
} {
    const env = decl.environment || "all";

    // 1. Environment gate
    if (env !== "all") {
        const requiredEnv =
            env === "dev-only" ? "development" :
                env === "staging-only" ? "staging" :
                    "production";

        if (appEnvironment !== requiredEnv) {
            return {
                enabled: false,
                reason: `restricted to ${requiredEnv}`
            };
        }
    }

    // 2. Feature flag gate
    if (decl.featureFlag && !featureFlags[decl.featureFlag]) {
        return {
            enabled: false,
            reason: `feature flag "${decl.featureFlag}" is off`
        };
    }

    return { enabled: true };
}

/* -------------------- Manifest -------------------- */

/** Builds the manifest consumed by `/api/_meta`. */
export function buildManifest(): ApiManifest {
    const endpoints: ApiManifestEntry[] = [];
    const byVisibility: Record<ApiVisibility, number> = {
        public: 0,
        authenticated: 0,
        admin: 0,
        developer: 0,
        internal: 0
    };
    const byEnvironment: Record<ApiEnvironment, number> = {
        "dev-only": 0,
        "staging-only": 0,
        "prod-only": 0,
        all: 0
    };

    let enabled = 0;
    let disabled = 0;

    for (const { declaration: d } of registry.values()) {
        const env = d.environment || "all";
        const { enabled: isEnabled, reason } = evaluateDeclaration(d);

        if (isEnabled) enabled++;
        else disabled++;

        byVisibility[d.visibility]++;
        byEnvironment[env]++;

        endpoints.push({
            path: d.path,
            method: d.method,
            visibility: d.visibility,
            environment: env,
            enabled: isEnabled,
            reason,
            description: d.description,
            tags: d.tags || [],
            featureFlag: d.featureFlag
        });
    }

    return {
        environment: appEnvironment,
        strict: strictMode,
        version: buildVersion,
        generatedAt: new Date().toISOString(),
        featureFlags: { ...featureFlags },
        endpoints,
        summary: {
            total: registry.size,
            enabled,
            disabled,
            byVisibility,
            byEnvironment
        }
    };
}

/* -------------------- Diagnostics -------------------- */

/** Returns the resolved environment. */
export function getAppEnvironment(): AppEnvironment {
    return appEnvironment;
}

/** Returns whether strict mode is active. */
export function isStrictMode(): boolean {
    return strictMode;
}

/** Returns the current feature flag state. */
export function getFeatureFlags(): Record<string, boolean> {
    return { ...featureFlags };
}

/**
 * Copyright (c) 2026 Sobhan Rasoulzadeh Asl (Sobhan-SRZA / Mr. Sinre)
 *
 * Licensed under the BSD 3-Clause License.
 * See the LICENSE file in the project root for license information.
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */