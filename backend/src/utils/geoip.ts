import type { ILocationInfo } from '../models/Session';
import type { Request } from 'express';

export function getClientIp(req: Request): string {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string') {
        return forwarded.split(',')[0].trim();
    }

    if (Array.isArray(forwarded) && forwarded.length) {
        return forwarded[0];
    }

    return (
        req.socket?.remoteAddress ||
        req.connection?.remoteAddress ||
        '0.0.0.0'
    ).replace(/^::ffff:/, ''); // strip IPv6-mapped IPv4 prefix
}


interface IpApiResponse {
    ip: string;
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

export async function lookupIp(ip: string): Promise<ILocationInfo> {
    const fallback: ILocationInfo = { ip };

    // skip private / loopback IPs
    if (
        ip === '127.0.0.1' ||
        ip === '::1' ||
        ip.startsWith('192.168.') ||
        ip.startsWith('10.') ||
        /^172\.(1[6-9]|2\d|3[01])\./.test(ip)
    ) {
        return fallback;
    }

    try {
        // free tier — no API key needed (45 req/min)
        const res = await fetch(`https://ipapi.co/${ip}/json/`, {
            headers: { 'User-Agent': 'myapp/1.0' },
            signal: AbortSignal.timeout(3000),
        });

        if (!res.ok)
            return fallback;

        const data = (await res.json()) as IpApiResponse;
        if (data.error)
            return fallback;

        return {
            ip,
            ipVersion: ip.includes(':') ? 6 : 4,
            country: data.country_name,
            countryCode: data.country_code,
            region: data.region,
            city: data.city,
            latitude: data.latitude,
            longitude: data.longitude,
            timezone: data.timezone,
            isp: data.org
        };
    }

    catch {
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