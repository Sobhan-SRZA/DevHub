
/**
 * Advanced Spam Detection Service
 *
 * Features:
 * - Persian / English text normalization
 * - Table-aware repeated-word detection
 * - Adaptive repetition scoring
 * - URL and suspicious-link detection
 * - Obfuscation and invisible-character detection
 * - HTML / JavaScript injection pattern detection
 * - Normalized duplicate-content detection
 * - Explainable risk score: 0..100
 *
 * Copyright (c) 2026 Sobhan Rasoulzadeh Asl
 * SPDX-License-Identifier: BSD-3-Clause
 */

import crypto from 'node:crypto';
import { cacheGet, cacheSet } from './cache';
import { AppError } from '../utils/AppError';
import { ErrorCodes } from '../utils/errorCodes';

/* ================================================================
   Types
   ================================================================ */

export interface SpamCheckOptions {
    minLength?: number;
    maxLinks?: number;
    checkHashDuplicate?: boolean;
    userId?: string;
    field?: string;

    /**
     * متن حاوی جدول‌های متنی یا ساختاریافته است.
     * در صورت true، تشخیص تکرار کلمات محافظه‌کارانه‌تر می‌شود.
     */
    allowTables?: boolean;

    /**
     * بررسی محتوای HTML / JavaScript خطرناک.
     * این گزینه جایگزین sanitization امنیتی نیست.
     */
    checkInjection?: boolean;

    /**
     * حداقل تعداد تکرار یک کلمه برای بررسی آماری.
     */
    repeatedWordThreshold?: number;
}

export interface SpamCheckResult {
    isSpam: boolean;
    score: number;
    reasons: string[];
    messages: string[];
    warnings: string[];
}

interface WordStats {
    totalWords: number;
    uniqueWords: number;
    repeatedWords: number;
    repeatedOccurrences: number;
    maxFrequency: number;
    repetitionRatio: number;
}

interface Rule {
    weight: number;
    reason: string;
    message: string;
    warning?: boolean;
}

/* ================================================================
   Configuration
   ================================================================ */

const SPAM_THRESHOLD = 50;
const WARN_THRESHOLD = 30;

