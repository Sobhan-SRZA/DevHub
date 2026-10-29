/* ============================================================
 * Login Page
 * ============================================================ */

document.addEventListener("DOMContentLoaded", () => {
    /**
     * Generates a lightweight client fingerprint without external dependencies.
     *
     * @returns {string} A hexadecimal hash derived from client characteristics.
     */
    function getClientFingerprint() {
        const parts = [
            navigator.userAgent,
            navigator.language,
            navigator.languages?.join(",") || "",
            screen.colorDepth,
            `${screen.width}x${screen.height}`,
            new Date().getTimezoneOffset(),
            navigator.hardwareConcurrency || "",
            navigator.platform || ""
        ];

        // Generate a 32-bit hash using the FNV-1a algorithm.
        let hash = 0x811c9dc5;
        const str = parts.join("|");

        for (let i = 0; i < str.length; i++) {
            hash ^= str.charCodeAt(i);
            hash = (hash * 0x01000193) >>> 0;
        }

        return hash.toString(16);
    }

    /**
     * Retrieves the persistent device identifier or creates a new one.
     *
     * The identifier is stored in localStorage to maintain consistency
     * across browser sessions.
     *
     * @returns {string} The persistent device identifier.
     */
    function getOrCreateDeviceId() {
        let id = localStorage.getItem("deviceId");

        if (!id) {
            id = crypto.randomUUID
                ? crypto.randomUUID()
                : `dev-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;

            localStorage.setItem("deviceId", id);
        }

        return id;
    }

    const form = document.getElementById("loginForm");

    if (!form) {
        return;
    }

    FormKit.attach(form, {
        /* ---------------- Client-Side Validation ---------------- */

        validate(values) {
            const errors = {};

            if (!values.identifier) {
                errors.identifier = "Email address or username is required.";
            } else if (values.identifier.length < 3) {
                errors.identifier = "Please enter at least 3 characters.";
            } else if (values.identifier.length > 254) {
                errors.identifier = "The provided value exceeds the maximum allowed length.";
            }

            if (!values.password) {
                errors.password = "Password is required.";
            } else if (values.password.length < 6) {
                errors.password = "Password must contain at least 6 characters.";
            }

            return errors;
        },

        /* ---------------- Form Submission ---------------- */

        submit(values) {
            return FormKit.postJSON("/api/auth/login", {
                identifier: values.identifier,
                password: values.password,
                remember: Boolean(values.remember),
                fingerprint: getClientFingerprint(),
                deviceId: getOrCreateDeviceId()
            });
        },

        /* ---------------- Successful Authentication ---------------- */

        onSuccess(data) {
            toast("Login successful.", "success");

            // Redirect users with unverified email addresses to verification.
            if (data?.user && data.user.emailVerified === false) {
                setTimeout(() => {
                    location.href = "/auth/verify-email";
                }, 500);

                return;
            }

            // Redirect developers to their dashboard and other users to the homepage.
            setTimeout(() => {
                location.href = data?.user?.role === "developer"
                    ? "/dashboard"
                    : "/";
            }, 500);
        },

        /* ---------------- Error Handling ---------------- */

        onError(payload) {
            // Log authentication errors locally for development and debugging.
            if (location.hostname === "localhost") {
                console.debug("[Login Error]", payload);
            }

            // Select the password field when the credentials are invalid.
            if (payload?.code === FormKit.ERROR_CODES.INVALID_CREDENTIALS) {
                const passwordInput = form.querySelector('[name="password"]');

                if (passwordInput) {
                    passwordInput.select?.();
                }
            }
        }
    });
});

/**
 * Copyright (c) 2026 Sobhan Rasoulzadeh Asl (Sobhan-SRZA / Mr. Sinre)
 *
 * Licensed under the BSD 3-Clause License.
 * See the LICENSE file in the project root for license information.
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */