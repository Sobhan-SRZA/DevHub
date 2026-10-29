/**
 * Main Express application entry point.
 *
 * Configures proxy trust, security middleware, request parsers, rate limiting,
 * EJS views, static assets, upload serving, SEO redirects, dynamic route
 * loading, and centralized error handling.
 *
 * Copyright (c) 2026 Sobhan Rasoulzadeh Asl (Sobhan-SRZA / Mr. Sinre)
 *
 * Licensed under the BSD 3-Clause License.
 * See the LICENSE file in the project root for license information.
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import { errorHandler } from "./middleware/errorHandler";
import {
    securityHeaders,
    apiLimiter,
    rejectSuspiciousPaths,
    compressionMiddleware
} from "./middleware/security";
import cookieParser from "cookie-parser";
import loadRoutes from "./lib/loader";
import express from "express";
import path from "path";

const app = express();

/* -------------------------------------------------------------------------- */
/* Trust Proxy                                                                */
/* -------------------------------------------------------------------------- */

// Trust the first proxy when explicitly enabled or running in production.
// This supports deployments behind reverse proxies such as Nginx or Cloudflare.
if (
    process.env.TRUST_PROXY === "1" ||
    process.env.NODE_ENV === "production"
) {
    app.set("trust proxy", 1);
}

/* -------------------------------------------------------------------------- */
/* Security Hardening                                                         */
/* -------------------------------------------------------------------------- */

// Apply security middleware before processing incoming requests.
app.disable("x-powered-by");
app.use(rejectSuspiciousPaths);
app.use(securityHeaders());
app.use(compressionMiddleware());

/* -------------------------------------------------------------------------- */
/* Request Body Parsers                                                       */
/* -------------------------------------------------------------------------- */

// Limit request body sizes to reduce the risk of oversized payload attacks.
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));
app.use(cookieParser());

/* -------------------------------------------------------------------------- */
/* API Rate Limiting                                                          */
/* -------------------------------------------------------------------------- */

// Apply rate limiting to all API endpoints.
app.use("/api", apiLimiter);

/* -------------------------------------------------------------------------- */
/* View Engine                                                                */
/* -------------------------------------------------------------------------- */

// Configure EJS templates and the frontend views directory.
app.set("view engine", "ejs");
app.set("views", path.join(process.cwd(), "frontend/views"));

/* -------------------------------------------------------------------------- */
/* Static Assets: Frontend Public Directory                                   */
/* -------------------------------------------------------------------------- */

// Serve public frontend assets with environment-specific caching policies.
app.use(
    express.static(path.join(process.cwd(), "frontend/public"), {
        maxAge: process.env.NODE_ENV === "production" ? "7d" : 0,
        etag: true,
        lastModified: true,
        setHeaders: (res, filePath) => {
            res.setHeader("X-Content-Type-Options", "nosniff");

            if (/\.(css|js|svg|png|jpg|jpeg|webp|woff2?)$/i.test(filePath)) {
                res.setHeader(
                    "Cache-Control",
                    process.env.NODE_ENV === "production"
                        ? "public, max-age=604800, stale-while-revalidate=86400"
                        : "no-cache"
                );
            }
        }
    })
);

/* -------------------------------------------------------------------------- */
/* Static Assets: Uploaded Files                                              */
/* -------------------------------------------------------------------------- */

// Serve uploaded files from the backend uploads directory.
// Disable directory index listings and apply security headers to responses.
const UPLOAD_DIR = path.resolve(process.cwd(), "backend/uploads");

app.use(
    "/uploads",
    express.static(UPLOAD_DIR, {
        maxAge: "7d",
        index: false,
        setHeaders: (res, filePath) => {
            res.setHeader("X-Content-Type-Options", "nosniff");
            res.setHeader("X-Frame-Options", "DENY");

            // Force archive downloads instead of displaying them inline.
            if (/\.(zip|rar|7z|tar|gz)$/i.test(filePath)) {
                res.setHeader("Content-Disposition", "attachment");
            }

            // Prevent uploaded HTML and SVG files from executing as web pages.
            // This mitigates cross-site scripting risks associated with uploads.
            if (/\.(html?|svg)$/i.test(filePath)) {
                res.setHeader(
                    "Content-Type",
                    "application/octet-stream"
                );
                res.setHeader("Content-Disposition", "attachment");
            }
        }
    })
);

/* -------------------------------------------------------------------------- */
/* SEO Redirects                                                              */
/* -------------------------------------------------------------------------- */

// Redirect the conventional sitemap.xml URL to the sitemap endpoint.
app.get("/sitemap.xml", (_req, res) => {
    res.redirect(301, "/sitemap");
});

/* -------------------------------------------------------------------------- */
/* Dynamic Route Loading                                                      */
/* -------------------------------------------------------------------------- */

// Load page routes and API routes from their respective directories.
const routes = [
    { dir: "pages", prefix: "" },
    { dir: "api", prefix: "/api" }
];

Promise.all(
    routes.map(async (route) => {
        await loadRoutes(
            app,
            path.join(__dirname, route.dir),
            route.prefix
        );
    })
)
    .then(() => {
        /* ------------------------------------------------------------------ */
        /* Not Found Handler                                                  */
        /* ------------------------------------------------------------------ */

        // Return a JSON response for unmatched API requests and render the
        // frontend 404 page for all other unmatched routes.
        app.use((req, res) => {
            if (req.path.startsWith("/api/")) {
                return res.status(404).json({
                    ok: false,
                    code: "NOT_FOUND",
                    message: "Route not found."
                });
            }

            return res.status(404).render("404", { req });
        });

        /* ------------------------------------------------------------------ */
        /* Centralized Error Handling                                         */
        /* ------------------------------------------------------------------ */

        // Register the error handler after routes and the 404 handler so that
        // errors propagated by earlier middleware can be handled centrally.
        app.use(errorHandler);
    })
    .catch((err) => {
        // Fail fast if application routes cannot be loaded successfully.
        console.error("[app] Failed to load routes:", err);
        process.exit(1);
    });

export default app;

/**
 * Copyright (c) 2026 Sobhan Rasoulzadeh Asl (Sobhan-SRZA / Mr. Sinre)
 *
 * Licensed under the BSD 3-Clause License.
 * See the LICENSE file in the project root for license information.
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */
