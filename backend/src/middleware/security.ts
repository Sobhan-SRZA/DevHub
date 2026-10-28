import type { Request, Response, NextFunction, RequestHandler } from "express";
import zlib from "zlib";

/* ==================================================================
   Security headers (helmet-like, zero dependency)
   ================================================================== */
export function securityHeaders(): RequestHandler {
    const isProd = process.env.NODE_ENV === "production";

    return (_req, res, next) => {
        res.setHeader("X-Content-Type-Options", "nosniff");
        res.setHeader("X-Frame-Options", "DENY");
        res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
        res.setHeader("X-DNS-Prefetch-Control", "off");
        res.setHeader("X-Download-Options", "noopen");
        res.setHeader("X-Permitted-Cross-Domain-Policies", "none");
        res.setHeader(
            "Permissions-Policy",
            "camera=(), microphone=(), geolocation=(), payment=(), usb=()"
        );
        res.setHeader(
            "Content-Security-Policy",
            [
                "default-src 'self'",
                "script-src 'self' 'unsafe-inline'",
                "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
                "font-src 'self' https://fonts.gstatic.com data:",
                "img-src 'self' data: blob: https:",
                "media-src 'self' blob:",
                "connect-src 'self'",
                "frame-ancestors 'none'",
                "base-uri 'self'",
                "form-action 'self'",
                "object-src 'none'",
                isProd ? "upgrade-insecure-requests" : "",
            ]
                .filter(Boolean)
                .join("; ")
        );
        if (isProd) {
            res.setHeader(
                "Strict-Transport-Security",
                "max-age=15552000; includeSubDomains"
            );
        }
        res.removeHeader("X-Powered-By");
        next();
    };
}

/* ==================================================================
   Path traversal / null-byte rejection
   ================================================================== */
export function rejectSuspiciousPaths(
    req: Request,
    res: Response,
    next: NextFunction
) {
    const raw = req.url || "";
    let decoded = raw;
    try {
        decoded = decodeURIComponent(raw.split("?")[0] || "");
    } catch {
        return res.status(400).json({
            ok: false,
            code: "BAD_REQUEST",
            message: "درخواست نامعتبر است",
        });
    }

    if (
        raw.includes("\0") ||
        raw.includes("%00") ||
        /(?:^|[\\/])\.\.(?:[\\/]|$)/.test(decoded)
    ) {
        return res.status(400).json({
            ok: false,
            code: "BAD_REQUEST",
            message: "درخواست نامعتبر است",
        });
    }
    return next();
}

/* ==================================================================
   In-memory rate limiter
   ================================================================== */
type Bucket = { count: number; resetAt: number };

function createLimiter(options: {
    windowMs: number;
    max: number;
    message: string;
}): RequestHandler {
    const buckets = new Map<string, Bucket>();
    const { windowMs, max, message } = options;

    const timer = setInterval(() => {
        const now = Date.now();
        for (const [k, b] of buckets) {
            if (b.resetAt <= now) buckets.delete(k);
        }
    }, Math.min(windowMs, 60_000));
    if (typeof (timer as any).unref === "function") (timer as any).unref();

    return (req, res, next) => {
        const key =
            req.ip ||
            (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
            req.socket.remoteAddress ||
            "unknown";

        const now = Date.now();
        let bucket = buckets.get(key);
        if (!bucket || bucket.resetAt <= now) {
            bucket = { count: 0, resetAt: now + windowMs };
            buckets.set(key, bucket);
        }

        bucket.count += 1;

        res.setHeader("RateLimit-Limit", String(max));
        res.setHeader(
            "RateLimit-Remaining",
            String(Math.max(0, max - bucket.count))
        );
        res.setHeader(
            "RateLimit-Reset",
            String(Math.ceil(bucket.resetAt / 1000))
        );

        if (bucket.count > max) {
            res.setHeader(
                "Retry-After",
                String(Math.ceil((bucket.resetAt - now) / 1000))
            );
            return res.status(429).json({
                ok: false,
                code: "RATE_LIMITED",
                message,
            });
        }
        return next();
    };
}

export const apiLimiter = createLimiter({
    windowMs: 15 * 60 * 1000,
    max: 400,
    message: "تعداد درخواست‌ها زیاد است. کمی بعد دوباره تلاش کنید.",
});

export const authLimiter = createLimiter({
    windowMs: 15 * 60 * 1000,
    max: 30,
    message: "تلاش‌های ورود/ثبت‌نام زیاد است. ۱۵ دقیقه دیگر تلاش کنید.",
});

export const sensitiveLimiter = createLimiter({
    windowMs: 60 * 60 * 1000,
    max: 10,
    message: "درخواست‌های حساس بیش از حد مجاز است. بعداً تلاش کنید.",
});

/* ==================================================================
   Compression — use `compression` package if installed, else zlib
   ================================================================== */
export function compressionMiddleware(): RequestHandler {
    try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const compression = require("compression");
        return compression({ threshold: 1024, level: 6 });
    } catch {
        return nativeCompression();
    }
}

