/* ============================================================
   Register Page
   ============================================================
   Handles the account registration form: client-side field
   validation, submission to the registration API, and routing
   the user to the email verification step when the server
   returns a verification token.
   ============================================================ */

document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("registerForm");
    if (!form)
        return;

    /* ---------------- Server-Aligned Validation Patterns ----------------
       These patterns mirror the server-side rules so that users
       receive immediate feedback without a round trip.
       ---------------- */
    const RE = {
        name: /^.{2,60}$/,
        username: /^[a-zA-Z0-9_.-]{3,20}$/,
        email: /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/,
        password: /^(?=.*[A-Za-z])(?=.*\d).{6,}$/
    };

    /* ---------------- Email Verification State Key ----------------
       Session storage key used to carry the verification context
       over to the /auth/verify-email page.
       ---------------- */
    const VERIFY_STORAGE_KEY = "email_verify_state";

    /**
     * Persist the verification state (token, email, and expiry) in
     * session storage. Returns `true` when the state is written
     * successfully; otherwise returns `false`.
     */
    function saveVerifyState(data, email) {
        try {
            if (!data?.verifyToken || !email) return false;

            sessionStorage.setItem(
                VERIFY_STORAGE_KEY,
                JSON.stringify({
                    verifyToken: data.verifyToken,
                    email: data.email || email,
                    expiresAt: Date.now() + (data.expiresIn || 900) * 1000,
                })
            );

            return true;
        } catch {
            return false;
        }
    }

    FormKit.attach(form, {
        /* ---------------- Client-Side Validation ----------------
           Returns a map of field name to error message. Any keys
           present prevent submission and are rendered inline.
           ---------------- */
        validate(v) {
            const errors = {};

            // Name
            if (!v.name) {
                errors.name = "Name is required.";
            } else if (v.name.length < 2) {
                errors.name = "Name must be at least 2 characters long.";
            } else if (v.name.length > 60) {
                errors.name = "Name is too long.";
            }

            // Username
            if (!v.username) {
                errors.username = "Username is required.";
            } else if (v.username.includes("@")) {
                errors.username = "Username cannot contain '@'.";
            } else if (/\s/.test(v.username)) {
                errors.username = "Username cannot contain spaces.";
            } else if (v.username.length < 3) {
                errors.username = "Username must be at least 3 characters long.";
            } else if (v.username.length > 20) {
                errors.username = "Username must be at most 20 characters long.";
            } else if (!RE.username.test(v.username)) {
                errors.username = "Username may only contain English letters, digits, _, ., or -.";
            }

            // Email
            if (!v.email) {
                errors.email = "Email is required.";
            } else if (!RE.email.test(v.email)) {
                errors.email = "Invalid email address.";
            }

            // Password
            if (!v.password) {
                errors.password = "Password is required.";
            } else if (v.password.length < 6) {
                errors.password = "Password must be at least 6 characters long.";
            } else if (!RE.password.test(v.password)) {
                errors.password = "Password must contain both letters and digits.";
            }

            // Password confirmation
            if (!v.confirmPassword) {
                errors.confirmPassword = "Password confirmation is required.";
            } else if (v.password !== v.confirmPassword) {
                errors.confirmPassword = "The password and its confirmation do not match.";
            }

            // Terms acceptance
            if (!v.terms) {
                errors.terms = "You must accept the terms to continue.";
            }

            return errors;
        },

        /* ---------------- Submission ----------------
           POST the registration payload to the server. Errors are
           handled by FormKit's standard error pipeline.
           ---------------- */
        submit(v) {
            return FormKit.postJSON("/api/auth/register", {
                name: v.name,
                username: v.username,
                email: v.email,
                password: v.password,
                confirmPassword: v.confirmPassword,
                terms: !!v.terms
            });
        },

        /* ---------------- Success ----------------
           When the server returns a verification token, persist
           the verification state and redirect to the email
           verification page. Otherwise, fall back to the home page.
           ---------------- */
        onSuccess(data) {
            const email =
                data?.email ||
                form.querySelector('[name="email"]')?.value?.trim()?.toLowerCase();

            if (saveVerifyState(data, email)) {
                toast(
                    data?.message || "Your account was created. Enter the verification code.",
                    "success"
                );

                setTimeout(() => {
                    location.href = "/auth/verify-email";
                }, 800);

                return;
            }

            // Fallback: no verification token was returned.
            toast("Your account was created successfully 🎉", "success");
            setTimeout(() => (location.href = "/"), 700);
        },

        /* ---------------- Error Logging ----------------
           Log the error payload during local development to aid
           debugging. FormKit handles the user-facing presentation.
           ---------------- */
        onError(payload) {
            if (location.hostname === "localhost") {
                console.debug("[register error]", payload);
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