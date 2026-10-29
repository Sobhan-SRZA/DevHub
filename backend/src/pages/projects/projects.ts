import { Router } from "express";
import { Types } from "mongoose";

import { optionalAuth } from "../../middleware/auth";
import { Project } from "../../models/Project";

const router = Router();

/* ==================================================================
   Constants
   ================================================================== */

/**
 * Default SEO metadata used as a fallback when the project lookup
 * fails or returns no result. All values are safe to render even
 * when the underlying data is unavailable.
 */
const DEFAULT_SEO = {
    title: "Project",
    description: "View project details, ratings, and reviews on DevHub.",
    keywords: "open source project, DevHub, developer project",
    canonicalPath: null as string | null,
    ogImage: undefined as string | undefined,
    jsonLd: undefined as object | undefined,
};

/**
 * Absolute application URL, used to construct fully-qualified links
 * inside the JSON-LD document. Falls back to relative paths when the
 * environment variable is unset.
 */
const APP_URL = (process.env.APP_URL || "").replace(/\/+$/, "");

/* ==================================================================
   Helpers
   ================================================================== */

/**
 * Truncates a string at the nearest word boundary within the given
 * limit, appending an ellipsis when truncation occurs. This keeps
 * meta descriptions readable and avoids splitting words in the
 * middle.
 */
function truncate(value: unknown, maxLength: number): string {
    if (!value) return "";

    const text = String(value).trim();

    if (text.length <= maxLength) return text;

    const slice = text.slice(0, maxLength - 1);
    const lastSpace = slice.lastIndexOf(" ");

    // Only honour the word boundary when it is not too far from the limit.
    const cut = lastSpace > maxLength * 0.6 ? slice.slice(0, lastSpace) : slice;

    return cut.trimEnd() + "…";
}

/**
 * Selects the cover image from the project's image collection, using
 * the lowest `order` value. Returns `undefined` when no images exist.
 */
function pickCoverImage(images: unknown): string | undefined {
    if (!Array.isArray(images) || images.length === 0) return undefined;

    const sorted = [...images].sort(
        (a: any, b: any) => (a?.order ?? 0) - (b?.order ?? 0)
    );

    return sorted[0]?.url || undefined;
}

/**
 * Normalises a rating value into a finite number within `[0, 5]`.
 * Returns 0 for missing or non-numeric input.
 */
function clampRating(value: unknown): number {
    const n = Number(value);

    if (!Number.isFinite(n)) return 0;

    return Math.min(5, Math.max(0, n));
}

/**
 * Converts a relative path into an absolute URL using `APP_URL`.
 * Returns the input unchanged when `APP_URL` is not configured.
 */
function absoluteUrl(path: string | undefined): string | undefined {
    if (!path) return undefined;

    return APP_URL ? `${APP_URL}${path}` : path;
}

/**
 * Builds a schema.org JSON-LD document describing the project as a
 * `SoftwareApplication`. Only fields with meaningful values are
 * included so that the resulting document stays compact and avoids
 * emitting `undefined` placeholders.
 */
