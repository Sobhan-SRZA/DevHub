/**
 * Environment detection and validation. Runs once at boot and throws
 * on misconfiguration so the process fails fast rather than serving
 * traffic with an inconsistent environment.
 */

import { initializeApiRegistry, getAppEnvironment } from "./apiRegistry";

export function initializeEnvironment(): void {
    // Initialize the API registry first; it resolves NODE_ENV/APP_ENV.
    initializeApiRegistry();

    const env = getAppEnvironment();

    // Reject dangerous configuration combinations.
    if (env === "production") {
        if (!process.env.APP_URL || process.env.APP_URL.includes("localhost")) {
            throw new Error(
                "[env] APP_URL must be set to the production domain."
            );
        }

        if (process.env.NODE_ENV !== "production") {
            console.warn(
                "[env] APP_ENV=production but NODE_ENV is not 'production'. " +
                "Express will not enable production optimizations."
            );
        }

        if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 64) {
            throw new Error(
                "[env] JWT_SECRET must be at least 64 characters in production."
            );
        }

        if (process.env.API_STRICT === "false") {
            console.warn(
                "[env] API_STRICT is explicitly disabled in production. " +
                "Undeclared endpoints will not be flagged."
            );
        }
    }

    if (env === "development" && process.env.API_STRICT === "true") {
        console.log(
            "[env] API_STRICT is enabled in development. " +
            "Only endpoints wrapped with apiGuard() will be exposed."
        );
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