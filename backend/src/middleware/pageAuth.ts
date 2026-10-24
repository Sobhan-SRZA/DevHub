import type {
    Response,
    NextFunction
} from "express";
import { verifyToken } from "../utils/token";
import { Session } from "../models/Session";
import { User } from "../models/User";

export async function pageAuth(req: any, res: Response, next: NextFunction) {
    try {
        const token = req.cookies?.access_token;
        if (!token) {
            return res.redirect("/auth/login");
        }

        const payload = verifyToken(token);
        if (payload.typ !== "access") {
            return res.redirect("/auth/login");
        }

        const session = await Session.findOne({
            sessionId: payload.sid,
            expiresAt: { $gt: new Date() }
        });
        if (!session) {
            return res.redirect("/auth/login");
        }

        const user = await User
            .findById(payload.sub)
            .select("name username email emailVerified emailVerifiedAt avatar bio role createdAt pendingEmail")
            .lean();

        if (!user) {
            return res.redirect("/auth/login");
        }

        if (user.isBanned) {
            res.clearCookie('access_token');
            res.clearCookie('refresh_token');
            
            return res.redirect('/auth/login');
        }

        req.user = user;
        req.session = session;

        return next();
    }

    catch {
        return res.redirect("/auth/login");
    }
}

/**
 * Copyright (c) 2026 Sobhan Rasoulzadeh Asl (Sobhan-SRZA / Mr. Sinre)
 *
 * Licensed under the BSD 3-Clause License.
 * See the LICENSE file in the project root for license information.
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */