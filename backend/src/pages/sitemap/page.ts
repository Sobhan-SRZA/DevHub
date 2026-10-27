import { Router } from "express";
import { Project } from "../../models/Project";
import { User } from "../../models/User";

const router = Router();

function baseFromReq(req: any): string {
    if (process.env.APP_URL) {
        return String(process.env.APP_URL).replace(/\/$/, "");
    }
    const proto = req.get("x-forwarded-proto") || req.protocol || "https";
    const host = req.get("x-forwarded-host") || req.get("host") || "localhost";
    return `${proto}://${host}`.replace(/\/$/, "");
}

function escapeXml(s: string): string {
    return String(s)
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

    let projectUrls: { loc: string; lastmod?: string; changefreq: string; priority: string }[] = [];
    let userUrls: { loc: string; changefreq: string; priority: string }[] = [];

    try {
        const projects = await Project.find({
            status: "published",
            isPublic: true,
        })
            .select("slug updatedAt")
            .sort({ updatedAt: -1 })
            .limit(5000)
            .lean();

        projectUrls = projects.map((p) => ({
            loc: `/projects/${p.slug}`,
            lastmod: p.updatedAt
                ? new Date(p.updatedAt as Date).toISOString()
                : undefined,
            changefreq: "weekly",
            priority: "0.7",
        }));
    } catch {
        // ignore
    }

    try {
        const users = await User.find({ isBanned: { $ne: true } })
            .select("username updatedAt")
            .sort({ updatedAt: -1 })
            .limit(2000)
            .lean();

        userUrls = users
            .filter((u) => u.username)
            .map((u) => ({
                loc: `/users/${u.username}`,
                changefreq: "weekly",
                priority: "0.5",
            }));
    } catch {
        // ignore
    }

    const all = [...staticUrls, ...projectUrls, ...userUrls];

    const body =
        `<?xml version="1.0" encoding="UTF-8"?>\n` +
        `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
        all
            .map((u) => {
                let line = `  <url>\n    <loc>${escapeXml(base + u.loc)}</loc>\n`;
                if ((u as any).lastmod) {
                    line += `    <lastmod>${(u as any).lastmod}</lastmod>\n`;
                } else {
                    line += `    <lastmod>${now}</lastmod>\n`;
                }
                line += `    <changefreq>${u.changefreq}</changefreq>\n`;
                line += `    <priority>${u.priority}</priority>\n`;
                line += `  </url>`;
                return line;
            })
            .join("\n") +
        `\n</urlset>\n`;

    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.send(body);
});

// Alias: /sitemap.xml is loaded as /sitemap from folder name.
// Also register explicit xml path via middleware in app if needed.
export default router;

/**
 * Copyright (c) 2026 Sobhan Rasoulzadeh Asl (Sobhan-SRZA / Mr. Sinre)
 *
 * Licensed under the BSD 3-Clause License.
 * See the LICENSE file in the project root for license information.
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */
