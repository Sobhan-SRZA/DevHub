
import { VerificationCode } from "../models/VerificationCode";
import { TagType } from "../models/TagType";
import { Project } from "../models/Project";
import { Session } from "../models/Session";
import { User } from "../models/User";
import { Tag } from "../models/Tag";

/**
 * Synchronizes database indexes across all registered models.
 *
 * Removes the legacy TTL index from the VerificationCode collection when
 * its expiration configuration differs from the expected value, then
 * synchronizes indexes for all supported models.
 */
export async function syncAllIndexes(): Promise<void> {
    console.log("Synchronizing database indexes...");

    try {
        // Remove the legacy TTL index if its expiration configuration is outdated.
        try {
            const indexes = await VerificationCode.collection.indexes();
            const legacyTtlIndex = indexes.find(
                (index) => index.name === "expiresAt_1"
            );

            if (
                legacyTtlIndex &&
                legacyTtlIndex.expireAfterSeconds !== 0
            ) {
                console.log(
                    "Removing the legacy TTL index from VerificationCode..."
                );

                await VerificationCode.collection.dropIndex("expiresAt_1");
            }
        } catch (error: unknown) {
            const indexError = error as {
                code?: number;
                message?: string;
            };

            // MongoDB error code 27 indicates that the requested index was not found.
            if (indexError.code !== 27) {
                console.warn(
                    "Failed to remove the legacy TTL index:",
                    indexError.message ?? error
                );
            }
        }

        // Synchronize indexes across all registered models.
        await Promise.all([
            VerificationCode.syncIndexes(),
            User.syncIndexes(),
            Session.syncIndexes(),
            Tag.syncIndexes(),
            TagType.syncIndexes(),
            Project.syncIndexes(),
        ]);

        console.log("Database index synchronization completed successfully.");
    } catch (error: unknown) {
        console.error("Database index synchronization failed:", error);
    }
}

/**
 * Deletes expired and consumed verification codes.
 *
 * Expired codes are removed regardless of their consumption status.
 * Consumed codes are also removed to prevent previously used codes from
 * accumulating in the database.
 *
 * @returns The number of expired and consumed verification codes deleted.
 */
export async function cleanupVerificationCodes(): Promise<{
    expired: number;
    consumed: number;
}> {
    const now = new Date();

    const [expired, consumed] = await Promise.all([
        VerificationCode.deleteMany({
            expiresAt: { $lte: now },
        }),
        VerificationCode.deleteMany({
            consumedAt: { $ne: null },
        }),
    ]);

    console.log(
        `Verification code cleanup completed: ${expired.deletedCount} expired, ${consumed.deletedCount} consumed.`
    );

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