function nativeCompression(): RequestHandler {
    return (req, res, next) => {
        const accept = req.headers["accept-encoding"] || "";
        if (
            req.method === "HEAD" ||
            req.headers["x-no-compress"] ||
            !/(gzip|deflate)/i.test(String(accept))
        ) {
            return next();
        }

        const useGzip = /gzip/i.test(String(accept));
        const encoding = useGzip ? "gzip" : "deflate";
        const rawEnd = res.end.bind(res);
        let ended = false;
        const chunks: Buffer[] = [];

        (res as any).write = (chunk: any, encodingOrCb?: any, cb?: any) => {
            if (chunk) {
                chunks.push(
                    Buffer.isBuffer(chunk)
                        ? chunk
                        : Buffer.from(chunk, encodingOrCb)
                );
            }
            if (typeof encodingOrCb === "function") 
                encodingOrCb();
            
            else if (typeof cb === "function") 
                cb();

            return true;
        };

        (res as any).end = (chunk?: any, encodingOrCb?: any, cb?: any) => {
            if (ended) 
                return res;

            ended = true;
            if (chunk) {
                chunks.push(
                    Buffer.isBuffer(chunk)
                        ? chunk
                        : Buffer.from(
                            chunk,
                            typeof encodingOrCb === "string"
                                ? (encodingOrCb as BufferEncoding)
                                : undefined
                        )
                );
            }

            const body = Buffer.concat(chunks);
            const type = String(res.getHeader("Content-Type") || "");
            const alreadyEncoded = res.getHeader("Content-Encoding");
            const tooSmall = body.length < 1024;
            const uncompressible =
                /image\/|video\/|audio\/|application\/(zip|gzip|octet-stream)/i.test(
                    type
                );

            if (alreadyEncoded || tooSmall || uncompressible) {
                if (typeof encodingOrCb === "function")
                    return rawEnd(body, encodingOrCb);
                if (typeof cb === "function") return rawEnd(body, cb);
                return rawEnd(body);
            }

            const compressFn =
                encoding === "gzip" ? zlib.gzipSync : zlib.deflateSync;
            let compressed: Buffer;
            try {
                compressed = compressFn(body, { level: 6 });
            } catch {
                if (typeof encodingOrCb === "function")
                    return rawEnd(body, encodingOrCb);
                if (typeof cb === "function") return rawEnd(body, cb);
                return rawEnd(body);
            }

            res.setHeader("Content-Encoding", encoding);
            res.setHeader("Vary", "Accept-Encoding");
            res.removeHeader("Content-Length");
            res.setHeader("Content-Length", String(compressed.length));

            if (typeof encodingOrCb === "function")
                return rawEnd(compressed, encodingOrCb);
            if (typeof cb === "function") return rawEnd(compressed, cb);
            return rawEnd(compressed);
        };

        next();
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
