import { VerificationCode } from "../models/VerificationCode";

export async function cleanupOldVerificationCodes() {
    const now = new Date();

    // 1) کدهای منقضی (چه consumed، چه نه)
    const expired = await VerificationCode.deleteMany({
        expiresAt: { $lte: now },
    });

    // 2) کدهای consumed قدیمی (باقی‌مانده از باگ قبلی)
    const consumed = await VerificationCode.deleteMany({
        consumedAt: { $ne: null },
    });

    console.log(`🧹 Cleanup: ${expired.deletedCount} expired, ${consumed.deletedCount} consumed`);
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