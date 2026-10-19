import { errorHandler } from "./middleware/errorHandler";
import cookieParser from "cookie-parser";
import loadRoutes from "./lib/loader";
import express from "express";
import dotenv from "dotenv";
import path from "path";

dotenv.config();

const app = express();

// Middleware
app.use(express.json({ limit: "2mb" }));           // برای JSON
app.use(express.urlencoded({ extended: true, limit: "2mb" }));
app.use(cookieParser());


// Set EJS as the view engine
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "../views"));


// Serve static files (your CSS, client-side JS)
app.use(
    express.static(
        path.join(__dirname, "../public")
    )
);

/* ==================================================================
   Static — uploads
   ================================================================== */
const UPLOAD_DIR = path.resolve(process.cwd(), "uploads");
app.use(
    "/uploads",
    express.static(UPLOAD_DIR, {
        maxAge: "7d",
        index: false,
        setHeaders: (res) => {
            res.setHeader("X-Content-Type-Options", "nosniff");
        }
    })
);

// --- Routes ---
const routes = [
    {
        dir: "pages",
        prefix: ""
    },
    {
        dir: "api",
        prefix: "/api"
    }
];

Promise.all(
    routes.map(async route => {
        await loadRoutes(
            app,
            path.join(__dirname, route.dir),
            route.prefix
        );
    })
)

// Redirect all invalid URLs to /404
setTimeout(() => {
    app.use((req, res) => {
        res.redirect("/api/404");
    });

    // error handler — MUST be last
    app.use(errorHandler);
}, 1000);


export default app;

/**
 * Copyright (c) 2026 Sobhan Rasoulzadeh Asl (Sobhan-SRZA / Mr. Sinre)
 *
 * Licensed under the BSD 3-Clause License.
 * See the LICENSE file in the project root for license information.
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */