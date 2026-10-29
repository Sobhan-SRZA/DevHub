
import type { UserRole } from "../models/User";
import { connectDB } from "../config/db";
import { User } from "../models/User";
import mongoose from "mongoose";

/**
 * Promotes or demotes a user by updating their assigned role.
 *
 * Usage:
 *   npx tsx src/scripts/promoteUser.ts <email> <role> [reason]
 *
 * Examples:
 *   npx tsx src/scripts/promoteUser.ts ali@example.com admin "Promote for moderation"
 *   npx tsx src/scripts/promoteUser.ts sobhan@example.com developer "Main developer"
 */
async function main() {
    const [, , email, role, ...reasonParts] = process.argv;
    const reason = reasonParts.join(" ");

    // Validate required command-line arguments.
    if (!email || !role) {
        console.error(
            "Usage: npx tsx src/scripts/promoteUser.ts <email> <user|admin|developer> [reason]"
        );

        process.exit(1);
    }

    // Ensure the requested role is supported.
    if (!["user", "admin", "developer"].includes(role)) {
        console.error(
            "Invalid role. Allowed values: user, admin, developer."
        );

        process.exit(1);
    }

    await connectDB();

    const normalizedEmail = email.toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
        console.error(`User not found: ${normalizedEmail}`);
        await mongoose.disconnect();

        process.exit(1);
    }

    // Update the role directly because this CLI operation does not provide
    // the changedBy field required by the changeUserRole utility.
    const previousRole = user.role;

    user.role = role as UserRole;
    user.roleChangedAt = new Date();
    user.roleChangeReason =
        reason || "Role updated via CLI by the system";

    await user.save();

    console.log(
        `Role updated successfully: ${normalizedEmail} (${previousRole} -> ${role})`
    );

    if (reason) {
        console.log(`Reason: ${reason}`);
    }

    await mongoose.disconnect();

    process.exit(0);
}

main().catch(async (error: unknown) => {
    console.error("Failed to update user role:", error);

    await mongoose.disconnect().catch(() => undefined);

    process.exit(1);
});

/**
 * Copyright (c) 2026 Sobhan Rasoulzadeh Asl (Sobhan-SRZA / Mr. Sinre)
 *
 * Licensed under the BSD 3-Clause License.
 * See the LICENSE file in the project root for license information.
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */