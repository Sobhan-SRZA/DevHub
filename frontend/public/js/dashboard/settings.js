/* ============================================================
 * Settings Page
 * ============================================================ */

document.addEventListener("DOMContentLoaded", () => {
    const $ = (selector, root = document) => root.querySelector(selector);
    const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

    /* ============================================================
     * State Management
     * ============================================================ */

    const state = {
        user: null,
        pendingEmail: null,
        pendingEmailTimer: null,
        bioEditor: null,
        newPasswordPlain: null
    };

    /* ============================================================
     * API Utilities
     * ============================================================ */

    /**
     * Sends an HTTP request and parses the response when JSON is available.
     *
     * @param {string} path - The API endpoint.
     * @param {Object} [options={}] - Fetch options.
     * @returns {Promise<Object|null>} The parsed response data.
     * @throws {Error} If the request fails.
     */
    async function api(path, options = {}) {
        const response = await fetch(path, {
            credentials: "include",
            headers: options.body instanceof FormData
                ? {}
                : { "Content-Type": "application/json" },
            ...options
        });

        let data = null;
        const contentType = response.headers.get("content-type") || "";

        if (contentType.includes("application/json")) {
            try {
                data = await response.json();
            } catch {
                // Ignore malformed JSON responses.
            }
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
     * Tab Navigation
     * ============================================================ */

    $$(".st-tab").forEach((tab) => {
        tab.addEventListener("click", () => {
            $$(".st-tab").forEach((item) => {
                item.classList.toggle("active", item === tab);
            });

            $$(".st-panel").forEach((panel) => {
                panel.classList.toggle(
                    "active",
                    panel.dataset.panel === tab.dataset.tab
                );
            });

            // Reset the password workflow whenever the password tab is opened.
            if (tab.dataset.tab === "password") {
                resetPasswordFlow();
            }
        });
    });

    /* ============================================================
     * User Profile Loading
     * ============================================================ */

    /**
     * Retrieves the authenticated user's profile and initializes the UI.
     */
    async function loadUser() {
        try {
            const data = await api("/api/profile/me");

            state.user = data.user;

            renderUser();
            initBioEditor();
        } catch (error) {
            if (error.status === 401) {
                location.href = "/auth/login";
            } else {
                toast(
                    error.message || "Failed to load your profile.",
                    "error"
                );
            }
        }
    }

    /**
     * Updates the profile fields, avatar, email verification status,
     * and pending email change state.
     */
    function renderUser() {
        const user = state.user;

        if (!user) {
            return;
        }

        /* ---------------- Name and Username ---------------- */

        $("#stName").value = user.name || "";
        $("#stUsername").value = user.username || "";

        /* ---------------- Avatar ---------------- */

        const avatarPreview = $("#avatarPreview");

        if (user.avatar?.url) {
            avatarPreview.style.backgroundImage = `url('${user.avatar.url}')`;
            avatarPreview.style.backgroundSize = "cover";
            avatarPreview.style.backgroundPosition = "center";
            avatarPreview.textContent = "";
        } else {
            avatarPreview.style.backgroundImage = "";
            avatarPreview.style.background = "linear-gradient(135deg, #007bff, #6ebbff)";
            avatarPreview.textContent = (user.name || "?").charAt(0).toUpperCase();
        }

        /* ---------------- Email Verification ---------------- */

        $("#currentEmail").textContent = user.email || "—";

        const verificationBadge = $("#emailVerifiedBadge");

        if (user.emailVerified) {
            verificationBadge.className = "email-current__badge";
            verificationBadge.innerHTML = `
                <svg
                    viewBox="0 0 24 24"
                    width="11"
                    height="11"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="3"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    aria-hidden="true"
                >
                    <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                Verified
            `;
        } else {
            verificationBadge.className =
                "email-current__badge email-current__badge--unverified";
            verificationBadge.textContent = "⚠️ Unverified";
        }

        renderEmailState();
    }

    /* ============================================================
     * Avatar Management
     * ============================================================ */

    $("#avatarInput").addEventListener("change", async (event) => {
        const file = event.target.files[0];

        if (!file) {
            return;
        }

        const allowedTypes = [
            "image/jpeg",
            "image/png",
            "image/webp",
            "image/gif"
        ];

        if (!allowedTypes.includes(file.type)) {
            toast(
                "Allowed formats: JPG, PNG, WebP, and GIF.",
                "error"
            );
            event.target.value = "";
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            toast("The maximum file size is 5 MB.", "error");
            event.target.value = "";
            return;
        }

        const formData = new FormData();
        formData.append("avatar", file);

        try {
            const data = await api("/api/profile/avatar", {
                method: "POST",
                body: formData
            });

            state.user.avatar = data.avatar;

            renderUser();

            toast("Profile picture updated successfully.", "success");
        } catch (error) {
            toast(
                error.message || "Failed to upload the profile picture.",
                "error"
            );
        } finally {
            event.target.value = "";
        }
    });

    $("#avatarRemove").addEventListener("click", async () => {
        const confirmed = await confirmDialog({
            title: "Remove Profile Picture",
            message: "Are you sure you want to remove your profile picture?",
            confirmText: "Remove",
            danger: true
        });

        if (!confirmed) {
            return;
        }

        try {
            await api("/api/profile/avatar", {
                method: "DELETE"
            });

            state.user.avatar = null;

            renderUser();

            toast("Profile picture removed successfully.", "success");
        } catch (error) {
            toast(
                error.message || "Failed to remove the profile picture.",
                "error"
            );
        }
    });

    /* ============================================================
     * Profile Information Management
     * ============================================================ */

    $("#profileForm").addEventListener("submit", async (event) => {
        event.preventDefault();

        const name = $("#stName").value.trim();
        const username = $("#stUsername").value.trim();
        const errors = {};

        if (!name || name.length < 2) {
            errors.name = "Name must contain at least 2 characters.";
        }

        if (!username || username.length < 3) {
            errors.username = "Username must contain at least 3 characters.";
        } else if (!/^[a-zA-Z0-9_.-]{3,20}$/.test(username)) {
            errors.username = "Please enter a valid username.";
        }

        if (Object.keys(errors).length > 0) {
            FormKit.clearAllErrors($("#profileForm"));

            if (errors.name) {
                FormKit.showFieldError($("#stName"), errors.name);
            }

            if (errors.username) {
                FormKit.showFieldError($("#stUsername"), errors.username);
            }

            return;
        }

        const button = $("#saveProfileBtn");
        const originalText = button.textContent;

        button.disabled = true;
        button.textContent = "Saving...";

        try {
            // Update the display name only when it has changed.
            if (name !== state.user.name) {
                await api("/api/profile/me", {
                    method: "PATCH",
                    body: JSON.stringify({ name })
                });

                state.user.name = name;
            }

            // Update the username only when it has changed.
            if (username !== state.user.username) {
                await api("/api/profile/username", {
                    method: "PATCH",
                    body: JSON.stringify({ username })
                });

                state.user.username = username;
            }

            toast("Profile information updated successfully.", "success");

            renderUser();
        } catch (error) {
            if (error.field) {
                const field = $(`[name="${error.field}"]`);

                if (field) {
                    FormKit.showFieldError(field, error.message);
                }
            }

            toast(
                error.message || "Failed to update profile information.",
                "error"
            );
        } finally {
            button.disabled = false;
            button.textContent = originalText;
        }
    });

    /* ============================================================
     * Markdown Bio Editor
     * ============================================================ */

    /**
     * Initializes the Markdown editor with the user's current biography.
     */
    function initBioEditor() {
        if (!window.MarkdownEditor) {
            return;
        }

        state.bioEditor = new MarkdownEditor("#bioEditorRoot", {
            name: "bio",
            value: state.user.bio || "",
            placeholder: "Write about yourself... (Markdown is supported)",
            maxLength: 500,
            minHeight: 220
        });
    }

    $("#saveBioBtn").addEventListener("click", async () => {
        if (!state.bioEditor) {
            toast("The biography editor is not available.", "error");
            return;
        }

        const bio = state.bioEditor.getValue();
        const button = $("#saveBioBtn");
        const originalText = button.textContent;

        button.disabled = true;
        button.textContent = "Saving...";

        try {
            await api("/api/profile/me", {
                method: "PATCH",
                body: JSON.stringify({ bio })
            });

            state.user.bio = bio;

            toast("Biography saved successfully.", "success");
        } catch (error) {
            toast(
                error.message || "Failed to save your biography.",
                "error"
            );
        } finally {
            button.disabled = false;
            button.textContent = originalText;
        }
    });

    /* ============================================================
     * Email Change: State Elements
     * ============================================================ */

    const emailStateRequest = $("#emailStateRequest");
    const emailStateOldVerify = $("#emailStateOldVerify");
    const emailStateNewVerify = $("#emailStateNewVerify");

    /* ============================================================
     * Email Change: State Management
     * ============================================================ */

    /**
     * Displays the appropriate email change workflow state.
     *
     * @param {"request"|"oldVerify"|"newVerify"} currentState - The workflow state.
     * @param {Object} [data={}] - State-specific data.
     */
    function setEmailState(currentState, data = {}) {
        emailStateRequest.style.display =
            currentState === "request" ? "" : "none";

        emailStateOldVerify.style.display =
            currentState === "oldVerify" ? "" : "none";

        emailStateNewVerify.style.display =
            currentState === "newVerify" ? "" : "none";

        if (currentState === "oldVerify") {
            $("#oldEmailDisplay").textContent = data.previousEmail || "—";
            $("#newEmailDisplay").textContent = data.newEmail || "—";

            startOldVerifyTimer(data.expiresIn || 600);

            setTimeout(() => {
                $("#oldEmailCode").focus();
            }, 200);
        }

        if (currentState === "newVerify") {
            $("#newEmailChanged").textContent = data.newEmail || "—";
            $("#newEmailChangedInline").textContent = data.newEmail || "—";
        }
    }

    let oldVerifyTimerId = null;

    /**
     * Starts the countdown for verification of the previous email address.
     *
     * @param {number} seconds - The countdown duration in seconds.
     */
    function startOldVerifyTimer(seconds) {
        clearInterval(oldVerifyTimerId);

        const timerElement = $("#oldVerifyTimer");
        let remaining = seconds;

        const tick = () => {
            if (remaining <= 0) {
                clearInterval(oldVerifyTimerId);
                timerElement.textContent = "Expired";
                return;
            }

            const minutes = String(Math.floor(remaining / 60)).padStart(2, "0");
            const secondsRemaining = String(remaining % 60).padStart(2, "0");

            timerElement.textContent = `${minutes}:${secondsRemaining}`;

            remaining--;
        };

        tick();

        oldVerifyTimerId = setInterval(tick, 1000);
    }

    /* ============================================================
     * Email Change: State Restoration
     * ============================================================ */

    /**
     * Determines the current email change workflow state from the user profile.
     */
    function renderEmailState() {
        const user = state.user;

        if (!user) {
            return;
        }

        const pendingEmail = user.pendingEmail;

        if (!pendingEmail) {
            // No pending request; allow the user to initiate an email change.
            setEmailState("request");
            return;
        }

        if (!pendingEmail.oldVerified) {
            // Waiting for verification of the previous email address.
            setEmailState("oldVerify", {
                previousEmail: pendingEmail.previousEmail || user.email,
                newEmail: pendingEmail.newEmail,
                expiresIn: 600
            });

            return;
        }

        // The previous email is verified; the new address still requires verification.
        setEmailState("newVerify", {
            newEmail: user.email
        });
    }

    /* ============================================================
     * Email Change: Step 1 — Request a Change
     * ============================================================ */

    $("#changeEmailForm").addEventListener("submit", async (event) => {
        event.preventDefault();

        const newEmail = $("#newEmail").value.trim().toLowerCase();
        const password = $("#confirmPasswordForEmail").value;
        const form = $("#changeEmailForm");

        FormKit.clearAllErrors(form);

        if (!newEmail) {
            return FormKit.showFieldError(
                $("#newEmail"),
                "A new email address is required."
            );
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(newEmail)) {
            return FormKit.showFieldError(
                $("#newEmail"),
                "Please enter a valid email address."
            );
        }

        if (!password) {
            return FormKit.showFieldError(
                $("#confirmPasswordForEmail"),
                "Your current password is required."
            );
        }

        const button = $("#requestEmailBtn");
        const originalText = button.textContent;

        button.disabled = true;
        button.textContent = "Sending...";

        try {
            const data = await api("/api/profile/email/request", {
                method: "POST",
                body: JSON.stringify({ newEmail, password })
            });

            // Store the pending request and transition to previous-email verification.
            state.user.pendingEmail = {
                newEmail: data.newEmail,
                previousEmail: data.currentEmail,
                oldVerified: false
            };

            setEmailState("oldVerify", {
                previousEmail: data.currentEmail,
                newEmail: data.newEmail,
                expiresIn: data.expiresIn || 600
            });

            // Clear sensitive form values after a successful request.
            $("#newEmail").value = "";
            $("#confirmPasswordForEmail").value = "";

            toast(
                data.message || "A verification code has been sent to your current email address.",
                "success"
            );
        } catch (error) {
            if (error.field) {
                const field = $(`[name="${error.field}"]`);

                if (field) {
                    FormKit.showFieldError(field, error.message);
                }
            }

            toast(error.message || "Failed to request an email change.", "error");
        } finally {
            button.disabled = false;
            button.textContent = originalText;
        }
    });

    /* ============================================================
     * Email Change: Step 2 — Verify the Previous Email
     * ============================================================ */

    $("#verifyOldEmailForm").addEventListener("submit", async (event) => {
        event.preventDefault();

        const code = $("#oldEmailCode").value.trim();
        const form = $("#verifyOldEmailForm");

        FormKit.clearAllErrors(form);

        if (!/^\d{6}$/.test(code)) {
            return FormKit.showFieldError(
                $("#oldEmailCode"),
                "The verification code must contain exactly 6 digits."
            );
        }

        const button = $("#verifyOldEmailBtn");
        const originalText = button.textContent;

        button.disabled = true;
        button.textContent = "Verifying...";

        try {
            const data = await api("/api/profile/email/verify-old", {
                method: "POST",
                body: JSON.stringify({ code })
            });

            // Update the profile to reflect the new, unverified email address.
            state.user.email = data.newEmail;
            state.user.emailVerified = false;

            state.user.pendingEmail = {
                newEmail: data.newEmail,
                previousEmail: data.previousEmail,
                oldVerified: true
            };

            // Store the verification token for the email verification page.
            sessionStorage.setItem(
                "email_verify_state",
                JSON.stringify({
                    verifyToken: data.verifyToken,
                    email: data.newEmail
                })
            );

            setEmailState("newVerify", {
                newEmail: data.newEmail
            });

            renderUser();

            toast(
                `Your email address has been changed. A verification code has been sent to ${data.newEmail}.`,
                "success"
            );
        } catch (error) {
            FormKit.showFieldError(
                $("#oldEmailCode"),
                error.message
            );
        } finally {
            button.disabled = false;
            button.textContent = originalText;
        }
    });

    /* ============================================================
     * Email Change: Step 3 — Verify or Revert
     * ============================================================ */

    $("#goToVerifyEmail").addEventListener("click", () => {
        location.href = "/auth/verify-email";
    });

    $("#cancelNewVerify").addEventListener("click", async () => {
        const confirmed = await confirmDialog({
            title: "Cancel Email Change",
            message: "Your email address will be reverted to the previous address. Are you sure?",
            confirmText: "Yes, Revert",
            danger: true
        });

        if (!confirmed) {
            return;
        }

        try {
            const data = await api("/api/profile/email/pending", {
                method: "DELETE"
            });

            state.user.email = data.email;
            state.user.emailVerified = true;
            state.user.pendingEmail = null;

            renderUser();
            setEmailState("request");

            toast(
                data.message || "Your previous email address has been restored.",
                "success"
            );
        } catch (error) {
            toast(
                error.message || "Failed to revert the email change.",
                "error"
            );
        }
    });

    /* ============================================================
     * Email Change: Cancel Before Previous-Email Verification
     * ============================================================ */

    $("#cancelOldVerify").addEventListener("click", async () => {
        const confirmed = await confirmDialog({
            title: "Cancel Email Change",
            message: "Are you sure you want to cancel the email change request?",
            confirmText: "Yes, Cancel",
            danger: true
        });

        if (!confirmed) {
            return;
        }

        try {
            await api("/api/profile/email/pending", {
                method: "DELETE"
            });

            state.user.pendingEmail = null;

            setEmailState("request");

            toast("Email change request cancelled successfully.", "success");
        } catch (error) {
            toast(
                error.message || "Failed to cancel the email change request.",
                "error"
            );
        }
    });

    /* ============================================================
     * Password Change: Password Strength Validation
     * ============================================================ */

    const newPasswordInput = $("#newPassword");
    const confirmNewPasswordInput = $("#confirmNewPassword");

    /**
     * Evaluates password complexity and updates the strength indicator.
     *
     * @param {string} password - The password to evaluate.
     * @returns {boolean} Whether all password requirements are satisfied.
     */
    function evaluatePassword(password) {
        const rules = {
            length: password.length >= 8,
            lower: /[a-z]/.test(password),
            upper: /[A-Z]/.test(password),
            digit: /\d/.test(password)
        };

        // Update the visual status of each password requirement.
        Object.entries(rules).forEach(([name, isSatisfied]) => {
            const ruleElement = $(`.pw-rules li[data-rule="${name}"]`);

            if (ruleElement) {
                ruleElement.classList.toggle("ok", isSatisfied);
            }
        });

        const score = Object.values(rules).filter(Boolean).length;
        const strengthIndicator = $("#newPassword")
            .closest(".field")
            .querySelector(".pw-strength");

        const strengthLabel = $("#pwStrengthLabel");

        strengthIndicator.classList.remove(
            "weak",
            "fair",
            "good",
            "strong"
        );

        if (!password) {
            strengthLabel.textContent = "";
        } else if (score <= 1) {
            strengthIndicator.classList.add("weak");
            strengthLabel.textContent = "Weak";
        } else if (score === 2) {
            strengthIndicator.classList.add("fair");
            strengthLabel.textContent = "Fair";
        } else if (score === 3) {
            strengthIndicator.classList.add("good");
            strengthLabel.textContent = "Good";
        } else {
            strengthIndicator.classList.add("strong");
            strengthLabel.textContent = "Strong";
        }

        return score === 4;
    }

    newPasswordInput.addEventListener("input", () => {
        evaluatePassword(newPasswordInput.value);
        checkPasswordMatch();
    });

    confirmNewPasswordInput.addEventListener("input", checkPasswordMatch);

    /**
     * Validates the password confirmation field and updates its error state.
     */
    function checkPasswordMatch() {
        const errorElement = $("#matchError");
        const confirmationField = confirmNewPasswordInput.closest(".field");

        if (!confirmNewPasswordInput.value) {
            errorElement.textContent = "";
            errorElement.classList.remove("visible");
            confirmationField.classList.remove("has-error");
            return;
        }

        if (newPasswordInput.value !== confirmNewPasswordInput.value) {
            errorElement.textContent = "Passwords do not match.";
            errorElement.classList.add("visible");
            confirmationField.classList.add("has-error");
        } else {
            errorElement.textContent = "";
            errorElement.classList.remove("visible");
            confirmationField.classList.remove("has-error");
        }
    }

    /* ============================================================
     * Password Change: Step 1 — Request Verification
     * ============================================================ */

    $("#passwordRequestForm").addEventListener("submit", async (event) => {
        event.preventDefault();

        const currentPassword = $("#currentPassword").value;
        const newPassword = newPasswordInput.value;
        const confirmPassword = confirmNewPasswordInput.value;
        const errors = {};

        if (!currentPassword) {
            errors.currentPassword = "Your current password is required.";
        }

        if (!newPassword || newPassword.length < 8) {
            errors.newPassword = "The new password must contain at least 8 characters.";
        } else if (!evaluatePassword(newPassword)) {
            errors.newPassword = "The new password does not meet all the requirements.";
        }

        if (newPassword !== confirmPassword) {
            errors.confirmPassword = "Password confirmation does not match.";
        }

        if (
            currentPassword &&
            newPassword &&
            currentPassword === newPassword
        ) {
            errors.newPassword = "The new password must differ from your current password.";
        }

        if (Object.keys(errors).length > 0) {
            FormKit.clearAllErrors($("#passwordRequestForm"));

            if (errors.currentPassword) {
                FormKit.showFieldError(
                    $("#currentPassword"),
                    errors.currentPassword
                );
            }

            if (errors.newPassword) {
                FormKit.showFieldError(
                    newPasswordInput,
                    errors.newPassword
                );
            }

            if (errors.confirmPassword) {
                FormKit.showFieldError(
                    confirmNewPasswordInput,
                    errors.confirmPassword
                );
            }

            return;
        }

        FormKit.clearAllErrors($("#passwordRequestForm"));

        const button = $("#requestPwBtn");
        const originalText = button.textContent;

        button.disabled = true;
        button.textContent = "Sending...";

        try {
            const data = await api("/api/profile/password/request", {
                method: "POST",
                body: JSON.stringify({
                    currentPassword,
                    newPassword,
                    confirmPassword
                })
            });

            // Retain the password values only for the current verification flow.
            state.newPasswordPlain = {
                newPassword,
                confirmPassword
            };

            // Display the OTP confirmation form.
            $("#passwordRequestForm").closest(".st-card").style.display = "none";
            $("#confirmPasswordCard").style.display = "";

            $("#pwEmailHint").textContent =
                `A 6-digit verification code has been sent to ${data.email}.`;

            // Populate the hidden confirmation fields.
            $('#passwordConfirmForm [name="newPassword"]').value = newPassword;
            $('#passwordConfirmForm [name="confirmPassword"]').value = confirmPassword;

            setTimeout(() => {
                $("#passwordCode").focus();
            }, 300);
        } catch (error) {
            if (error.field) {
                const field = $(`[name="${error.field}"]`);

                if (field) {
                    FormKit.showFieldError(field, error.message);
                }
            }

            toast(
                error.message || "Failed to initiate the password change.",
                "error"
            );
        } finally {
            button.disabled = false;
            button.textContent = originalText;
        }
    });

    /* ============================================================
     * Password Change: Reset Workflow
     * ============================================================ */

    /**
     * Restores the initial password change form and clears temporary values.
     */
    function resetPasswordFlow() {
        $("#passwordRequestForm").closest(".st-card").style.display = "";
        $("#confirmPasswordCard").style.display = "none";

        $("#passwordRequestForm").reset();
        $("#passwordConfirmForm").reset();

        $("#pwStrengthLabel").textContent = "";
        $("#matchError").textContent = "";
        $("#matchError").classList.remove("visible");

        $$(".pw-rules li").forEach((item) => {
            item.classList.remove("ok");
        });

        const strengthIndicator = $("#newPassword")
            .closest(".field")
            .querySelector(".pw-strength");

        strengthIndicator.classList.remove(
            "weak",
            "fair",
            "good",
            "strong"
        );

        confirmNewPasswordInput.closest(".field").classList.remove("has-error");

        state.newPasswordPlain = null;
    }

    /* ============================================================
     * Password Change: Step 2 — Confirm and Apply
     * ============================================================ */

    $("#passwordConfirmForm").addEventListener("submit", async (event) => {
        event.preventDefault();

        const code = $("#passwordCode").value.trim();

        const newPassword =
            $('#passwordConfirmForm [name="newPassword"]').value;

        const confirmPassword =
            $('#passwordConfirmForm [name="confirmPassword"]').value;

        if (!/^\d{6}$/.test(code)) {
            return FormKit.showFieldError(
                $("#passwordCode"),
                "The verification code must contain exactly 6 digits."
            );
        }

        if (!newPassword) {
            toast(
                "The new password is no longer available. Please restart the process.",
                "error"
            );

            return resetPasswordFlow();
        }

        FormKit.clearAllErrors($("#passwordConfirmForm"));

        const button = $("#confirmPwBtn");
        const originalText = button.textContent;

        button.disabled = true;
        button.textContent = "Updating...";

        try {
            const data = await api("/api/profile/password/confirm", {
                method: "POST",
                body: JSON.stringify({
                    code,
                    newPassword,
                    confirmPassword
                })
            });

            toast("Password changed successfully.", "success");

            const message = data.revokedSessions
                ? `You have been signed out from ${data.revokedSessions} other device(s).`
                : "You have been signed out from all devices.";

            await confirmDialog({
                title: "Password Changed Successfully",
                message,
                confirmText: "Got It",
                danger: false
            });

            resetPasswordFlow();
        } catch (error) {
            FormKit.showFieldError(
                $("#passwordCode"),
                error.message
            );
        } finally {
            button.disabled = false;
            button.textContent = originalText;
        }
    });

    $("#cancelPasswordChange").addEventListener("click", () => {
        resetPasswordFlow();
    });

    /* ============================================================
     * Session Management — Sign Out All Devices
     * ============================================================ */

    $("#logoutAllBtn").addEventListener("click", async () => {
        const confirmed = await confirmDialog({
            title: "Sign Out of All Devices",
            message: "All your active sessions will be terminated. Do you want to continue?",
            confirmText: "Yes, Sign Out Everywhere",
            danger: true
        });

        if (!confirmed) {
            return;
        }

        try {
            await api("/api/auth/logout-all", {
                method: "POST"
            });

            location.href = "/";
        } catch (error) {
            toast(
                error.message || "Failed to sign out of all devices.",
                "error"
            );
        }
    });

    /* ============================================================
     * Password Visibility Toggle
     * ============================================================ */

    document.querySelectorAll(".toggle-pass").forEach((button) => {
        button.addEventListener("click", () => {
            const input = document.getElementById(button.dataset.target);

            if (!input) {
                return;
            }

            const isPassword = input.type === "password";

            input.type = isPassword ? "text" : "password";

            button.classList.toggle("active", isPassword);

            button.setAttribute(
                "aria-label",
                isPassword ? "Hide password" : "Show password"
            );
        });
    });

    /* ============================================================
     * HTML Escaping Utility
     * ============================================================ */

    /**
     * Escapes HTML-sensitive characters before inserting untrusted text into HTML.
     *
     * @param {*} value - The value to escape.
     * @returns {string} The escaped string.
     */
    function escapeHtml(value) {
        if (value == null) {
            return "";
        }

        return String(value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    /* ============================================================
     * Initialization
     * ============================================================ */

    loadUser();
});

/**
 * Copyright (c) 2026 Sobhan Rasoulzadeh Asl (Sobhan-SRZA / Mr. Sinre)
 *
 * Licensed under the BSD 3-Clause License.
 * See the LICENSE file in the project root for license information.
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */