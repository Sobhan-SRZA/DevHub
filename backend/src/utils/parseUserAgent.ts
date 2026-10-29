
import type { IDeviceInfo } from "../models/Session";
import { UAParser } from "ua-parser-js";

/**
 * Parses a user-agent string to extract device, operating system,
 * browser, rendering engine, and bot detection information.
 *
 * Device classification follows these rules:
 * - `mobile`: The user agent identifies a mobile device.
 * - `tablet`: The user agent identifies a tablet device.
 * - `desktop`: A browser is identified, but no specific mobile or tablet type is detected.
 * - `bot`: The user agent matches a known crawler or bot pattern.
 * - `unknown`: The device type cannot be reliably determined.
 *
 * Bot detection overrides the inferred device type.
 *
 * @param userAgent - Raw user-agent string from the incoming request.
 * @returns Structured device and browser information.
 */
export function parseUserAgent(userAgent: string): IDeviceInfo {
    const parser = new UAParser(userAgent);
    const result = parser.getResult();

    let deviceType: IDeviceInfo["deviceType"] = "unknown";

    if (result.device.type === "mobile") {
        deviceType = "mobile";
    } else if (result.device.type === "tablet") {
        deviceType = "tablet";
    } else if (!result.device.type && result.browser.name) {
        deviceType = "desktop";
    }

    /**
     * Identifies common search engine crawlers and automated clients.
     *
     * User-agent matching is a heuristic and should not be treated as
     * a reliable security boundary because user-agent strings can be spoofed.
     */
    const isBot = /bot|crawl|spider|slurp|bingpreview/i.test(userAgent);

    if (isBot) {
        deviceType = "bot";
    }

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