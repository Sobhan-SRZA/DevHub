
import { VerificationCode } from "../models/VerificationCode";

/**
 * Removes expired and previously consumed verification codes.
 *
 * Expired codes are deleted regardless of their consumption status.
 * Consumed codes are also removed to clean up records retained by
 * previous bugs or incomplete cleanup operations.
 *
 * @returns The number of expired and consumed verification codes deleted.
 */
export async function cleanupOldVerificationCodes() {
    const now = new Date();

    // Delete all expired verification codes, whether consumed or not.
    const expired = await VerificationCode.deleteMany({
        expiresAt: { $lte: now }
    });

    // Delete all consumed verification codes that remain in the database.
    const consumed = await VerificationCode.deleteMany({
        consumedAt: { $ne: null }
    });

    console.log(
        `Verification code cleanup completed: ${expired.deletedCount} expired, ${consumed.deletedCount} consumed.`
    );

    return {
        expired: expired.deletedCount,
        consumed: consumed.deletedCount
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