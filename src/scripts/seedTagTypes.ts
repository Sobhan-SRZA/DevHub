import { TagType } from "../models/TagType";

export async function seedTagTypes() {
    const defaults = [
        { name: "زبان برنامه‌نویسی", slug: "programming-language", color: "#6ebbff", icon: "💻", order: 1 },
        { name: "فریمورک", slug: "framework", color: "#a78bfa", icon: "🧩", order: 2 },
        { name: "دیتابیس", slug: "database", color: "#34d399", icon: "🗄️", order: 3 },
        { name: "سئو", slug: "seo", color: "#f59e0b", icon: "🔍", order: 4 },
        { name: "دواپس", slug: "devops", color: "#ef4444", icon: "⚙️", order: 5 },
        { name: "هوش مصنوعی", slug: "ai", color: "#ec4899", icon: "🤖", order: 6 },
        { name: "عمومی", slug: "general", color: "#94a3b8", icon: "🌐", order: 7 },
        { name: "پرایوت", slug: "private", color: "#64748b", icon: "🔒", order: 8 },
    ];

    for (const t of defaults) {
        await TagType.updateOne(
            { slug: t.slug },
            { $setOnInsert: { ...t, isSystem: true } },
            { upsert: true }
        );
    }
    
    console.log("✅ TagTypes seeded");
}

/**
 * Copyright (c) 2026 Sobhan Rasoulzadeh Asl (Sobhan-SRZA / Mr. Sinre)
 *
 * Licensed under the BSD 3-Clause License.
 * See the LICENSE file in the project root for license information.
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */