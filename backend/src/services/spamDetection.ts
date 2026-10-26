/**
 * Spam Detection Service
 * - تشخیص ۹ نوع اسپم
 * - امتیازدهی (0-100)
 * - نتیجه: isSpam (score >= 50) یا warning (score >= 30)
 */

import crypto from 'crypto';
import { cacheGet, cacheSet } from './cache';
import { AppError } from '../utils/AppError';
import { ErrorCodes } from '../utils/errorCodes';

/* ================================================================
   Types
   ================================================================ */
export interface SpamCheckOptions {
    /** حداقل طول متن — متن کوتاه‌تر از این مقدار مشکوک است */
    minLength?: number;
    /** حداکثر تعداد لینک مجاز */
    maxLinks?: number;
    /** اگر true، متن‌های یکسان در ۲۴ ساعت اخیر رو spam در نظر بگیر */
    checkHashDuplicate?: boolean;
    /** userId (برای چک duplicate content) */
    userId?: string;
    /** فیلد (برای context لاگ) */
    field?: string;
}

export interface SpamCheckResult {
    isSpam: boolean;
    score: number;              // 0..100
    reasons: string[];          // کدهای دلیل
    messages: string[];         // پیام‌های فارسی برای هر دلیل
    warnings: string[];         // پیام‌های هشدار (نه اسپم، ولی مشکوک)
}

/* ================================================================
   Constants
   ================================================================ */
const SPAM_THRESHOLD = 50;      // score >= 50 → اسپم
const WARN_THRESHOLD = 30;      // score >= 30 → هشدار

// کلمات و عبارات مشکوک (فارسی + انگلیسی)
const SUSPICIOUS_KEYWORDS = [
    // فارسی
    'کلیک کنید', 'رایگان', 'پول رایگان', 'جایزه', 'برنده شوید',
    'کسب درآمد', 'درآمد میلیونی', 'اینترنت رایگان', 'خرید سریع',
    'قیمت باورنکردنی', 'فقط امروز', 'تخفیف ویژه', 'فرصت محدود',
    // انگلیسی
    'click here', 'free money', 'win prize', 'buy now',
    'limited time', 'earn money', 'make money online',
    'crypto', 'bitcoin', 'nft', 'invest now',
    'viagra', 'cialis', 'weight loss', 'lose weight',
    'casino', 'poker', 'betting', 'lottery',
    'subscribe', 'follow me', 'check my profile',
];

// دامنه‌های کوتاه‌کننده لینک
const URL_SHORTENERS = [
    'bit.ly', 'tinyurl.com', 'goo.gl', 'ow.ly', 'is.gd',
    'buff.ly', 'shorturl.at', 'cutt.ly', 'rebrand.ly',
    't.co', 'lnkd.in', 'rb.gy', 'tiny.one',
];

/* ================================================================
   Helpers
   ================================================================ */
function hashContent(text: string): string {
    return crypto
        .createHash('sha256')
        .update(text.trim().toLowerCase())
        .digest('hex')
        .slice(0, 32);
}

function extractUrls(text: string): string[] {
    const urlRegex = /(https?:\/\/[^\s<>"']+|www\.[^\s<>"']+)/gi;
    return text.match(urlRegex) || [];
}

function getDomain(url: string): string {
    try {
        const u = new URL(url.startsWith('http') ? url : `https://${url}`);
        return u.hostname.replace(/^www\./, '').toLowerCase();
    } catch {
        return '';
    }
}

function countRepeatedChars(text: string): number {
    // حداکثر run از یک کاراکتر تکراری
    const matches = text.match(/(.)\1{2,}/g) || [];
    let maxRun = 0;
    for (const m of matches) {
        if (m.length > maxRun) maxRun = m.length;
    }
    return maxRun;
}

function countRepeatedWords(text: string): number {
    // تعداد کلماتی که بیش از ۱۰ بار تکرار شدن
    const words = text
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s]/gu, '')
        .split(/\s+/)
        .filter((w) => w.length > 2);

    const counts: Record<string, number> = {};
    for (const w of words) counts[w] = (counts[w] || 0) + 1;

    return Object.values(counts).filter((c) => c >= 10).length;
}

function getCapsRatio(text: string): number {
    const letters = text.replace(/[^A-Za-zآ-ی]/g, '');
    if (letters.length < 30) return 0;
    const uppercase = (text.match(/[A-Z]/g) || []).length;
    return uppercase / letters.length;
}

/* ================================================================
   Main Check
   ================================================================ */
export async function checkSpam(
    text: string,
    options: SpamCheckOptions = {}
): Promise<SpamCheckResult> {
    const {
        minLength = 5,
        maxLinks = 5,
        checkHashDuplicate = false,
        userId,
    } = options;

    const result: SpamCheckResult = {
        isSpam: false,
        score: 0,
        reasons: [],
        messages: [],
        warnings: [],
    };

    if (!text || typeof text !== 'string') {
        return result;
    }

    const trimmed = text.trim();
    const lower = trimmed.toLowerCase();

    const add = (weight: number, reason: string, message: string, isWarn = false) => {
        result.score += weight;
        result.reasons.push(reason);
        result.messages.push(message);
        if (isWarn) result.warnings.push(message);
    };

    /* ---------------- 1) متن خیلی کوتاه ---------------- */
    if (trimmed.length < minLength) {
        add(15, 'TOO_SHORT', 'متن بسیار کوتاه است');
    }

    /* ---------------- 2) کاراکتر تکراری ---------------- */
    const maxCharRun = countRepeatedChars(trimmed);
    if (maxCharRun >= 20) {
        add(40, 'REPEATED_CHARS', `${maxCharRun} کاراکتر تکراری پشت سر هم`);
    } else if (maxCharRun >= 10) {
        add(20, 'REPEATED_CHARS', 'کاراکتر تکراری زیاد است');
    }

    /* ---------------- 3) کلمه تکراری ---------------- */
    const repeatedWords = countRepeatedWords(trimmed);
    if (repeatedWords >= 5) {
        add(35, 'REPEATED_WORDS', 'کلمات زیادی تکرار شده‌اند');
    } else if (repeatedWords >= 3) {
        add(20, 'REPEATED_WORDS', 'کلمات تکراری زیاد است');
    }

    /* ---------------- 4) لینک زیاد ---------------- */
    const urls = extractUrls(trimmed);
    if (urls.length > maxLinks * 2) {
        add(35, 'TOO_MANY_LINKS', `${urls.length} لینک در متن — حداکثر ${maxLinks} مجاز است`);
    } else if (urls.length > maxLinks) {
        add(20, 'TOO_MANY_LINKS', `${urls.length} لینک در متن`);
    }

    /* ---------------- 5) URL shortener ---------------- */
    const shortenerHits = urls.filter((u) => {
        const domain = getDomain(u);
        return URL_SHORTENERS.some((s) => domain === s || domain.endsWith(`.${s}`));
    });

    if (shortenerHits.length >= 2) {
        add(25, 'URL_SHORTENER', 'استفاده از لینک کوتاه‌کننده');
    } else if (shortenerHits.length === 1) {
        add(10, 'URL_SHORTENER', 'استفاده از لینک کوتاه‌کننده', true);
    }

    /* ---------------- 6) CAPS LOCK ---------------- */
    const capsRatio = getCapsRatio(trimmed);
    if (capsRatio > 0.8) {
        add(25, 'CAPS_LOCK', 'نسبت حروف بزرگ به کوچک غیرعادی است');
    } else if (capsRatio > 0.65) {
        add(12, 'CAPS_LOCK', 'حروف بزرگ زیاد است', true);
    }

    /* ---------------- 7) کلمات مشکوک ---------------- */
    const suspiciousHits = SUSPICIOUS_KEYWORDS.filter((kw) => lower.includes(kw));
    if (suspiciousHits.length >= 3) {
        add(40, 'SUSPICIOUS_KEYWORDS', 'کلمات تبلیغاتی/اسپم شناسایی شد');
    } else if (suspiciousHits.length >= 1) {
        add(15, 'SUSPICIOUS_KEYWORDS', `کلمات مشکوک: ${suspiciousHits.slice(0, 3).join(', ')}`, true);
    }

    /* ---------------- 8) تلاش برای HTML injection ---------------- */
    if (/<script|javascript:|onerror=|onclick=/i.test(trimmed)) {
        add(50, 'HTML_INJECTION', 'تلاش برای تزریق کد HTML');
    }

    /* ---------------- 9) محتوای تکراری (hash) ---------------- */
    if (checkHashDuplicate && userId && trimmed.length > 20) {
        const hash = hashContent(trimmed);
        const cacheKey = `spam:hash:${userId}:${hash}`;

        const existing = cacheGet<number>(cacheKey);
        if (existing) {
            add(50, 'DUPLICATE_CONTENT', 'همین محتوا قبلاً ارسال شده است');
        } else {
            // ذخیره به مدت ۲۴ ساعت
            cacheSet(cacheKey, Date.now(), 24 * 60 * 60);
        }
    }

    /* ---------------- نتیجه ---------------- */
    result.score = Math.min(100, result.score);
    result.isSpam = result.score >= SPAM_THRESHOLD;

    // پاک کردن warningها اگه isSpam
    if (result.isSpam) {
        result.warnings = [];
    } else if (result.score < WARN_THRESHOLD) {
        result.warnings = [];
    }

    return result;
}

/* ================================================================
   Helper for Controllers
   ================================================================ */
export async function assertNotSpam(
    text: string,
    options: SpamCheckOptions = {}
): Promise<void> {
    const result = await checkSpam(text, options);

    if (result.isSpam) {
        throw new AppError(
            400,
            ErrorCodes.SPAM_DETECTED,
            'محتوای شما مشکوک به اسپم است. لطفاً متن را اصلاح کنید',
            {
                score: result.score,
                reasons: result.reasons,
                messages: result.messages,
                field: options.field,
            }
        );
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