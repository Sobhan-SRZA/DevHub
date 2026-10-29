/* ============================================================
 * Email Verification Page
 * ============================================================ */

document.addEventListener("DOMContentLoaded", () => {
    const $ = (selector) => document.querySelector(selector);
    const form = $("#verifyForm");

    if (!form) {
        return;
    }

    const emailDisplay = $("#emailDisplay");
    const codeInput = $("#otpCode");
    const submitBtn = $("#submitBtn");
    const resendBtn = $("#resendBtn");

    /* ============================================================
     * State Management
     * ============================================================ */

    const STORAGE_KEY = "email_verify_state";

    let state = null;
    let resendCooldown = 0;
    let resendTimer = null;

    /* ============================================================
     * Session Storage Helpers
     * ============================================================ */

    /**
     * Retrieves and validates the email verification state.
     *
     * @returns {Object|null} The stored verification state, or null if invalid.
     */
    function loadState() {
        try {
            const raw = sessionStorage.getItem(STORAGE_KEY);

            if (!raw) {
                return null;
            }

            const parsed = JSON.parse(raw);

            if (!parsed?.verifyToken || !parsed?.email) {
                return null;
            }

            // Discard expired verification sessions.
            if (parsed.expiresAt && parsed.expiresAt < Date.now()) {
                sessionStorage.removeItem(STORAGE_KEY);
                return null;
            }

            return parsed;
        } catch {
            return null;
        }
    }

    /**
     * Persists the verification state for the current browser session.
     *
     * @param {Object} verificationState - The state to persist.
     */
    function saveState(verificationState) {
        try {
            sessionStorage.setItem(
                STORAGE_KEY,
                JSON.stringify(verificationState)
            );
        } catch {
            // Storage may be unavailable due to browser restrictions.
        }
    }

    /**
     * Removes the stored verification state.
     */
    function clearState() {
        try {
            sessionStorage.removeItem(STORAGE_KEY);
        } catch {
            // Ignore storage access errors.
        }
    }

    /* ============================================================
     * Dialog and Navigation Helpers
     * ============================================================ */

    /**
     * Displays a dialog and redirects the user after a specified delay.
     *
     * @param {string} title - The dialog title.
     * @param {string} message - The dialog message.
     * @param {string} url - The destination URL.
     * @param {number} [delay=2500] - The redirect delay in milliseconds.
     */
    function showDialogAndRedirect(title, message, url, delay = 2500) {
        if (typeof openDialogError === "function") {
            openDialogError(title, message);
        }

        setTimeout(() => {
            location.href = url;
        }, delay);
    }

    /**
     * Clears the verification state and redirects to the login page.
     */
    function redirectBack() {
        clearState();

        showDialogAndRedirect(
            "Verification Session Expired",
            "Please sign in again to continue.",
            "/auth/login"
        );
    }

    /* ============================================================
     * API Request Helper
     * ============================================================ */

    /**
     * Sends a JSON POST request and handles API errors.
     *
     * @param {string} path - The API endpoint.
     * @param {Object} body - The request payload.
     * @returns {Promise<Object>} The parsed API response.
     * @throws {Error} If the request fails or the response is unsuccessful.
     */
    async function api(path, body) {
        const response = await fetch(path, {
            method: "POST",
            credentials: "include",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(body)
        });

        let data = null;

        try {
            data = await response.json();
        } catch {
            // The response may not contain valid JSON.
        }

        if (!response.ok) {
            const error = new Error(
                data?.message || "An unexpected error occurred."
            );

            Object.assign(error, data || {}, {
                status: response.status
            });

            throw error;
        }

        return data;
    }

    /* ============================================================
     * OTP Input Validation
     * ============================================================ */

    // Restrict the verification code to six numeric digits.
    codeInput.addEventListener("input", (event) => {
        event.target.value = event.target.value
            .replace(/\D/g, "")
            .slice(0, 6);
    });

    /* ============================================================
     * Verification Form Submission
     * ============================================================ */

    form.addEventListener("submit", async (event) => {
        event.preventDefault();

        // Require a valid verification session before submitting.
        if (!state?.verifyToken) {
            return redirectBack();
        }

        const code = codeInput.value.trim();

        FormKit.clearAllErrors(form);

        if (!/^\d{6}$/.test(code)) {
            return FormKit.showFieldError(
                codeInput,
                "The verification code must contain exactly 6 digits."
            );
        }

        submitBtn.disabled = true;

        const originalText = submitBtn.textContent;
        submitBtn.textContent = "Verifying...";

        try {
            const data = await api("/api/auth/verify-email", {
                verifyToken: state.verifyToken,
                code
            });

            clearState();

            toast(
                data?.message || "Your email has been verified successfully.",
                "success"
            );

            if (typeof openDialogError === "function") {
                openDialogError(
                    "Verification Successful",
                    data?.message || "Your account is now active. Redirecting..."
                );
            }

            setTimeout(() => {
                location.href = "/dashboard";
            }, 2000);
        } catch (error) {
            // An unauthorized response indicates an invalid or expired session.
            if (error.status === 401) {
                return redirectBack();
            }

            // Display field-specific validation errors returned by the API.
            if (error.field) {
                const field = form.querySelector(
                    `[name="${error.field}"]`
                );

                if (field) {
                    FormKit.showFieldError(field, error.message);
                }
            } else if (error.details) {
                for (const [fieldName, messages] of Object.entries(
                    error.details
                )) {
                    const field = form.querySelector(
                        `[name="${fieldName}"]`
                    );

                    if (field && Array.isArray(messages) && messages[0]) {
                        FormKit.showFieldError(field, messages[0]);
                    }
                }
            } else {
                FormKit.showFieldError(codeInput, error.message);
            }

            toast(
                error.message || "Failed to verify your email.",
                "error"
            );
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
        }
    });

    /* ============================================================
     * Resend Verification Code
     * ============================================================ */

    resendBtn.addEventListener("click", async () => {
        if (resendCooldown > 0 || !state?.verifyToken) {
            return;
        }

        resendBtn.disabled = true;

        const originalText = resendBtn.textContent;
        resendBtn.textContent = "Sending...";

        try {
            const data = await api("/api/auth/resend-verification", {
                verifyToken: state.verifyToken
            });

            // Update the session if the server issues a replacement token.
            if (data?.verifyToken) {
                state.verifyToken = data.verifyToken;

                if (data.expiresIn) {
                    state.expiresAt = Date.now() + data.expiresIn * 1000;
                }

                saveState(state);
            }

            toast(
                data?.message || "A new verification code has been sent.",
                "success"
            );

            startResendCooldown(60);
            codeInput.focus();
        } catch (error) {
            if (error.status === 401) {
                return redirectBack();
            }

            toast(
                error.message || "Failed to resend the verification code.",
                "error"
            );
        } finally {
            resendBtn.disabled = false;
            resendBtn.textContent = originalText;
        }
    });

    /* ============================================================
     * Resend Cooldown
     * ============================================================ */

    /**
     * Starts the resend countdown and disables the resend button
     * until the cooldown expires.
     *
     * @param {number} seconds - The cooldown duration in seconds.
     */
    function startResendCooldown(seconds) {
        resendCooldown = seconds;

        const timer = $("#resendTimer");
        const countdownEl = $("#resendCountdown");

        resendBtn.disabled = true;
        timer.style.display = "";

        clearInterval(resendTimer);

        const tick = () => {
            countdownEl.textContent = resendCooldown;

            if (resendCooldown <= 0) {
                clearInterval(resendTimer);
                timer.style.display = "none";
                resendBtn.disabled = false;
                return;
            }

            resendCooldown--;
        };

        tick();

        resendTimer = setInterval(tick, 1000);
    }

    /* ============================================================
     * Page Initialization
     * ============================================================ */

    /**
     * Initializes the verification page by restoring the existing
     * verification session or requesting one for an authenticated user.
     */
    async function init() {
        state = loadState();

        if (!state) {
            // Attempt to recover the verification session from the server.
            try {
                const response = await fetch("/api/auth/me", {
                    credentials: "include"
                });

                if (response.ok) {
                    const data = await response.json();

                    if (data?.user && !data.user.emailVerified) {
                        // Request a verification session for the authenticated user.
                        const resendResponse = await fetch(
                            "/api/auth/resend-verification",
                            {
                                method: "POST",
                                credentials: "include"
                            }
                        );

                        if (resendResponse.ok) {
                            const resendData = await resendResponse.json();

                            state = {
                                verifyToken: resendData.verifyToken,
                                email: resendData.email,
                                expiresAt: resendData.expiresIn
                                    ? Date.now() + resendData.expiresIn * 1000
                                    : undefined
                            };

                            saveState(state);
                        }
                    } else if (data?.user?.emailVerified) {
                        // Redirect users whose email addresses are already verified.
                        location.href = "/dashboard";
                        return;
                    }
                }
            } catch {
                // Handle failed session recovery through the fallback below.
            }
        }

        console.log("🚀 ~ init ~ state:", state)
        if (!state) {
            // A valid verification session could not be established.
            showDialogAndRedirect(
                "Authentication Required",
                "Please sign in to your account to continue.",
                "/auth/login"
            );

            return;
        }

        emailDisplay.textContent = state.email;

        startResendCooldown(60);

        setTimeout(() => {
            codeInput.focus();
        }, 200);
    }

    init();
});

/**
 * Copyright (c) 2026 Sobhan Rasoulzadeh Asl (Sobhan-SRZA / Mr. Sinre)
 *
 * Licensed under the BSD 3-Clause License.
 * See the LICENSE file in the project root for license information.
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */