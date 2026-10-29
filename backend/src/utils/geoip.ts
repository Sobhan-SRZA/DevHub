
import type { ILocationInfo } from "../models/Session";
import type { Request } from "express";

/**
 * Extracts the client's IP address from an Express request.
 *
 * Checks the `X-Forwarded-For` header first, then falls back to the
 * underlying socket connection. IPv4-mapped IPv6 addresses are normalized
 * by removing the `::ffff:` prefix.
 *
 * Security note: Only trust forwarded headers when they are set by a
 * trusted reverse proxy. Otherwise, clients may spoof their IP addresses.
 *
 * @param req - Express request object.
 * @returns The client's IP address, or `0.0.0.0` if unavailable.
 */
export function getClientIp(req: Request): string {
    const forwarded = req.headers["x-forwarded-for"];

    if (typeof forwarded === "string") {
        return forwarded.split(",")[0].trim();
    }

    if (Array.isArray(forwarded) && forwarded.length > 0) {
        return forwarded[0].trim();
    }

    return (
        req.socket?.remoteAddress ||
        req.connection?.remoteAddress ||
        "0.0.0.0"
    ).replace(/^::ffff:/, "");
}

/**
 * Represents the subset of the IP geolocation provider's response
 * consumed by this application.
 */
interface IpApiResponse {
    ip?: string;
    country_name?: string;
    country_code?: string;
    region?: string;
    city?: string;
    latitude?: number;
    longitude?: number;
    timezone?: string;
    org?: string;
    error?: boolean;
    reason?: string;
}

/**
 * Determines whether an IPv4 address belongs to a private network.
 *
 * Private IPv4 ranges:
 * - 10.0.0.0/8
 * - 172.16.0.0/12
 * - 192.168.0.0/16
 *
 * Loopback addresses are also excluded from geolocation lookups.
 *
 * @param ip - IP address to validate.
 * @returns `true` if the address is a recognized private or loopback address.
 */
function isPrivateOrLoopbackIp(ip: string): boolean {
    if (ip === "::1" || ip === "127.0.0.1") {
        return true;
    }

    const ipv4Match = ip.match(
        /^(?:\:\:ffff\:)?(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/
    );

    if (!ipv4Match) {
        return false;
    }

    const octets = ipv4Match.slice(1).map(Number);

    if (octets.some((octet) => octet < 0 || octet > 255)) {
        return false;
    }

    const [first, second] = octets;

    return (
        first === 10 ||
        first === 127 ||
        (first === 172 && second >= 16 && second <= 31) ||
        (first === 192 && second === 168)
    );
}

/**
 * Retrieves approximate geographic information for a public IP address.
 *
 * Uses the ipapi.co JSON endpoint without requiring an API key.
 * Private and loopback addresses are not sent to the provider.
 *
 * Returns an IP-only fallback whenever the address is ineligible,
 * the provider returns an error, the request fails, or the request
 * times out. Geolocation data may be unavailable or approximate.
 *
 * @param ip - Client IP address to look up.
 * @returns Available geolocation information, or an IP-only fallback.
 */
export async function lookupIp(
    ip: string
): Promise<ILocationInfo> {
    const fallback: ILocationInfo = { ip };

    // Skip private and loopback addresses.
    if (!ip || isPrivateOrLoopbackIp(ip)) {
        return fallback;
    }

    try {
        const response = await fetch(
            `https://ipapi.co/${encodeURIComponent(ip)}/json/`,
            {
                headers: {
                    "User-Agent": "DevHub/1.0"
                },
                signal: AbortSignal.timeout(3000)
            }
        );

        if (!response.ok) {
            return fallback;
        }

        const data = (await response.json()) as IpApiResponse;

        if (data.error) {
            return fallback;
        }

        return {
            ip,
            ipVersion: ip.includes(":") ? 6 : 4,
            country: data.country_name,
            countryCode: data.country_code,
            region: data.region,
            city: data.city,
            latitude: data.latitude,
            longitude: data.longitude,
            timezone: data.timezone,
            isp: data.org
        };
    } catch {
        // Geolocation is optional; lookup failures must not disrupt the request.
        return fallback;
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