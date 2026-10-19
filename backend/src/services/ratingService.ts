import { Project } from "../models/Project";
import { Review } from "../models/Review";
import { Types } from "mongoose";

/**
 * میانگین rating و satisfaction رو از روی همه‌ی reviewها حساب می‌کنه
 * و روی Project آپدیت می‌کنه.
 *
 * این تابع رو بعد از هر create/update/delete روی Review صدا بزن.
 */
export async function recalculateProjectStats(projectId: Types.ObjectId | string) {
    const [result] = await Review.aggregate([
        { $match: { project: new Types.ObjectId(String(projectId)) } },
        {
            $group: {
                _id: null,
                avgRating: { $avg: "$rating" },
                avgSatisfaction: { $avg: "$satisfaction" },
                count: { $sum: 1 }
            }
        }
    ]);

    const rating = result ? Math.round(result.avgRating * 10) / 10 : 0;
    const satisfaction = result ? Math.round(result.avgSatisfaction) : 0;
    const reviewCount = result?.count || 0;

    await Project.updateOne(
        { _id: projectId },
        {
            $set: {
                rating,
                satisfaction,
                reviewCount
            }
        }
    );

    return { rating, satisfaction, reviewCount };
}

/**
 * Copyright (c) 2026 Sobhan Rasoulzadeh Asl (Sobhan-SRZA / Mr. Sinre)
 *
 * Licensed under the BSD 3-Clause License.
 * See the LICENSE file in the project root for license information.
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */