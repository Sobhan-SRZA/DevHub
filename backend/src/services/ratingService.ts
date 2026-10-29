
import { Project } from "../models/Project";
import { Review } from "../models/Review";
import { Types } from "mongoose";

/**
 * Recalculates a project's average rating, average satisfaction score,
 * and total review count, then updates the corresponding project record.
 *
 * Call this function after every review creation, update, or deletion
 * to keep project statistics synchronized with the review collection.
 *
 * @param projectId - The MongoDB ObjectId or string identifier of the project.
 * @returns The updated rating, satisfaction score, and review count.
 */
export async function recalculateProjectStats(
    projectId: Types.ObjectId | string
) {
    const normalizedProjectId = new Types.ObjectId(String(projectId));

    const [result] = await Review.aggregate([
        {
            $match: {
                project: normalizedProjectId,
            },
        },
        {
            $group: {
                _id: null,
                avgRating: { $avg: "$rating" },
                avgSatisfaction: { $avg: "$satisfaction" },
                count: { $sum: 1 },
            },
        },
    ]);

    // Round the average rating to one decimal place and satisfaction
    // to the nearest whole number. Use zero when no reviews exist.
    const rating = result
        ? Math.round(result.avgRating * 10) / 10
        : 0;

    const satisfaction = result
        ? Math.round(result.avgSatisfaction)
        : 0;

    const reviewCount = result?.count ?? 0;

    await Project.updateOne(
        { _id: normalizedProjectId },
        {
            $set: {
                rating,
                satisfaction,
                reviewCount,
            },
        }
    );

    return {
        rating,
        satisfaction,
        reviewCount,
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