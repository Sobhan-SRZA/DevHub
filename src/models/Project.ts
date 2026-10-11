import { Schema, model, Model, Types } from 'mongoose';

/* ---------------- GitHub cached data ---------------- */
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

export interface IProject {
    owner: Types.ObjectId;           // ref → User
    title: string;
    slug: string;                    // یکتا در کل

    /* ---------- GitHub ---------- */
    githubUrl?: string | null;       // لینک کامل
    githubRepo?: string | null;      // "owner/repo"
    githubData?: IGitHubData;        // کش داده‌های GitHub
    githubSyncedAt?: Date | null;
    autoSync: boolean;               // خودکار آپدیت کنه؟

    /* ---------- محتوا ---------- */
    shortDescription: string;
    fullDescription: string;

    /* ---------- اعداد ---------- */
    rating: number;                  // 0..5
    satisfaction: number;            // 0..100
    downloads: number;               // 0..∞ (شمارش خودمون)

    /* ---------- تگ‌ها ---------- */
    tags: Types.ObjectId[];          // ref → Tag

    /* ---------- متادیتا ---------- */
    status: 'draft' | 'published' | 'archived';
    isPublic: boolean;
    views: number;

    createdAt: Date;
    updatedAt: Date;
}

type ProjectModel = Model<IProject>;

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
        pushedAtGh: { type: Date, default: null },
    },
    { _id: false }
);

const projectSchema = new Schema<IProject, ProjectModel>(
    {
        owner: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },

        title: { type: String, required: true, trim: true, maxlength: 120 },

        slug: {
            type: String,
            required: true,
            unique: true,
            index: true,
            lowercase: true,
            trim: true,
            match: /^[a-z0-9-]+$/,
        },

        /* ---------- GitHub ---------- */
        githubUrl: { type: String, default: null },
        githubRepo: { type: String, default: null, index: true },
        githubData: { type: githubDataSchema, default: () => ({}) },
        githubSyncedAt: { type: Date, default: null },
        autoSync: { type: Boolean, default: true },

        /* ---------- محتوا ---------- */
        shortDescription: { type: String, required: true, trim: true, maxlength: 300 },
        fullDescription: { type: String, required: true, trim: true, maxlength: 20000 },

        /* ---------- اعداد ---------- */
        rating: { type: Number, default: 0, min: 0, max: 5 },
        satisfaction: { type: Number, default: 0, min: 0, max: 100 },
        downloads: { type: Number, default: 0, min: 0 },

        /* ---------- تگ‌ها ---------- */
        tags: {
            type: [{ type: Schema.Types.ObjectId, ref: 'Tag' }],
            default: [],
            validate: [(v: unknown[]) => v.length <= 20, 'حداکثر ۲۰ تگ'],
        },

        /* ---------- متادیتا ---------- */
        status: {
            type: String,
            enum: ['draft', 'published', 'archived'],
            default: 'draft',
            index: true,
        },
        isPublic: { type: Boolean, default: true, index: true },
        views: { type: Number, default: 0, min: 0 },
    },
    { timestamps: true }
);

/* ---------------- indexes ---------------- */
projectSchema.index({ owner: 1, status: 1, updatedAt: -1 });
projectSchema.index({ tags: 1, status: 1 });
projectSchema.index({ rating: -1, downloads: -1 }); // برای sort محبوبیت

export const Project = model<IProject, ProjectModel>('Project', projectSchema);

/**
 * Copyright (c) 2026 Sobhan Rasoulzadeh Asl (Sobhan-SRZA / Mr. Sinre)
 *
 * Licensed under the BSD 3-Clause License.
 * See the LICENSE file in the project root for license information.
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */