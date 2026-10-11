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
        if (!token)
            return res.redirect("/login");

        const payload = verifyToken(token);
        const session = await Session.findOne({ sessionId: payload.sid, revoked: false });
        if (!session || session.expiresAt < new Date())
            return res.redirect("/login");

        const user = await User.findById(payload.sub).lean();
        if (!user)
            return res.redirect("/login");

        req.user = user;
        req.session = session;

        next();
    }

    catch {
        return res.redirect("/login");
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