function buildProjectJsonLd(params: {
    project: any;
    description: string;
    coverImage: string | undefined;
    ratingValue: number;
    ratingCount: number;
    canonicalPath: string;
}): object {
    const { project, description, coverImage, ratingValue, ratingCount, canonicalPath } = params;

    const jsonLd: Record<string, any> = {
        "@context": "https://schema.org",
        "@type": "SoftwareApplication",
        name: project.title,
        description,
        applicationCategory: "DeveloperApplication",
        operatingSystem: "Any",
        url: absoluteUrl(canonicalPath),
    };

    if (coverImage) {
        jsonLd.image = coverImage;
    }

    // Include the author when the populated owner record exposes one.
    const ownerName = project.owner?.name || project.owner?.username;
    if (ownerName) {
        jsonLd.author = {
            "@type": "Person",
            name: ownerName,
            url: project.owner?.username
                ? absoluteUrl(`/users/${encodeURIComponent(project.owner.username)}`)
                : undefined,
        };
    }

    // Only advertise a rating when at least one review exists.
    if (ratingCount > 0) {
        jsonLd.aggregateRating = {
            "@type": "AggregateRating",
            ratingValue,
            ratingCount,
            bestRating: 5,
            worstRating: 0,
        };
    }

    if (project.createdAt) {
        jsonLd.datePublished = new Date(project.createdAt).toISOString();
    }

    if (project.updatedAt) {
        jsonLd.dateModified = new Date(project.updatedAt).toISOString();
    }

    jsonLd.interactionStatistic = [
        {
            "@type": "InteractionCounter",
            interactionType: "https://schema.org/DownloadAction",
            userInteractionCount: project.downloads || 0,
        },
        {
            "@type": "InteractionCounter",
            interactionType: "https://schema.org/ViewAction",
            userInteractionCount: project.views || 0,
        },
    ];

    return jsonLd;
}

/* ==================================================================
   Routes
   ================================================================== */

/**
 * Project detail page.
 *
 * Resolves the project by ObjectId or slug, assembles SEO metadata
 * from the project's public fields, and renders the view. Any failure
 * during lookup falls back to the default metadata so that the page
 * continues to render — the client-side script is responsible for
 * displaying a "not found" state when the API returns nothing.
 */
router.get("/:idOrSlug", optionalAuth, async (req, res) => {
    const { idOrSlug } = req.params;

    // Begin from the default metadata. A successful lookup replaces
    // the relevant fields.
    let seo: typeof DEFAULT_SEO = {
        ...DEFAULT_SEO,
        canonicalPath: `/projects/${idOrSlug}`,
    };

    try {
        // Support both ObjectId-based links and slug-based links.
        const isObjectId = /^[a-f\d]{24}$/i.test(idOrSlug);

        const query = isObjectId
            ? { _id: new Types.ObjectId(idOrSlug) }
            : { slug: idOrSlug };

        const project = await Project.findOne({
            ...query,
            status: "published",
            isPublic: true,
        })
            .select(
                "title slug shortDescription images rating reviewCount " +
                "downloads views createdAt updatedAt owner"
            )
            .populate("owner", "name username")
            .lean();

        if (!project) {
            // Render the page anyway so the client-side script can
            // display its own "not found" state.
            return res.render("projects/show", { idOrSlug, seo, req });
        }

        const description =
            truncate(project.shortDescription, 300) ||
            `Project ${project.title} on DevHub`;

        const coverImage = pickCoverImage(project.images);
        const ratingValue = clampRating(project.rating);
        const ratingCount = Number(project.reviewCount) || 0;
        const canonicalPath = `/projects/${project.slug || idOrSlug}`;

        seo = {
            title: project.title,
            description,
            keywords: `${project.title}, open source, DevHub, developer project`,
            canonicalPath,
            ogImage: coverImage,
            jsonLd: buildProjectJsonLd({
                project,
                description,
                coverImage,
                ratingValue,
                ratingCount,
                canonicalPath,
            }),
        };
    } catch (err) {
        // A failed lookup must not break the page. The error is logged
        // for diagnostics while the default metadata is retained.
        console.error(
            `[projects] SEO lookup failed for "${idOrSlug}":`,
            err
        );
    }

    res.render("projects/show", { idOrSlug, seo, req });
});

/**
 * Project list view.
 *
 * The grid is populated by the client-side script, so no server-side
 * data is required beyond the layout's default metadata.
 */
router.get("/", optionalAuth, (req, res) => {
    res.render("projects/list", { req });
});

export default router;

/**
 * Copyright (c) 2026 Sobhan Rasoulzadeh Asl (Sobhan-SRZA / Mr. Sinre)
 *
 * Licensed under the BSD 3-Clause License.
 * See the LICENSE file in the project root for license information.
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */