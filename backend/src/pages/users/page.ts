import { Router } from "express";
import { Types } from "mongoose";
import { User } from "../../models/User";
import noCache from "../../middleware/noCache";
import { optionalAuth } from "../../middleware/auth";

const router = Router();

router.get("/:idOrUsername", async (req, res) => {
    const { idOrUsername } = req.params;

    let seo: {
        title?: string;
        description?: string;
        canonicalPath?: string;
        ogImage?: string;
        jsonLd?: object;
    } = {
        title: "User Profile",
        description: "Discover developer profiles on DevHub.",
        canonicalPath: `/users/${idOrUsername}`,
    };

    try {
        const isObjectId = /^[a-f\d]{24}$/i.test(idOrUsername);

        const query = isObjectId
            ? { _id: new Types.ObjectId(idOrUsername) }
            : { usernameLower: idOrUsername.toLowerCase() };

        const user = await User.findOne({
            ...query,
            isBanned: { $ne: true },
        })
            .select("name username bio avatar")
            .lean();

        if (user) {
            const display = user.name || user.username || idOrUsername;

            const bio = (user.bio || "")
                .replace(/[#*_\`>\[\]()]/g, "")
                .slice(0, 200);

            seo = {
                title: display,
                description:
                    bio ||
                    `Discover ${display}'s profile, open-source projects, and contributions on DevHub.`,
                canonicalPath: `/users/${user.username || idOrUsername}`,
                ogImage: user.avatar?.url || undefined,
                jsonLd: {
                    "@context": "https://schema.org",
                    "@type": "Person",
                    name: display,
                    description: bio || undefined,
                    image: user.avatar?.url || undefined,
                },
            };
        }
    } catch {
        // Fall back to the default SEO metadata if an error occurs.
    }

    res.render("pages/users/show", {
        idOrUsername,
        seo,
        req,
    });
});

router.get("/", optionalAuth, noCache, (req, res) => {
    res.render("pages/users/list", { req });
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