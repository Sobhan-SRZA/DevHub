
import { TagType } from "../models/TagType";
import { Tag } from "../models/Tag";

/* ==========================================================================
 * Default Tag Categories
 * ========================================================================== */

const DEFAULT_TAG_TYPES = [
    {
        name: "Programming Language",
        slug: "programming-language",
        color: "#6ebbff",
        icon: "💻",
        order: 1,
        allowUserTags: false,
        tags: [
            "JavaScript", "TypeScript", "Python", "Go", "Rust", "Java",
            "C#", "C++", "C", "PHP", "Ruby", "Swift", "Kotlin", "Dart",
            "Elixir", "Scala", "Haskell", "Lua", "R", "Perl",
        ],
    },
    {
        name: "Framework",
        slug: "framework",
        color: "#a78bfa",
        icon: "🧩",
        order: 2,
        allowUserTags: true,
        tags: [
            "React", "Vue", "Angular", "Svelte", "Next.js", "Nuxt",
            "Remix", "Astro", "Express", "NestJS", "Fastify", "Koa",
            "Django", "Flask", "FastAPI", "Laravel", "Rails", "Spring",
            "Gin", "Fiber", "Echo", "Actix", "Rocket",
        ],
    },
    {
        name: "Database",
        slug: "database",
        color: "#34d399",
        icon: "🗄️",
        order: 3,
        allowUserTags: true,
        tags: [
            "MongoDB", "PostgreSQL", "MySQL", "SQLite", "Redis",
            "Cassandra", "DynamoDB", "Elasticsearch", "Neo4j",
            "MariaDB", "Oracle", "SQL Server", "CouchDB", "Firebase",
        ],
    },
    {
        name: "SEO",
        slug: "seo",
        color: "#f59e0b",
        icon: "🔍",
        order: 4,
        allowUserTags: true,
        tags: [
            "SEO", "Google Analytics", "Search Console", "Sitemap",
            "Meta Tags", "Structured Data", "Core Web Vitals", "Backlinks",
        ],
    },
    {
        name: "DevOps",
        slug: "devops",
        color: "#ef4444",
        icon: "⚙️",
        order: 5,
        allowUserTags: true,
        tags: [
            "Docker", "Kubernetes", "CI/CD", "GitHub Actions", "GitLab CI",
            "Jenkins", "Terraform", "Ansible", "Nginx", "Apache",
            "AWS", "GCP", "Azure", "DigitalOcean", "Cloudflare",
        ],
    },
    {
        name: "Artificial Intelligence",
        slug: "ai",
        color: "#ec4899",
        icon: "🤖",
        order: 6,
        allowUserTags: true,
        tags: [
            "Machine Learning", "Deep Learning", "NLP", "Computer Vision",
            "TensorFlow", "PyTorch", "OpenAI", "LangChain", "LLM",
            "Stable Diffusion", "Hugging Face",
        ],
    },
    {
        name: "Mobile Development",
        slug: "mobile",
        color: "#06b6d4",
        icon: "📱",
        order: 7,
        allowUserTags: true,
        tags: [
            "React Native", "Flutter", "Ionic", "Capacitor",
            "Android", "iOS", "Kotlin Multiplatform", "Expo",
        ],
    },
    {
        name: "Security",
        slug: "security",
        color: "#dc2626",
        icon: "🛡️",
        order: 8,
        allowUserTags: true,
        tags: [
            "JWT", "OAuth", "Authentication", "Encryption", "HTTPS",
            "CORS", "XSS", "CSRF", "SQL Injection", "Penetration Testing",
        ],
    },
    {
        name: "Design",
        slug: "design",
        color: "#f472b6",
        icon: "🎨",
        order: 9,
        allowUserTags: true,
        tags: [
            "UI", "UX", "Figma", "Tailwind CSS", "Bootstrap",
            "Material UI", "Ant Design", "Sass", "CSS", "Responsive Design",
        ],
    },
    {
        name: "General",
        slug: "general",
        color: "#94a3b8",
        icon: "🌐",
        order: 99,
        allowUserTags: true,
        tags: [
            "Open Source", "API", "REST", "GraphQL", "WebSocket",
            "CLI", "Library", "Plugin", "Template", "Boilerplate",
        ],
    },
];

/* ==========================================================================
 * Utility Functions
 * ========================================================================== */

/**
 * Converts a string into a normalized URL-friendly slug.
 *
 * @param input - The string to convert.
 * @returns A lowercase slug containing alphanumeric characters and hyphens,
 *          limited to 40 characters.
 */
function slugify(input: string): string {
    return input
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 40);
}

/* ==========================================================================
 * Default Tag Seeding
 * ========================================================================== */

/**
 * Seeds the database with default tag categories and their associated tags.
 *
 * Existing categories and tags are preserved to prevent duplicate records.
 *
 * @returns The number of newly created categories and tags.
 */
export async function seedDefaultTags() {
    console.log("Seeding default tag categories and tags...");

    let typesCreated = 0;
    let tagsCreated = 0;

    for (const typeData of DEFAULT_TAG_TYPES) {
        const { tags: tagNames, ...typeFields } = typeData;

        // Find an existing category or create a new system-managed category.
        let type = await TagType.findOne({ slug: typeFields.slug });

        if (!type) {
            type = await TagType.create({
                ...typeFields,
                isSystem: true,
                isApproved: true,
                createdBy: null,
            });

            typesCreated++;
        }

        // Create only tags that do not already exist in this category.
        for (const tagName of tagNames) {
            const slug = slugify(tagName);

            const existingTag = await Tag.findOne({
                slug,
                type: type._id,
            });

            if (existingTag) {
                continue;
            }

            await Tag.create({
                name: tagName,
                slug,
                type: type._id,
                color: type.color,
                isSystem: true,
                isApproved: true,
                createdBy: null,
                usageCount: 0,
            });

            tagsCreated++;
        }
    }

    console.log(
        `Default tag seeding completed: ${typesCreated} categories and ${tagsCreated} tags created.`
    );

    return {
        typesCreated,
        tagsCreated,
    };
}

/**
 * Copyright (c) 2026 Sobhan Rasoulzadeh Asl (Sobhan-SRZA / Mr. Sinre)
 *
 * Licensed under the BSD 3-Clause License.
 * See the LICENSE file in the project root for license information.
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */