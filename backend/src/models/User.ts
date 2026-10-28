import {
    Schema,
    model,
    Model,
    Types
} from "mongoose";
import bcrypt from "bcrypt";

/* ---------------- قخمثس ---------------- */
export type UserRole = "user" | "admin" | "developer";

/* ---------------- avatar ---------------- */
export interface IUserAvatar {
    url: string;
    filename: string;
    mimeType: string;
    size: number;
    uploadedAt: Date;
}

/* ---------------- pending email change ---------------- */
export interface IPendingEmail {
    newEmail: string;
    previousEmail: string;       // ✅ برای بازگشت
    oldVerified: boolean;         // ✅ آیا مرحله ۱ تمام شد؟
    expiresAt: Date;
    requestedAt: Date;
}

/* ---------------- main ---------------- */
export interface IUser {
    name: string;
    username: string;
    usernameLower: string;
    password: string;

    email: string;
    pendingEmail: IPendingEmail | null;
    emailVerified: boolean;
    emailVerifiedAt: Date | null;

    bio: string;                 // توضیحات پروفایل (Markdown)
    avatar: IUserAvatar | null;

    isBanned: boolean;

    role: UserRole;
    // نقش توسط کی داده شد؟
    roleChangedBy?: Types.ObjectId | null;
    roleChangedAt?: Date | null;
    roleChangeReason?: string | null;

    createdAt: Date;
    updatedAt: Date;
    pendingPassword?: string | null;
    pendingPasswordExpiresAt?: Date | null;
}

export interface IUserMethods {
    comparePassword(candidatePassword: string): Promise<boolean>;
}

type UserModel = Model<IUser, {}, IUserMethods>;

/* ---------------- sub-schemas ---------------- */
const avatarSchema = new Schema<IUserAvatar>(
    {
        url: { type: String, required: true },
        filename: { type: String, required: true },
        mimeType: { type: String, required: true },
        size: { type: Number, required: true },
        uploadedAt: { type: Date, default: () => new Date() }
    },
    { _id: false }
);

const pendingEmailSchema = new Schema<IPendingEmail>(
    {
        newEmail: { type: String, required: true, lowercase: true, trim: true },
        previousEmail: { type: String, required: true, lowercase: true, trim: true },
        oldVerified: { type: Boolean, default: false },
        expiresAt: { type: Date, required: true },
        requestedAt: { type: Date, default: () => new Date() }
    },
    { _id: false }
);


/* ---------------- main schema ---------------- */
const userSchema = new Schema<IUser, UserModel, IUserMethods>(
    {
        name: { type: String, required: true, trim: true, minlength: 2, maxlength: 60 },

        username: {
            type: String,
            required: true,
            trim: true,
            minlength: 3,
            maxlength: 20
        },

        usernameLower: {
            type: String,
            required: true,
            unique: true,
            index: true,
            lowercase: true,
            trim: true
        },

        email: {
            type: String,
            required: true,
            unique: true,
            index: true,
            lowercase: true,
            trim: true
        },

        emailVerified: { type: Boolean, default: false },

        emailVerifiedAt: { type: Date, default: null },

        password: {
            type: String,
            required: true,
            minlength: 6,
            select: false
        },
        pendingPassword: {
            type: String,
            select: false,
            default: null
        },
        pendingPasswordExpiresAt: {
            type: Date,
            select: false,
            default: null
        },

        bio: {
            type: String,
            default: ""
        },

        avatar: { type: avatarSchema, default: null },

        pendingEmail: { type: pendingEmailSchema, default: null },

        role: {
            type: String,
            enum: ["user", "admin", "developer"],
            default: "user",
            index: true
        },

        roleChangedBy: {
            type: Schema.Types.ObjectId,
            ref: "User",
            default: null
        },
        roleChangedAt: { type: Date, default: null },
        roleChangeReason: { type: String, maxlength: 300, default: null },

        isBanned: { type: Boolean, default: false }
    },
    { timestamps: true }
);

/* ---------------- hooks ---------------- */
userSchema.pre("validate", function () {
    if (this.isModified("username") || !this.usernameLower) {
        this.usernameLower = (this.username || "").toLowerCase().trim();
    }
});

userSchema.pre("save", async function () {
    if (this.isModified("password")) {
        const salt = await bcrypt.genSalt(12);
        this.password = await bcrypt.hash(this.password, salt);
    }

    if (this.isModified("pendingPassword") && this.pendingPassword) {
        const salt = await bcrypt.genSalt(12);
        this.pendingPassword = await bcrypt.hash(this.pendingPassword, salt);
    }
});

userSchema.method("comparePassword", async function (candidate: string) {
    return bcrypt.compare(candidate, this.password);
});

export const User = model<IUser, UserModel>("User", userSchema);

/**
 * Copyright (c) 2026 Sobhan Rasoulzadeh Asl (Sobhan-SRZA / Mr. Sinre)
 *
 * Licensed under the BSD 3-Clause License.
 * See the LICENSE file in the project root for license information.
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */