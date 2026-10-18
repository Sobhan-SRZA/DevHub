import { VerificationCode } from "../models/VerificationCode";
import { TagType } from "../models/TagType";
import { Project } from "../models/Project";
import { Session } from "../models/Session";
import { User } from "../models/User";
import { Tag } from "../models/Tag";

export async function syncAllIndexes() {
    console.log("🔄 Syncing database indexes…");

    try {
        // 1. حذف ایندکس قدیمی TTL از VerificationCode
        try {
            const indexes = await VerificationCode.collection.indexes();
            const oldTtl = indexes.find((i) => i.name === "expiresAt_1");

            if (oldTtl && (oldTtl as any).expireAfterSeconds !== 0) {
                console.log("🗑️  Dropping old TTL index from VerificationCode…");
                await VerificationCode.collection.dropIndex("expiresAt_1");
            }
        }

        catch (err: any) {
            if (err.code !== 27) {  // 27 = IndexNotFound
                console.warn("index drop warning:", err.message);
            }
        }

        // 2. syncIndexes روی همه مدل‌ها
        await Promise.all([
            VerificationCode.syncIndexes(),
            User.syncIndexes(),
            Session.syncIndexes(),
            Tag.syncIndexes(),
            TagType.syncIndexes(),
            Project.syncIndexes()
        ]);

        console.log("✅ All indexes synced");
    }

    catch (err) {
        console.error("❌ syncIndexes failed:", err);
    }
}

export async function cleanupVerificationCodes() {
    const now = new Date();

    const [expired, consumed] = await Promise.all([
        VerificationCode.deleteMany({ expiresAt: { $lte: now } }),
        VerificationCode.deleteMany({ consumedAt: { $ne: null } }),
    ]);

    console.log(`🧹 Cleanup: ${expired.deletedCount} expired, ${consumed.deletedCount} consumed`);

    return {
        expired: expired.deletedCount,
        consumed: consumed.deletedCount,
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