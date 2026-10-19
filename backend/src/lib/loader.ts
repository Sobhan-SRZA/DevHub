import { pathToFileURL } from "url";
import { readdirSync } from "fs";
import { Express } from "express";
import path from "path";

export default async function loadRoutes(
    app: Express,
    directory: string,
    prefix: string = ""
) {
    const entries = readdirSync(directory, {
        withFileTypes: true
    });

    for (const entry of entries) {
        const fullPath = path.join(
            directory,
            entry.name
        );

        // Load JavaScript route files
        if (
            entry.isFile() &&
            (
                entry.name.endsWith(".js") ||
                entry.name.endsWith(".ts")
            )
        ) {
            const module = await import(
                pathToFileURL(fullPath).href
            );

            const router = entry.name.endsWith(".ts") ? module.default : module.default.default;

            if (!router) {
                console.warn(
                    `No default export found: ${fullPath}`
                );

                continue;
            }

            app.use(
                prefix || "/",
                router
            );

            console.log(
                `Loaded route: ${prefix || "/"}`
            );

            continue;
        }

        // Recursively load directories
        if (entry.isDirectory()) {
            await loadRoutes(
                app,
                fullPath,
                `${prefix}/${entry.name}`
            );
        }
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