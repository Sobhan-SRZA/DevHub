import {
    Schema,
    model,
    Model
} from "mongoose";
import bcrypt from "bcrypt";

export interface IUser {
    name: string;
    username: string;         // نمایشی (case اصلی که کاربر انتخاب کرده)
    usernameLower: string;    // برای چک یکتایی (lowercase)
    email: string;            // همیشه lowercase
    password: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface IUserMethods {
    comparePassword(candidatePassword: string): Promise<boolean>;
}

type UserModel = Model<IUser, {}, IUserMethods>;

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

        password: {
            type: String,
            required: true,
            minlength: 6,
            select: false
        }
    },
    { timestamps: true }
);

/* ---------------- pre-validate: sync usernameLower ---------------- */
userSchema.pre("validate", function () {
    if (this.isModified("username") || !this.usernameLower) {
        this.usernameLower = (this.username || "").toLowerCase().trim();
    }
});

/* ---------------- pre-save: hash password ---------------- */
userSchema.pre("save", async function () {
    if (!this.isModified("password"))
        return;

    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});

/* ---------------- methods ---------------- */
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