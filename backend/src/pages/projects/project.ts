import { optionalAuth } from "../../middleware/auth";
import { Router } from "express";
import { Project } from "../../models/Project";
import { Types } from "mongoose";

const router = Router();

router.get("/:idOrSlug", optionalAuth, async (req, res) => {
    const idOrSlug = req.params.idOrSlug;
    let seo: {
        title?: string;
        description?: string;
        keywords?: string;
        canonicalPath?: string;
        ogImage?: string;
        jsonLd?: object;
    } = {
        title: "پروژه",
        description: "مشاهده جزئیات، امتیاز و نظرات پروژه در DevHub",
        canonicalPath: `/projects/${idOrSlug}`,
    };

    try {
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
                "title slug shortDescription images rating reviewCount downloads views owner status"
            )
            .populate("owner", "name username")
            .lean();

        if (project) {
            const title = project.title;
            const description =
                (project.shortDescription || "").slice(0, 300) ||
                `پروژه ${title} در DevHub`;
            const firstImage =
                Array.isArray(project.images) && project.images.length
                    ? (project.images as any[])
                          .slice()
                          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))[0]
                          ?.url
                    : undefined;

            seo = {
                title,
                description,
                keywords: `${title}, پروژه متن‌باز, DevHub, اپن سورس`,
                canonicalPath: `/projects/${project.slug || idOrSlug}`,
                ogImage: firstImage || undefined,
                jsonLd: {
                    "@context": "https://schema.org",
                    "@type": "SoftwareApplication",
                    name: title,
                    description,
                    applicationCategory: "DeveloperApplication",
                    operatingSystem: "Any",
                    aggregateRating:
                        (project.reviewCount || 0) > 0
                            ? {
                                  "@type": "AggregateRating",
                                  ratingValue: Number(project.rating) || 0,
                                  ratingCount: project.reviewCount,
                                  bestRating: 5,
                                  worstRating: 0,
                              }
                            : undefined,
                    interactionStatistic: [
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
                    ],
                },
            };
        }
    } catch {
        // در صورت خطا همان متای پیش‌فرض
    }

    res.render("projects/show", {
        idOrSlug,
        seo,
        req,
    });
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
