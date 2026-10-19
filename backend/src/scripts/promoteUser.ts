import type { UserRole } from "../models/User";
import { connectDB } from "../config/db";
import { User } from "../models/User";
import mongoose from "mongoose";

/**
 * استفاده:
 *   npx tsx src/scripts/promoteUser.ts <email> <role> [reason]
 *
 * مثال:
 *   npx tsx src/scripts/promoteUser.ts ali@example.com admin "Promote for moderation"
 *   npx tsx src/scripts/promoteUser.ts sohban@example.com developer "Main dev"
 */
async function main() {
    const [, , email, role, ...reasonParts] = process.argv;
    const reason = reasonParts.join(" ");

    if (!email || !role) {
        console.error(
            "Usage: npx tsx src/scripts/promoteUser.ts <email> <user|admin|developer> [reason]"
        );

        process.exit(1);
    }

    if (!["user", "admin", "developer"].includes(role)) {
        console.error("Invalid role. Must be: user | admin | developer");

        process.exit(1);
    }

    await connectDB();

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
        console.error(`❌ User not found: ${email}`);
        await mongoose.disconnect();

        process.exit(1);
    }

    // از changeUserRole استفاده نمی‌کنیم چون changedBy نیاز داره
    // برای CLI، مستقیم ست می‌کنیم
    const previousRole = user.role;
    user.role = role as UserRole;
    user.roleChangedAt = new Date();
    user.roleChangeReason = reason || `Promoted via CLI by system`;
    await user.save();

    console.log(`✅ ${email}: ${previousRole} → ${role}`);
    if (reason)
        console.log(`   Reason: ${reason}`);

    await mongoose.disconnect();

    process.exit(0);
}

main().catch((err) => {
    console.error("❌", err);

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