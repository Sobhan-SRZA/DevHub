import type { Request } from "express";
import { Project } from "../../models/Project";
import { Router } from "express";
import { User } from "../../models/User";

const router = Router();

function baseFromReq(req: Request): string {
    if (process.env.APP_URL) {
        return process.env.APP_URL.replace(/\/+$/, "");
    }

    const proto = req.get("x-forwarded-proto") || req.protocol || "https";
    const host = req.get("x-forwarded-host") || req.get("host") || "localhost";

    return `${proto}://${host}`.replace(/\/+$/, "");
}

function escapeXml(value: string): string {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
}

router.get("/", async (req, res) => {
    const base = baseFromReq(req);
    const now = new Date().toISOString();

    const staticUrls = [
        { loc: "/", changefreq: "daily", priority: "1.0" },
        { loc: "/explore", changefreq: "hourly", priority: "0.9" },
        { loc: "/projects", changefreq: "daily", priority: "0.8" },
    ];

    let projectUrls: {
        loc: string;
        lastmod?: string;
        changefreq: string;
        priority: string;
    }[] = [];

    let userUrls: {
        loc: string;
        changefreq: string;
        priority: string;
    }[] = [];

    try {
        const projects = await Project.find({
            status: "published",
            isPublic: true,
        })
            .select("slug updatedAt")
            .sort({ updatedAt: -1 })
            .limit(5000)
            .lean();

        projectUrls = projects.map((project) => ({
            loc: `/projects/${project.slug}`,
            lastmod: project.updatedAt
                ? new Date(project.updatedAt as Date).toISOString()
                : undefined,
            changefreq: "weekly",
            priority: "0.7",
        }));
    } catch {
        // Continue generating the sitemap if project retrieval fails.
    }

    try {
        const users = await User.find({ isBanned: { $ne: true } })
            .select("username updatedAt")
            .sort({ updatedAt: -1 })
            .limit(2000)
            .lean();

        userUrls = users
            .filter((user) => user.username)
            .map((user) => ({
                loc: `/users/${user.username}`,
                changefreq: "weekly",
                priority: "0.5",
            }));
    } catch {
        // Continue generating the sitemap if user retrieval fails.
    }

    const all = [...staticUrls, ...projectUrls, ...userUrls];

    const body =
        `<?xml version="1.0" encoding="UTF-8"?>\n` +
        `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
        all
            .map((url) => {
                let line =
                    `  <url>\n` +
                    `    <loc>${escapeXml(base + url.loc)}</loc>\n`;

                // line += `    <lastmod>${url.lastmod || now}</lastmod>\n`;
                line += `    <changefreq>${url.changefreq}</changefreq>\n`;
                line += `    <priority>${url.priority}</priority>\n`;
                line += `  </url>`;

                return line;
            })
            .join("\n") +
        `\n</urlset>\n`;

    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.send(body);
});

// The sitemap is available at /sitemap.xml when the application maps this router accordingly.
export default router;

/**
 * Copyright (c) 2026 Sobhan Rasoulzadeh Asl (Sobhan-SRZA / Mr. Sinre)
 *
 * Licensed under the BSD 3-Clause License.
 * See the LICENSE file in the project root for license information.
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */