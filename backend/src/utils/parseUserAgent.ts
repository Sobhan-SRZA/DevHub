import type { IDeviceInfo } from "../models/Session";
import { UAParser } from "ua-parser-js";

export function parseUserAgent(userAgent: string): IDeviceInfo {
    const parser = new UAParser(userAgent);
    const result = parser.getResult();

    let deviceType: IDeviceInfo["deviceType"] = "unknown";
    if (result.device.type === "mobile")
        deviceType = "mobile";

    else if (result.device.type === "tablet")
        deviceType = "tablet";

    else if (result.device.type)
        deviceType = "unknown";

    else if (result.browser.name)
        deviceType = "desktop";

    const isBot = /bot|crawl|spider|slurp|bingpreview/i.test(userAgent);
    if (isBot)
        deviceType = "bot";

    return {
        userAgent,
        deviceType,
        deviceVendor: result.device.vendor,
        deviceModel: result.device.model,
        os: result.os.name,
        osVersion: result.os.version,
        browser: result.browser.name,
        browserVersion: result.browser.version,
        engine: result.engine.name,
        isBot
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