const INVISIBLE_CHARACTERS =
    /[\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/gu;

const DIACRITICS = /[\u064B-\u065F\u0670\u06D6-\u06ED]/gu;

const URL_REGEX =
    /(?:https?:\/\/|www\.)[^\s<>"'`]+/giu;

const URL_SHORTENERS = new Set([
    'bit.ly',
    'tinyurl.com',
    'goo.gl',
    'ow.ly',
    'is.gd',
    'buff.ly',
    'shorturl.at',
    'cutt.ly',
    'rebrand.ly',
    't.co',
    'lnkd.in',
    'rb.gy',
    'tiny.one',
]);

const SUSPICIOUS_PHRASES = [
    // فارسی
    'کلیک کنید',
    'پول رایگان',
    'برنده شوید',
    'کسب درآمد',
    'درآمد میلیونی',
    'اینترنت رایگان',
    'قیمت باورنکردنی',
    'فقط امروز',
    'تخفیف ویژه',
    'فرصت محدود',

    // English
    'click here',
    'free money',
    'win prize',
    'buy now',
    'limited time',
    'earn money',
    'make money online',
    'invest now',
    'follow me',
    'check my profile',
];

const HIGH_RISK_PHRASES = [
    'free money',
    'پول رایگان',
    'make money online',
    'درآمد میلیونی',
];

/* ================================================================
   Normalization
   ================================================================ */

function normalizeText(text: string): string {
    return text
        .normalize('NFKC')
        .replace(INVISIBLE_CHARACTERS, '')
        .replace(DIACRITICS, '')
        .replace(/[يى]/g, 'ی')
        .replace(/ك/g, 'ک')
        .replace(/\u0640/g, '')
        .replace(/\u00A0/g, ' ')
        .toLowerCase()
        .trim();
}

/**
 * برای مقایسه عبارت‌های مشکوک،
 * فاصله‌های متوالی را به یک فاصله تبدیل می‌کند.
 */
function normalizeForMatching(text: string): string {
    return normalizeText(text)
        .replace(/[^\p{L}\p{N}\s]/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * متن را به خطوط قابل بررسی تقسیم می‌کند.
 */
function getLines(text: string): string[] {
    return text.split(/\r\n?|\n/);
}

/* ================================================================
   Table Detection
   ================================================================ */

/**
 * تشخیص تقریبی ردیف‌های جدول:
 * - جدول Markdown
 * - ستون‌های جداشده با Tab
 * - تگ‌های table / tr / td / th
 *
 * این تشخیص عمداً محافظه‌کارانه است تا متن عادی
 * که فقط چند علامت | دارد، خودکار جدول محسوب نشود.
 */
function isTableLine(line: string): boolean {
    const trimmed = line.trim();

    if (!trimmed) return false;

    if (/<\/?(?:table|thead|tbody|tfoot|tr|td|th)\b/i.test(trimmed)) {
        return true;
    }

    if (trimmed.includes('\t')) {
        return true;
    }

    const pipeCount = (trimmed.match(/\|/g) || []).length;

    if (pipeCount >= 2) {
        return true;
    }

    // ردیف جداکننده جدول Markdown
    if (/^\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?$/.test(trimmed)) {
        return true;
    }

    return false;
}

function getNonTableText(text: string, allowTables: boolean): string {
    if (!allowTables) return text;

    return getLines(text)
        .filter((line) => !isTableLine(line))
        .join('\n');
}

/* ================================================================
   Word Statistics
   ================================================================ */

function tokenizeWords(text: string): string[] {
    return normalizeText(text)
        .match(/[\p{L}\p{N}]+/gu) || [];
}

function analyzeRepeatedWords(text: string): WordStats {
    const words = tokenizeWords(text).filter(
        (word) => word.length > 2
    );

    const frequencies = new Map<string, number>();

    for (const word of words) {
        frequencies.set(
            word,
            (frequencies.get(word) || 0) + 1
        );
    }

    let repeatedWords = 0;
    let repeatedOccurrences = 0;
    let maxFrequency = 0;

    for (const frequency of frequencies.values()) {
        maxFrequency = Math.max(maxFrequency, frequency);

        if (frequency >= 10) {
            repeatedWords++;
            repeatedOccurrences += frequency - 1;
        }
    }

    return {
        totalWords: words.length,
        uniqueWords: frequencies.size,
        repeatedWords,
        repeatedOccurrences,
        maxFrequency,
        repetitionRatio:
            words.length > 0
                ? repeatedOccurrences / words.length
                : 0,
    };
}

/* ================================================================
   Character Analysis
   ================================================================ */

function getMaxRepeatedCharRun(text: string): number {
    let maxRun = 0;
    let currentRun = 0;
    let previousChar = '';

    for (const char of text) {
        if (char === previousChar) {
            currentRun++;
        } else {
            previousChar = char;
            currentRun = 1;
        }

        maxRun = Math.max(maxRun, currentRun);
    }

    return maxRun;
}

function getCapsRatio(text: string): number {
    const latinLetters = text.match(/[a-z]/gi) || [];

    if (latinLetters.length < 30) return 0;

    const uppercase = (text.match(/[A-Z]/g) || []).length;

    return uppercase / latinLetters.length;
}

function hasSuspiciousInvisibleChars(text: string): boolean {
    // کاراکترهای نامرئی داخل کلمات، نه صرفاً هر استفاده‌ای از آن‌ها
    return /[\p{L}\p{N}][\u200B\u200C\u200D\u2060\uFEFF][\p{L}\p{N}]/u.test(
        text
    );
}

/* ================================================================
   URL Analysis
   ================================================================ */

function extractUrls(text: string): string[] {
    return text.match(URL_REGEX) || [];
}

function getDomain(url: string): string {
    try {
        const cleaned = url.replace(/[),.;!?]+$/g, '');
        const parsed = new URL(
            /^https?:\/\//i.test(cleaned)
                ? cleaned
                : `https://${cleaned}`
        );

        return parsed.hostname
            .replace(/^www\./i, '')
            .toLowerCase();
    } catch {
        return '';
    }
}

function countShortenerUrls(urls: string[]): number {
    return urls.filter((url) => {
        const domain = getDomain(url);

        return [...URL_SHORTENERS].some(
            (shortener) =>
                domain === shortener ||
                domain.endsWith(`.${shortener}`)
        );
    }).length;
}

/* ================================================================
   Duplicate Content
   ================================================================ */

function hashContent(text: string): string {
    const canonical = normalizeForMatching(text);

    return crypto
        .createHash('sha256')
        .update(canonical, 'utf8')
        .digest('hex');
}

/* ================================================================
   Main Spam Check
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
        field,
        allowTables = true,
        checkInjection = true,
        repeatedWordThreshold = 10,
    } = options;

    const result: SpamCheckResult = {
        isSpam: false,
        score: 0,
        reasons: [],
        messages: [],
        warnings: [],
    };

    if (typeof text !== 'string' || !text.trim()) {
        return result;
    }

    const normalized = normalizeText(text);
    const matchingText = normalizeForMatching(text);

    const add = (rule: Rule): void => {
        // از ثبت چندباره یک دلیل جلوگیری می‌شود.
        if (result.reasons.includes(rule.reason)) return;

        result.score += rule.weight;
        result.reasons.push(rule.reason);
        result.messages.push(rule.message);

        if (rule.warning) {
            result.warnings.push(rule.message);
        }
    };

    /* ------------------------------------------------------------
       1. Short content
       ------------------------------------------------------------ */

    if (normalized.length < minLength) {
        add({
            weight: 10,
            reason: 'TOO_SHORT',
            message: 'متن برای ارزیابی بسیار کوتاه است.',
            warning: true,
        });
    }

    /* ------------------------------------------------------------
       2. Excessive repeated characters
       ------------------------------------------------------------ */

    const maxCharRun = getMaxRepeatedCharRun(normalized);

    if (maxCharRun >= 30) {
        add({
            weight: 40,
            reason: 'REPEATED_CHARS',
            message: 'تکرار غیرعادی کاراکترها شناسایی شد.',
        });
    } else if (maxCharRun >= 15) {
        add({
            weight: 25,
            reason: 'REPEATED_CHARS',
            message: 'تعداد کاراکترهای تکراری زیاد است.',
        });
    } else if (maxCharRun >= 8) {
        add({
            weight: 10,
            reason: 'REPEATED_CHARS',
            message: 'تکرار طولانی یک کاراکتر مشاهده شد.',
            warning: true,
        });
    }

    /* ------------------------------------------------------------
       3. Repeated words
       ------------------------------------------------------------ */

    const textForWordAnalysis = getNonTableText(
        normalized,
        allowTables
    );

    const wordStats = analyzeRepeatedWords(textForWordAnalysis);

    // متن کوتاه و متن‌های دارای واژگان بسیار محدود،
    // با نسبت تکرار به‌تنهایی اسپم محسوب نمی‌شوند.
    if (wordStats.totalWords >= 30) {
        const repetitionRatio = wordStats.repetitionRatio;
        const threshold = Math.max(10, repeatedWordThreshold);

        if (
            wordStats.repeatedWords >= 5 &&
            repetitionRatio >= 0.35
        ) {
            add({
                weight: 35,
                reason: 'REPEATED_WORDS',
                message: 'تکرار گسترده کلمات در متن شناسایی شد.',
            });
        } else if (
            wordStats.repeatedWords >= 3 &&
            repetitionRatio >= 0.2
        ) {
            add({
                weight: 20,
                reason: 'REPEATED_WORDS',
                message: 'تکرار کلمات بیشتر از حد معمول است.',
                warning: true,
            });
        } else if (
            wordStats.maxFrequency >= threshold &&
            repetitionRatio >= 0.12
        ) {
            add({
                weight: 10,
                reason: 'REPEATED_WORDS',
                message: 'یک یا چند کلمه بیش از حد تکرار شده‌اند.',
                warning: true,
            });
        }
    }

    /* ------------------------------------------------------------
       4. Excessive links
       ------------------------------------------------------------ */

    const urls = extractUrls(text);

    if (urls.length > maxLinks * 2) {
        add({
            weight: 35,
            reason: 'TOO_MANY_LINKS',
            message: `تعداد لینک‌ها (${urls.length}) بسیار زیاد است.`,
        });
    } else if (urls.length > maxLinks) {
        add({
            weight: 20,
            reason: 'TOO_MANY_LINKS',
            message: `تعداد لینک‌ها (${urls.length}) از حد مجاز بیشتر است.`,
            warning: true,
        });
    }

    /* ------------------------------------------------------------
       5. URL shorteners
       ------------------------------------------------------------ */

    const shortenerCount = countShortenerUrls(urls);

    if (shortenerCount >= 3) {
        add({
            weight: 25,
            reason: 'URL_SHORTENER',
            message: 'استفاده مکرر از لینک‌های کوتاه‌کننده شناسایی شد.',
        });
    } else if (shortenerCount > 0) {
        add({
            weight: 8,
            reason: 'URL_SHORTENER',
            message: 'لینک کوتاه‌کننده در متن وجود دارد.',
            warning: true,
        });
    }

    /* ------------------------------------------------------------
       6. Excessive uppercase
       ------------------------------------------------------------ */

    const capsRatio = getCapsRatio(text);

    if (capsRatio >= 0.9) {
        add({
            weight: 25,
            reason: 'CAPS_LOCK',
            message: 'استفاده غیرعادی از حروف بزرگ انگلیسی.',
        });
    } else if (capsRatio >= 0.75) {
        add({
            weight: 12,
            reason: 'CAPS_LOCK',
            message: 'نسبت حروف بزرگ انگلیسی بالاست.',
            warning: true,
        });
    }

    /* ------------------------------------------------------------
       7. Suspicious phrases
       ------------------------------------------------------------ */

    const suspiciousHits = SUSPICIOUS_PHRASES.filter(
        (phrase) =>
            matchingText.includes(normalizeForMatching(phrase))
    );

    const highRiskHits = HIGH_RISK_PHRASES.filter(
        (phrase) =>
            matchingText.includes(normalizeForMatching(phrase))
    );

    if (suspiciousHits.length >= 3) {
        add({
            weight: 25,
            reason: 'SUSPICIOUS_KEYWORDS',
            message: 'چند عبارت تبلیغاتی مشکوک در متن مشاهده شد.',
            warning: true,
        });
    } else if (suspiciousHits.length > 0) {
        add({
            weight: 8,
            reason: 'SUSPICIOUS_KEYWORDS',
            message: 'عبارت تبلیغاتی مشکوک در متن وجود دارد.',
            warning: true,
        });
    }

    // عبارت مشکوک به‌تنهایی کافی نیست؛ باید همراه نشانه دیگری باشد.
    if (highRiskHits.length >= 2 && urls.length > 0) {
        add({
            weight: 20,
            reason: 'HIGH_RISK_PROMOTION',
            message: 'ترکیب عبارات پرریسک تبلیغاتی و لینک شناسایی شد.',
        });
    }

    /* ------------------------------------------------------------
       8. HTML / JavaScript injection patterns
       ------------------------------------------------------------ */

    if (checkInjection) {
        const injectionPatterns = [
            /<script\b[^>]*>/i,
            /<iframe\b[^>]*>/i,
            /<object\b[^>]*>/i,
            /<embed\b[^>]*>/i,
            /javascript\s*:/i,
            /\bonerror\s*=/i,
            /\bonload\s*=/i,
            /\bonclick\s*=/i,
        ];

        if (injectionPatterns.some((pattern) => pattern.test(text))) {
            add({
                weight: 50,
                reason: 'HTML_INJECTION',
                message: 'الگوی بالقوه خطرناک HTML یا JavaScript شناسایی شد.',
            });
        }
    }

    /* ------------------------------------------------------------
       9. Invisible character obfuscation
       ------------------------------------------------------------ */

    if (hasSuspiciousInvisibleChars(text)) {
        add({
            weight: 15,
            reason: 'INVISIBLE_CHAR_OBFUSCATION',
            message: 'کاراکتر نامرئی در میان حروف یا ارقام شناسایی شد.',
            warning: true,
        });
    }

    /* ------------------------------------------------------------
       10. Duplicate content
       ------------------------------------------------------------ */

    if (checkHashDuplicate && userId && normalized.length > 20) {
        const hash = hashContent(text);

        // تفکیک فیلدها مانع برخورد ناخواسته شرح پروژه
        // با محتوای پروفایل می‌شود.
        const scope = field || 'default';
        const cacheKey =
            `spam:hash:${userId}:${scope}:${hash}`;

        const existing = cacheGet<number>(cacheKey);

        if (existing !== undefined && existing !== null) {
            add({
                weight: 50,
                reason: 'DUPLICATE_CONTENT',
                message: 'محتوای یکسان قبلاً در این فیلد ارسال شده است.',
            });
        } else {
            cacheSet(cacheKey, Date.now(), 24 * 60 * 60);
        }
    }

    /* ------------------------------------------------------------
       Final result
       ------------------------------------------------------------ */

    result.score = Math.min(100, result.score);
    result.isSpam = result.score >= SPAM_THRESHOLD;

    if (result.isSpam || result.score < WARN_THRESHOLD) {
        result.warnings = [];
    }

    console.log("🚀 ~ checkSpam ~ result:", result)
    return result;
}

/* ================================================================
   Controller Helper
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
            'محتوای شما مشکوک به اسپم است. لطفاً متن را اصلاح کنید.',
            {
                field: options.field,
                details: {
                    score: result.score,
                    reasons: result.reasons,
                    messages: result.messages,
                }
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