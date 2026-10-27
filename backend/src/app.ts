import { errorHandler } from "./middleware/errorHandler";
import {
    securityHeaders,
    apiLimiter,
    rejectSuspiciousPaths,
    compressionMiddleware,
} from "./middleware/security";
import cookieParser from "cookie-parser";
import loadRoutes from "./lib/loader";
import express from "express";
import path from "path";

const app = express();

/* ---------- Trust proxy (nginx / cloudflare) ---------- */
if (process.env.TRUST_PROXY === "1" || process.env.NODE_ENV === "production") {
    app.set("trust proxy", 1);
}

/* ---------- Hardening ---------- */
app.disable("x-powered-by");
app.use(rejectSuspiciousPaths);
app.use(securityHeaders());
app.use(compressionMiddleware());

/* ---------- Body parsers ---------- */
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));
app.use(cookieParser());

/* ---------- Rate limit API ---------- */
app.use("/api", apiLimiter);

/* ---------- View engine ---------- */
app.set("view engine", "ejs");
app.set("views", path.join(process.cwd(), "frontend/views"));

/* ---------- Static: frontend public ---------- */
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
        },
    })
);

/* ---------- Static: uploads ---------- */
const UPLOAD_DIR = path.resolve(process.cwd(), "backend/uploads");
app.use(
    "/uploads",
    express.static(UPLOAD_DIR, {
        maxAge: "7d",
        index: false,
        setHeaders: (res, filePath) => {
            res.setHeader("X-Content-Type-Options", "nosniff");
            res.setHeader("X-Frame-Options", "DENY");
            if (/\.(zip|rar|7z|tar|gz)$/i.test(filePath)) {
                res.setHeader("Content-Disposition", "attachment");
            }
            // Prevent uploaded HTML/SVG from executing as pages (XSS via upload)
            if (/\.(html?|svg)$/i.test(filePath)) {
                res.setHeader("Content-Type", "application/octet-stream");
                res.setHeader("Content-Disposition", "attachment");
            }
        },
    })
);

/* ---------- SEO aliases ---------- */
app.get("/sitemap.xml", (_req, res) => {
    res.redirect(301, "/sitemap");
});

/* ---------- Routes ---------- */
const routes = [
    { dir: "pages", prefix: "" },
    { dir: "api", prefix: "/api" },
];

Promise.all(
    routes.map(async (route) => {
        await loadRoutes(app, path.join(__dirname, route.dir), route.prefix);
    })
)
    .then(() => {
        // Proper 404 — no more redirect to /api/404
        app.use((req, res) => {
            if (req.path.startsWith("/api/")) {
                return res.status(404).json({
                    ok: false,
                    code: "NOT_FOUND",
                    message: "مسیر یافت نشد",
                });
            }
            return res.status(404).render("404", { req });
        });

        app.use(errorHandler);
    })
    .catch((err) => {
        console.error("[app] route load failed:", err);
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
