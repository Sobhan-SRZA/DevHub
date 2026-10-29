
import crypto from "node:crypto";
import { cacheGet, cacheSet } from "./cache";
import { AppError } from "../utils/AppError";
import { ErrorCodes } from "../utils/errorCodes";

/**
 * Advanced spam detection service.
 *
 * Features:
 * - Persian and English text normalization
 * - Table-aware repeated-word detection
 * - Adaptive repetition scoring
 * - URL and suspicious-link detection
 * - Obfuscation and invisible-character detection
 * - HTML and JavaScript injection pattern detection
 * - Normalized duplicate-content detection
 * - Explainable risk scoring from 0 to 100
 *
 * Copyright (c) 2026 Sobhan Rasoulzadeh Asl
 * SPDX-License-Identifier: BSD-3-Clause
 */

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
     * Indicates that the content may contain textual or structured tables.
     * When enabled, repeated-word analysis excludes detected table rows
     * to reduce false positives.
     */
    allowTables?: boolean;

    /**
     * Enables detection of potentially dangerous HTML and JavaScript
     * patterns. This is not a substitute for security sanitization.
     */
    checkInjection?: boolean;

    /**
     * Minimum word frequency required for statistical repetition analysis.
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
    /(?:https?:\/\/|www\.)[^\s<>""`]+/giu;

const URL_SHORTENERS = new Set([
    "bit.ly",
    "tinyurl.com",
    "goo.gl",
    "ow.ly",
    "is.gd",
    "buff.ly",
    "shorturl.at",
    "cutt.ly",
    "rebrand.ly",
    "t.co",
    "lnkd.in",
    "rb.gy",
    "tiny.one",
]);

const SUSPICIOUS_PHRASES = [
    // Persian promotional phrases.
    "کلیک کنید",
    "پول رایگان",
    "برنده شوید",
    "کسب درآمد",
    "درآمد میلیونی",
    "اینترنت رایگان",
    "قیمت باورنکردنی",
    "فقط امروز",
    "تخفیف ویژه",
    "فرصت محدود",

    // English promotional phrases.
    "click here",
    "free money",
    "win prize",
    "buy now",
    "limited time",
    "earn money",
    "make money online",
    "invest now",
    "follow me",
    "check my profile",
];

const HIGH_RISK_PHRASES = [
    "free money",
    "پول رایگان",
    "make money online",
    "درآمد میلیونی",
];

/* ================================================================
   Text Normalization
   ================================================================ */

/**
 * Normalizes Persian and English text for consistent comparison.
 *
 * Removes invisible formatting characters and diacritics, standardizes
 * Persian character variants, and normalizes whitespace and letter case.
 */
function normalizeText(text: string): string {
    return text
        .normalize("NFKC")
        .replace(INVISIBLE_CHARACTERS, "")
        .replace(DIACRITICS, "")
        .replace(/[يى]/g, "ی")
        .replace(/ك/g, "ک")
        .replace(/\u0640/g, "")
        .replace(/\u00A0/g, " ")
        .toLowerCase()
        .trim();
}

/**
 * Produces a punctuation-insensitive representation suitable for
 * matching suspicious phrases and comparing normalized content.
 */
function normalizeForMatching(text: string): string {
    return normalizeText(text)
        .replace(/[^\p{L}\p{N}\s]/gu, " ")
        .replace(/\s+/g, " ")
        .trim();
}

/**
 * Splits text into individual lines while supporting common newline formats.
 */
function getLines(text: string): string[] {
    return text.split(/\r\n?|\n/);
}

/* ================================================================
   Table Detection
   ================================================================ */

/**
 * Determines whether a line is likely part of a table.
 *
 * Supported indicators:
 * - Markdown table rows and separators
 * - Tab-separated columns
 * - HTML table-related elements
 *
 * Detection is intentionally conservative to reduce false positives
 * for ordinary text containing occasional pipe characters.
 */
function isTableLine(line: string): boolean {
    const trimmed = line.trim();

    if (!trimmed) {
        return false;
    }

    if (/<\/?(?:table|thead|tbody|tfoot|tr|td|th)\b/i.test(trimmed)) {
        return true;
    }

    if (trimmed.includes("\t")) {
        return true;
    }

    const pipeCount = (trimmed.match(/\|/g) || []).length;

    if (pipeCount >= 2) {
        return true;
    }

    // Detect Markdown table separator rows.
    if (/^\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?$/.test(trimmed)) {
        return true;
    }

    return false;
}

/**
 * Excludes detected table rows from text analysis when table-aware
 * processing is enabled.
 */
function getNonTableText(text: string, allowTables: boolean): string {
    if (!allowTables) {
        return text;
    }

    return getLines(text)
        .filter((line) => !isTableLine(line))
        .join("\n");
}

/* ================================================================
   Word Frequency Analysis
   ================================================================ */

/**
 * Tokenizes normalized text into Unicode letters and numeric sequences.
 */
function tokenizeWords(text: string): string[] {
    return normalizeText(text).match(/[\p{L}\p{N}]+/gu) || [];
}

/**
 * Calculates word-frequency statistics used to identify excessive
 * repetition in longer content.
 */
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

/**
 * Returns the length of the longest consecutive run of identical characters.
 */
function getMaxRepeatedCharRun(text: string): number {
    let maxRun = 0;
    let currentRun = 0;
    let previousChar = "";

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

/**
 * Calculates the proportion of uppercase letters among Latin letters.
 * Short Latin text samples are excluded to reduce false positives.
 */
function getCapsRatio(text: string): number {
    const latinLetters = text.match(/[a-z]/gi) || [];

    if (latinLetters.length < 30) {
        return 0;
    }

    const uppercase = (text.match(/[A-Z]/g) || []).length;

    return uppercase / latinLetters.length;
}

/**
 * Detects invisible formatting characters embedded between letters or digits.
 */
function hasSuspiciousInvisibleChars(text: string): boolean {
    return /[\p{L}\p{N}][\u200B\u200C\u200D\u2060\uFEFF][\p{L}\p{N}]/u.test(
        text
    );
}

/* ================================================================
   URL Analysis
   ================================================================ */

/**
 * Extracts HTTP, HTTPS, and www-prefixed URLs from text.
 */
function extractUrls(text: string): string[] {
    return text.match(URL_REGEX) || [];
}

/**
 * Extracts a normalized hostname from a URL.
 * Returns an empty string when the URL cannot be parsed.
 */
function getDomain(url: string): string {
    try {
        const cleaned = url.replace(/[),.;!?]+$/g, "");

        const parsed = new URL(
            /^https?:\/\//i.test(cleaned)
                ? cleaned
                : `https://${cleaned}`
        );

        return parsed.hostname
            .replace(/^www\./i, "")
            .toLowerCase();
    } catch {
        return "";
    }
}

/**
 * Counts URLs hosted by known URL-shortening services.
 */
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
   Duplicate Content Detection
   ================================================================ */

/**
 * Generates a SHA-256 hash from normalized content.
 * Equivalent text with different punctuation or spacing produces
 * the same canonical representation.
 */
function hashContent(text: string): string {
    const canonical = normalizeForMatching(text);

    return crypto
        .createHash("sha256")
        .update(canonical, "utf8")
        .digest("hex");
}

/* ================================================================
   Main Spam Detection
   ================================================================ */

/**
 * Evaluates content against configurable spam detection rules.
 *
 * Each triggered rule contributes to an explainable risk score.
 * The final score is capped at 100, and content is classified as spam
 * when the score reaches the configured threshold.
 */
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

    if (typeof text !== "string" || !text.trim()) {
        return result;
    }

    const normalized = normalizeText(text);
    const matchingText = normalizeForMatching(text);

    /**
     * Records a rule only once to prevent duplicate reasons and messages.
     */
    const add = (rule: Rule): void => {
        if (result.reasons.includes(rule.reason)) {
            return;
        }

        result.score += rule.weight;
        result.reasons.push(rule.reason);
        result.messages.push(rule.message);

        if (rule.warning) {
            result.warnings.push(rule.message);
        }
    };

    /* ------------------------------------------------------------
       1. Short Content
       ------------------------------------------------------------ */

    if (normalized.length < minLength) {
        add({
            weight: 10,
            reason: "TOO_SHORT",
            message: "The content is too short for reliable evaluation.",
            warning: true,
        });
    }

    /* ------------------------------------------------------------
       2. Excessive Character Repetition
       ------------------------------------------------------------ */

    const maxCharRun = getMaxRepeatedCharRun(normalized);

    if (maxCharRun >= 30) {
        add({
            weight: 40,
            reason: "REPEATED_CHARS",
            message: "An unusually long sequence of repeated characters was detected.",
        });
    } else if (maxCharRun >= 15) {
        add({
            weight: 25,
            reason: "REPEATED_CHARS",
            message: "Excessive character repetition was detected.",
        });
    } else if (maxCharRun >= 8) {
        add({
            weight: 10,
            reason: "REPEATED_CHARS",
            message: "A long sequence of repeated characters was detected.",
            warning: true,
        });
    }

    /* ------------------------------------------------------------
       3. Repeated Words
       ------------------------------------------------------------ */

    const textForWordAnalysis = getNonTableText(
        normalized,
        allowTables
    );

    const wordStats = analyzeRepeatedWords(textForWordAnalysis);

    // Repetition ratios are evaluated only for sufficiently long content
    // to reduce false positives in short descriptions and limited vocabularies.
    if (wordStats.totalWords >= 30) {
        const repetitionRatio = wordStats.repetitionRatio;
        const threshold = Math.max(10, repeatedWordThreshold);

        if (
            wordStats.repeatedWords >= 5 &&
            repetitionRatio >= 0.35
        ) {
            add({
                weight: 35,
                reason: "REPEATED_WORDS",
                message: "Extensive word repetition was detected.",
            });
        } else if (
            wordStats.repeatedWords >= 3 &&
            repetitionRatio >= 0.2
        ) {
            add({
                weight: 20,
                reason: "REPEATED_WORDS",
                message: "Word repetition exceeds typical levels.",
                warning: true,
            });
        } else if (
            wordStats.maxFrequency >= threshold &&
            repetitionRatio >= 0.12
        ) {
            add({
                weight: 10,
                reason: "REPEATED_WORDS",
                message: "One or more words are repeated excessively.",
                warning: true,
            });
        }
    }

    /* ------------------------------------------------------------
       4. Excessive Links
       ------------------------------------------------------------ */

    const urls = extractUrls(text);

    if (urls.length > maxLinks * 2) {
        add({
            weight: 35,
            reason: "TOO_MANY_LINKS",
            message: `The number of links (${urls.length}) is unusually high.`,
        });
    } else if (urls.length > maxLinks) {
        add({
            weight: 20,
            reason: "TOO_MANY_LINKS",
            message: `The number of links (${urls.length}) exceeds the configured limit.`,
            warning: true,
        });
    }

    /* ------------------------------------------------------------
       5. URL Shorteners
       ------------------------------------------------------------ */

    const shortenerCount = countShortenerUrls(urls);

    if (shortenerCount >= 3) {
        add({
            weight: 25,
            reason: "URL_SHORTENER",
            message: "Repeated use of URL-shortening services was detected.",
        });
    } else if (shortenerCount > 0) {
        add({
            weight: 8,
            reason: "URL_SHORTENER",
            message: "A URL-shortening service is present in the content.",
            warning: true,
        });
    }

    /* ------------------------------------------------------------
       6. Excessive Uppercase Usage
       ------------------------------------------------------------ */

    const capsRatio = getCapsRatio(text);

    if (capsRatio >= 0.9) {
        add({
            weight: 25,
            reason: "CAPS_LOCK",
            message: "Unusually extensive uppercase usage was detected.",
        });
    } else if (capsRatio >= 0.75) {
        add({
            weight: 12,
            reason: "CAPS_LOCK",
            message: "The proportion of uppercase Latin letters is high.",
            warning: true,
        });
    }

    /* ------------------------------------------------------------
       7. Suspicious Promotional Phrases
       ------------------------------------------------------------ */

    const suspiciousHits = SUSPICIOUS_PHRASES.filter((phrase) =>
        matchingText.includes(normalizeForMatching(phrase))
    );

    const highRiskHits = HIGH_RISK_PHRASES.filter((phrase) =>
        matchingText.includes(normalizeForMatching(phrase))
    );

    if (suspiciousHits.length >= 3) {
        add({
            weight: 25,
            reason: "SUSPICIOUS_KEYWORDS",
            message: "Multiple suspicious promotional phrases were detected.",
            warning: true,
        });
    } else if (suspiciousHits.length > 0) {
        add({
            weight: 8,
            reason: "SUSPICIOUS_KEYWORDS",
            message: "A potentially suspicious promotional phrase was detected.",
            warning: true,
        });
    }

    // High-risk promotional phrases alone are insufficient for this rule.
    // At least two distinct phrases and one URL must be present.
    if (highRiskHits.length >= 2 && urls.length > 0) {
        add({
            weight: 20,
            reason: "HIGH_RISK_PROMOTION",
            message: "High-risk promotional phrases combined with links were detected.",
        });
    }

    /* ------------------------------------------------------------
       8. HTML and JavaScript Injection Patterns
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
                reason: "HTML_INJECTION",
                message: "A potentially dangerous HTML or JavaScript pattern was detected.",
            });
        }
    }

    /* ------------------------------------------------------------
       9. Invisible-Character Obfuscation
       ------------------------------------------------------------ */

    if (hasSuspiciousInvisibleChars(text)) {
        add({
            weight: 15,
            reason: "INVISIBLE_CHAR_OBFUSCATION",
            message: "An invisible character embedded within text was detected.",
            warning: true,
        });
    }

    /* ------------------------------------------------------------
       10. Duplicate Content
       ------------------------------------------------------------ */

    if (checkHashDuplicate && userId && normalized.length > 20) {
        const hash = hashContent(text);

        // Scope duplicate checks by user and field to avoid collisions
        // between unrelated content types.
        const scope = field || "default";
        const cacheKey = `spam:hash:${userId}:${scope}:${hash}`;

        const existing = cacheGet<number>(cacheKey);

        if (existing !== undefined && existing !== null) {
            add({
                weight: 50,
                reason: "DUPLICATE_CONTENT",
                message: "Identical content has already been submitted for this field.",
            });
        } else {
            cacheSet(cacheKey, Date.now(), 24 * 60 * 60);
        }
    }

    /* ------------------------------------------------------------
       Final Score and Classification
       ------------------------------------------------------------ */

    result.score = Math.min(100, result.score);
    result.isSpam = result.score >= SPAM_THRESHOLD;

    // Warnings are intended for borderline results, not confirmed spam
    // or content with a score below the warning threshold.
    if (result.isSpam || result.score < WARN_THRESHOLD) {
        result.warnings = [];
    }

    return result;
}

/* ================================================================
   Controller Helper
   ================================================================ */

/**
 * Validates submitted content and throws an application error when
 * the spam score reaches the configured rejection threshold.
 */
export async function assertNotSpam(
    text: string,
    options: SpamCheckOptions = {}
): Promise<void> {
    const result = await checkSpam(text, options);

    if (result.isSpam) {
        throw new AppError(
            400,
            ErrorCodes.SPAM_DETECTED,
            "Your content has been flagged as potential spam. Please revise it.",
            {
                field: options.field,
                details: {
                    score: result.score,
                    reasons: result.reasons,
                    messages: result.messages,
                },
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