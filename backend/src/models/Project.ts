import {
    Schema,
    model,
    Model,
    Types
} from "mongoose";

/* ---------------- media ---------------- */
export interface IProjectImage {
    _id?: Types.ObjectId;
    url: string;              // "/uploads/projects/images/{projectId}/xxx.jpg"
    filename: string;         // نام اصلی هنگام آپلود
    mimeType: string;
    size: number;             // bytes
    width?: number;
    height?: number;
    alt?: string;
    order: number;
    uploadedAt: Date;
}

export interface IProjectVideo {
    url: string;
    filename: string;
    mimeType: string;
    size: number;
    duration?: number;        // seconds (از metadata)
    thumbnail?: string;       // اختیاری
    uploadedAt: Date;
}

export interface IProjectFile {
    url: string;
    filename: string;         // اسم فایل اصلی
    mimeType: string;
    size: number;
    version?: string;         // "1.2.0"
    downloads: number;        // تعداد دانلود از این سایت
    uploadedAt: Date;
}

/* ---------------- GitHub ---------------- */
export interface IGitHubData {
    fullName?: string;
    description?: string | null;
    homepage?: string | null;
    language?: string | null;
    stars?: number;
    watchers?: number;
    forks?: number;
    openIssues?: number;
    downloads?: number;
    size?: number;
    license?: string | null;
    topics?: string[];
    defaultBranch?: string;
    isArchived?: boolean;
    isFork?: boolean;
    createdAtGh?: Date | null;
    updatedAtGh?: Date | null;
    pushedAtGh?: Date | null;
}

/* ---------------- main ---------------- */
export interface IProject {
    owner: Types.ObjectId;
    title: string;
    slug: string;

    /* ---------- GitHub ---------- */
    githubUrl?: string | null;
    githubRepo?: string | null;
    githubData?: IGitHubData;
    githubSyncedAt?: Date | null;
    autoSync: boolean;

    /* ---------- محتوا ---------- */
    shortDescription: string;
    fullDescription: string;

    /* ---------- Media ---------- */
    images: IProjectImage[];
    demoVideo?: IProjectVideo | null;
    downloadFile?: IProjectFile | null;

    /* ---------- آمار (auto-computed از Review) ---------- */
    rating: number;              // میانگین امتیاز (0..5)
    satisfaction: number;        // میانگین رضایت (0..100)
    reviewCount: number;         // تعداد ریویو
    downloads: number;           // تعداد کل دانلودها
    views: number;

    /* ---------- تگ‌ها ---------- */
    tags: Types.ObjectId[];

    /* ---------- وضعیت ---------- */
    status: "draft" | "published" | "archived";
    isPublic: boolean;

    // featured برای پروژه‌های ویژه
    featured: boolean;
    featuredOrder: number;

    createdAt: Date;
    updatedAt: Date;
}

export type FilterProject = Partial<IProject>;

type ProjectModel = Model<IProject>;

/* ---------------- sub-schemas ---------------- */
const githubDataSchema = new Schema<IGitHubData>(
    {
        fullName: String,
        description: { type: String, default: null },
        homepage: { type: String, default: null },
        language: { type: String, default: null },
        stars: { type: Number, default: 0, min: 0 },
        watchers: { type: Number, default: 0, min: 0 },
        forks: { type: Number, default: 0, min: 0 },
        openIssues: { type: Number, default: 0, min: 0 },
        downloads: { type: Number, default: 0, min: 0 },
        size: { type: Number, default: 0 },
        license: { type: String, default: null },
        topics: { type: [String], default: [] },
        defaultBranch: String,
        isArchived: { type: Boolean, default: false },
        isFork: { type: Boolean, default: false },
        createdAtGh: { type: Date, default: null },
        updatedAtGh: { type: Date, default: null },
        pushedAtGh: { type: Date, default: null }
    },
    { _id: false }
);

const imageSchema = new Schema<IProjectImage>(
    {
        url: { type: String, required: true },
        filename: { type: String, required: true },
        mimeType: { type: String, required: true },
        size: { type: Number, required: true },
        width: Number,
        height: Number,
        alt: String,
        order: { type: Number, default: 0 },
        uploadedAt: { type: Date, default: () => new Date() }
    },
    { _id: true }
);

const videoSchema = new Schema<IProjectVideo>(
    {
        url: { type: String, required: true },
        filename: { type: String, required: true },
        mimeType: { type: String, required: true },
        size: { type: Number, required: true },
        duration: Number,
        thumbnail: String,
        uploadedAt: { type: Date, default: () => new Date() },
    },
    { _id: false }
);

const fileSchema = new Schema<IProjectFile>(
    {
        url: { type: String, required: true },
        filename: { type: String, required: true },
        mimeType: { type: String, required: true },
        size: { type: Number, required: true },
        version: String,
        downloads: { type: Number, default: 0, min: 0 },
        uploadedAt: { type: Date, default: () => new Date() }
    },
    { _id: false }
);

/* ---------------- main schema ---------------- */
const projectSchema = new Schema<IProject, ProjectModel>(
    {
        owner: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },

        title: { type: String, required: true, trim: true, maxlength: 120 },
        slug: {
            type: String, required: true, unique: true, index: true,
            lowercase: true, trim: true, match: /^[a-z0-9-]+$/,
        },

        /* GitHub */
        githubUrl: { type: String, default: null },
        githubRepo: { type: String, default: null, index: true },
        githubData: { type: githubDataSchema, default: () => ({}) },
        githubSyncedAt: { type: Date, default: null },
        autoSync: { type: Boolean, default: true },

        /* محتوا */
        shortDescription: { type: String, required: true, trim: true, maxlength: 500 },
        fullDescription: { type: String, required: true, trim: true },

        /* media */
        images: {
            type: [imageSchema],
            default: [],
            validate: [(v: unknown[]) => v.length <= 10, "حداکثر ۱۰ تصویر"]
        },
        demoVideo: { type: videoSchema, default: null },
        downloadFile: { type: fileSchema, default: null },

        /* stats — این‌ها با reviewController آپدیت می‌شن */
        rating: { type: Number, default: 0, min: 0, max: 5, index: true },
        satisfaction: { type: Number, default: 0, min: 0, max: 100 },
        reviewCount: { type: Number, default: 0, min: 0 },
        downloads: { type: Number, default: 0, min: 0, index: true },
        views: { type: Number, default: 0, min: 0 },

        /* tags */
        tags: {
            type: [{ type: Schema.Types.ObjectId, ref: "Tag" }],
            default: [],
            validate: [(v: unknown[]) => v.length <= 20, "حداکثر ۲۰ تگ"]
        },

        /* status */
        status: {
            type: String,
            enum: ["draft", "published", "archived"],
            default: "draft",
            index: true
        },
        isPublic: { type: Boolean, default: true, index: true },
        featured: { type: Boolean, default: false, index: true },
        featuredOrder: { type: Number, default: 0 }
    },
    { timestamps: true }
);

/* ---------------- indexes ---------------- */
projectSchema.index({ owner: 1, status: 1, updatedAt: -1 });
projectSchema.index({ tags: 1, status: 1 });
projectSchema.index({ rating: -1, reviewCount: -1 });
projectSchema.index({ downloads: -1, rating: -1 });

export const Project = model<IProject, ProjectModel>("Project", projectSchema);

/**
 * Copyright (c) 2026 Sobhan Rasoulzadeh Asl (Sobhan-SRZA / Mr. Sinre)
 *
 * Licensed under the BSD 3-Clause License.
 * See the LICENSE file in the project root for license information.
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */