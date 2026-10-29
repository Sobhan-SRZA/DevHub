
/**
 * Centralized application error codes.
 *
 * Each code identifies a specific error scenario and maps to a default
 * user-facing message. The frontend can use these codes to determine
 * how to display errors and handle different failure scenarios.
 */
export const ErrorCodes = {
    // ---------- Validation ----------
    VALIDATION_ERROR: "VALIDATION_ERROR",

    // ---------- Registration ----------
    USERNAME_TAKEN: "USERNAME_TAKEN",
    EMAIL_TAKEN: "EMAIL_TAKEN",
    USERNAME_INVALID: "USERNAME_INVALID",
    USERNAME_TOO_SHORT: "USERNAME_TOO_SHORT",
    USERNAME_TOO_LONG: "USERNAME_TOO_LONG",
    USERNAME_HAS_AT: "USERNAME_HAS_AT",
    USERNAME_NOT_ENGLISH: "USERNAME_NOT_ENGLISH",
    USERNAME_HAS_SPACE: "USERNAME_HAS_SPACE",
    EMAIL_INVALID: "EMAIL_INVALID",
    PASSWORD_TOO_SHORT: "PASSWORD_TOO_SHORT",
    PASSWORD_TOO_WEAK: "PASSWORD_TOO_WEAK",
    PASSWORDS_DONT_MATCH: "PASSWORDS_DONT_MATCH",
    TERMS_NOT_ACCEPTED: "TERMS_NOT_ACCEPTED",
    NAME_TOO_SHORT: "NAME_TOO_SHORT",
    NAME_TOO_LONG: "NAME_TOO_LONG",

    // ---------- Authentication ----------
    EMAIL_NOT_VERIFIED: "EMAIL_NOT_VERIFIED",

    // ---------- Login ----------
    INVALID_CREDENTIALS: "INVALID_CREDENTIALS",
    ACCOUNT_NOT_FOUND: "ACCOUNT_NOT_FOUND",
    ACCOUNT_DISABLED: "ACCOUNT_DISABLED",
    TOO_MANY_ATTEMPTS: "TOO_MANY_ATTEMPTS",

    // ---------- Sessions and Tokens ----------
    NO_TOKEN: "NO_TOKEN",
    INVALID_TOKEN: "INVALID_TOKEN",
    WRONG_TOKEN_TYPE: "WRONG_TOKEN_TYPE",
    SESSION_NOT_FOUND: "SESSION_NOT_FOUND",
    SESSION_EXPIRED: "SESSION_EXPIRED",
    NO_REFRESH_TOKEN: "NO_REFRESH_TOKEN",
    INVALID_REFRESH_TOKEN: "INVALID_REFRESH_TOKEN",
    UNAUTHENTICATED: "UNAUTHENTICATED",

    // ---------- Server and Infrastructure ----------
    INTERNAL_ERROR: "INTERNAL_ERROR",
    DATABASE_ERROR: "DATABASE_ERROR",
    NETWORK_ERROR: "NETWORK_ERROR",

    // ---------- Tags and Tag Types ----------
    TAG_NOT_FOUND: "TAG_NOT_FOUND",
    TAG_TAKEN: "TAG_TAKEN",
    TAG_IN_USE: "TAG_IN_USE",
    TAG_TYPE_NOT_FOUND: "TAG_TYPE_NOT_FOUND",
    TAG_TYPE_TAKEN: "TAG_TYPE_TAKEN",
    TAG_TYPE_HAS_TAGS: "TAG_TYPE_HAS_TAGS",
    TAG_TYPE_IS_SYSTEM: "TAG_TYPE_IS_SYSTEM",

    // ---------- Projects ----------
    PROJECT_NOT_FOUND: "PROJECT_NOT_FOUND",
    PROJECT_SLUG_TAKEN: "PROJECT_SLUG_TAKEN",
    PROJECT_NOT_OWNED: "PROJECT_NOT_OWNED",
    PROJECT_LIMIT_REACHED: "PROJECT_LIMIT_REACHED",

    // ---------- GitHub Integration ----------
    GITHUB_URL_INVALID: "GITHUB_URL_INVALID",
    GITHUB_REPO_NOT_FOUND: "GITHUB_REPO_NOT_FOUND",
    GITHUB_API_ERROR: "GITHUB_API_ERROR",
    GITHUB_RATE_LIMIT: "GITHUB_RATE_LIMIT",
    GITHUB_ALREADY_LINKED: "GITHUB_ALREADY_LINKED",

    // ---------- Reviews ----------
    REVIEW_NOT_FOUND: "REVIEW_NOT_FOUND",
    REVIEW_ALREADY_EXISTS: "REVIEW_ALREADY_EXISTS",
    REVIEW_NOT_OWNED: "REVIEW_NOT_OWNED",
    CANNOT_REVIEW_OWN: "CANNOT_REVIEW_OWN",

    // ---------- Comments ----------
    COMMENT_NOT_FOUND: "COMMENT_NOT_FOUND",
    COMMENT_NOT_OWNED: "COMMENT_NOT_OWNED",
    COMMENT_PARENT_INVALID: "COMMENT_PARENT_INVALID",
    COMMENT_DEPTH_EXCEEDED: "COMMENT_DEPTH_EXCEEDED",

    // ---------- File Uploads ----------
    FILE_TOO_LARGE: "FILE_TOO_LARGE",
    FILE_TYPE_INVALID: "FILE_TYPE_INVALID",
    FILE_UPLOAD_FAILED: "FILE_UPLOAD_FAILED",
    MEDIA_LIMIT_REACHED: "MEDIA_LIMIT_REACHED",
    NO_FILE_PROVIDED: "NO_FILE_PROVIDED",

    // ---------- Content Moderation ----------
    SPAM_DETECTED: "SPAM_DETECTED",
    CONTENT_TOO_LONG: "CONTENT_TOO_LONG"
} as const;

/**
 * Union of all supported application error codes.
 *
 * This type is inferred directly from `ErrorCodes`, ensuring that
 * error codes remain consistent across the application.
 */
export type ErrorCode =
    typeof ErrorCodes[keyof typeof ErrorCodes];

/**
 * Default user-facing messages for application error codes.
 *
 * Controllers and services can override these messages when more
 * specific context is available. Otherwise, the corresponding default
 * message is used by the application's error-handling layer.
 */
export const ErrorMessages: Record<ErrorCode, string> = {
    // ---------- Validation ----------
    [ErrorCodes.VALIDATION_ERROR]:
        "The submitted data is invalid.",

    // ---------- Registration ----------
    [ErrorCodes.USERNAME_TAKEN]:
        "This username is already taken.",
    [ErrorCodes.EMAIL_TAKEN]:
        "This email address is already registered.",
    [ErrorCodes.USERNAME_INVALID]:
        "The username is invalid.",
    [ErrorCodes.USERNAME_TOO_SHORT]:
        "The username must contain at least 3 characters.",
    [ErrorCodes.USERNAME_TOO_LONG]:
        "The username must not exceed 20 characters.",
    [ErrorCodes.USERNAME_HAS_AT]:
        "The username cannot contain the @ symbol.",
    [ErrorCodes.USERNAME_NOT_ENGLISH]:
        "The username can contain only English letters, numbers, underscores, periods, and hyphens.",
    [ErrorCodes.USERNAME_HAS_SPACE]:
        "The username cannot contain spaces.",
    [ErrorCodes.EMAIL_INVALID]:
        "The email address is invalid.",
    [ErrorCodes.PASSWORD_TOO_SHORT]:
        "The password must contain at least 6 characters.",
    [ErrorCodes.PASSWORD_TOO_WEAK]:
        "The password must contain both letters and numbers.",
    [ErrorCodes.PASSWORDS_DONT_MATCH]:
        "The passwords do not match.",
    [ErrorCodes.TERMS_NOT_ACCEPTED]:
        "You must accept the terms and conditions to continue.",
    [ErrorCodes.NAME_TOO_SHORT]:
        "The name must contain at least 2 characters.",
    [ErrorCodes.NAME_TOO_LONG]:
        "The name exceeds the maximum allowed length.",

    // ---------- Authentication ----------
    [ErrorCodes.EMAIL_NOT_VERIFIED]:
        "Your email address has not been verified. Please enter the verification code we sent you.",

    // ---------- Login ----------
    [ErrorCodes.INVALID_CREDENTIALS]:
        "The email address, username, or password is incorrect.",
    [ErrorCodes.ACCOUNT_NOT_FOUND]:
        "No account was found matching the provided information.",
    [ErrorCodes.ACCOUNT_DISABLED]:
        "This account has been disabled.",
    [ErrorCodes.TOO_MANY_ATTEMPTS]:
        "Too many attempts. Please try again in a few minutes.",

    // ---------- Sessions and Tokens ----------
    [ErrorCodes.NO_TOKEN]:
        "You must sign in to continue.",
    [ErrorCodes.INVALID_TOKEN]:
        "The token is invalid.",
    [ErrorCodes.WRONG_TOKEN_TYPE]:
        "The token type is incorrect.",
    [ErrorCodes.SESSION_NOT_FOUND]:
        "The session could not be found.",
    [ErrorCodes.SESSION_EXPIRED]:
        "Your session has expired. Please sign in again.",
    [ErrorCodes.NO_REFRESH_TOKEN]:
        "The refresh token is missing.",
    [ErrorCodes.INVALID_REFRESH_TOKEN]:
        "The refresh token is invalid or has expired.",
    [ErrorCodes.UNAUTHENTICATED]:
        "Authentication is required to continue.",

    // ---------- Server and Infrastructure ----------
    [ErrorCodes.INTERNAL_ERROR]:
        "An internal server error occurred.",
    [ErrorCodes.DATABASE_ERROR]:
        "A database connection error occurred.",
    [ErrorCodes.NETWORK_ERROR]:
        "Unable to connect to the server.",

    // ---------- Tags and Tag Types ----------
    [ErrorCodes.TAG_NOT_FOUND]:
        "The tag could not be found.",
    [ErrorCodes.TAG_TAKEN]:
        "This tag already exists within the specified tag type.",
    [ErrorCodes.TAG_IN_USE]:
        "This tag is used by one or more projects and cannot be deleted.",
    [ErrorCodes.TAG_TYPE_NOT_FOUND]:
        "The tag type could not be found.",
    [ErrorCodes.TAG_TYPE_TAKEN]:
        "This tag type already exists.",
    [ErrorCodes.TAG_TYPE_HAS_TAGS]:
        "This tag type contains tags and cannot be deleted.",
    [ErrorCodes.TAG_TYPE_IS_SYSTEM]:
        "System tag types cannot be deleted.",

    // ---------- Projects ----------
    [ErrorCodes.PROJECT_NOT_FOUND]:
        "The project could not be found.",
    [ErrorCodes.PROJECT_SLUG_TAKEN]:
        "This project slug is already in use.",
    [ErrorCodes.PROJECT_NOT_OWNED]:
        "You do not own this project.",
    [ErrorCodes.PROJECT_LIMIT_REACHED]:
        "You have reached the maximum number of allowed projects.",

    // ---------- GitHub Integration ----------
    [ErrorCodes.GITHUB_URL_INVALID]:
        "The GitHub URL is invalid.",
    [ErrorCodes.GITHUB_REPO_NOT_FOUND]:
        "The GitHub repository could not be found.",
    [ErrorCodes.GITHUB_API_ERROR]:
        "An error occurred while communicating with GitHub.",
    [ErrorCodes.GITHUB_RATE_LIMIT]:
        "The GitHub API rate limit has been reached. Please try again later.",
    [ErrorCodes.GITHUB_ALREADY_LINKED]:
        "This repository is already linked to another project.",

    // ---------- Reviews ----------
    [ErrorCodes.REVIEW_NOT_FOUND]:
        "The review could not be found.",
    [ErrorCodes.REVIEW_ALREADY_EXISTS]:
        "You have already submitted a review for this project.",
    [ErrorCodes.REVIEW_NOT_OWNED]:
        "You do not own this review.",
    [ErrorCodes.CANNOT_REVIEW_OWN]:
        "You cannot review your own project.",

    // ---------- Comments ----------
    [ErrorCodes.COMMENT_NOT_FOUND]:
        "The comment could not be found.",
    [ErrorCodes.COMMENT_NOT_OWNED]:
        "You do not own this comment.",
    [ErrorCodes.COMMENT_PARENT_INVALID]:
        "The parent comment is invalid.",
    [ErrorCodes.COMMENT_DEPTH_EXCEEDED]:
        "The maximum reply nesting depth has been exceeded.",

    // ---------- File Uploads ----------
    [ErrorCodes.FILE_TOO_LARGE]:
        "The file exceeds the maximum allowed size.",
    [ErrorCodes.FILE_TYPE_INVALID]:
        "This file type is not supported.",
    [ErrorCodes.FILE_UPLOAD_FAILED]:
        "The file could not be uploaded.",
    [ErrorCodes.MEDIA_LIMIT_REACHED]:
        "You have reached the maximum number of allowed media files.",
    [ErrorCodes.NO_FILE_PROVIDED]:
        "No file was provided.",

    // ---------- Content Moderation ----------
    [ErrorCodes.SPAM_DETECTED]:
        "Your content has been flagged as potential spam.",
    [ErrorCodes.CONTENT_TOO_LONG]:
        "The content exceeds the maximum allowed length."
};

/**
 * Copyright (c) 2026 Sobhan Rasoulzadeh Asl (Sobhan-SRZA / Mr. Sinre)
 *
 * Licensed under the BSD 3-Clause License.
 * See the LICENSE file in the project root for license information.
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */