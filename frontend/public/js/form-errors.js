/* ============================================================
   FormKit — Resilient Form Error Management
   ============================================================
   Centralised utility for validating forms, displaying field-level
   and form-level errors, presenting server error payloads, and
   managing submission loading state. Exposed as `window.FormKit`.
   ============================================================ */

(function (global) {
    "use strict";

    /* --------------------------------------------------------
       DEBUG
       --------------------------------------------------------
       Verbose logging is enabled only on local development hosts.
       -------------------------------------------------------- */
    const DEBUG = location.hostname === "localhost" || location.hostname === "127.0.0.1";
    const log = (...args) => DEBUG && console.log("🟦 [FormKit]", ...args);
    const warn = (...args) => console.warn("🟨 [FormKit]", ...args);

    /* --------------------------------------------------------
       Safe Global Accessors
       --------------------------------------------------------
       Gracefully invoke optional global helpers (toast, dialog,
       confirm) when available, falling back to native browser
       primitives otherwise. Prevents a missing helper from
       breaking the error pipeline.
       -------------------------------------------------------- */
    function safeToast(message, type = "info") {
        if (typeof global.toast === "function") {
            try {
                global.toast(message, type);

                return;
            }

            catch (e) {
                warn("toast threw:", e);
            }
        }

        // Fallback to the console when no toast helper is present.
        if (type === "error")
            console.error("[toast]", message);

        else
            console.log("[toast]", message);
    }

    function safeDialog(title, message) {
        if (typeof global.openDialogError === "function") {
            try {
                global.openDialogError(title, message);

                return;
            }

            catch (e) {
                warn("openDialogError threw:", e);
            }
        }

        if (typeof global.alert === "function")
            global.alert(`${title}\n${message}`);
    }

    function safeConfirm(opts) {
        if (typeof global.confirmDialog === "function") {
            try {
                return global.confirmDialog(opts);
            }

            catch (e) {
                warn("confirmDialog threw:", e);
            }
        }

        // Fall back to the native browser confirmation dialog.
        return Promise.resolve(global.confirm(opts.message || "Are you sure?"));
    }

    /* --------------------------------------------------------
       Constants
       -------------------------------------------------------- */
    const ERROR_CODES = {
        VALIDATION_ERROR: "VALIDATION_ERROR",
        USERNAME_TAKEN: "USERNAME_TAKEN",
        EMAIL_TAKEN: "EMAIL_TAKEN",
        USERNAME_INVALID: "USERNAME_INVALID",
        EMAIL_INVALID: "EMAIL_INVALID",
        PASSWORD_TOO_SHORT: "PASSWORD_TOO_SHORT",
        PASSWORD_TOO_WEAK: "PASSWORD_TOO_WEAK",
        PASSWORDS_DONT_MATCH: "PASSWORDS_DONT_MATCH",
        TERMS_NOT_ACCEPTED: "TERMS_NOT_ACCEPTED",
        INVALID_CREDENTIALS: "INVALID_CREDENTIALS",
        ACCOUNT_DISABLED: "ACCOUNT_DISABLED",
        TOO_MANY_ATTEMPTS: "TOO_MANY_ATTEMPTS",
        SESSION_EXPIRED: "SESSION_EXPIRED",
        INVALID_TOKEN: "INVALID_TOKEN",
        UNAUTHENTICATED: "UNAUTHENTICATED",
        NETWORK_ERROR: "NETWORK_ERROR",
        INTERNAL_ERROR: "INTERNAL_ERROR"
    };

    /* Maps server error codes to the form field that should own them. */
    const CODE_TO_FIELD = {
        [ERROR_CODES.USERNAME_TAKEN]: "username",
        [ERROR_CODES.EMAIL_TAKEN]: "email",
        [ERROR_CODES.USERNAME_INVALID]: "username",
        [ERROR_CODES.EMAIL_INVALID]: "email",
        [ERROR_CODES.PASSWORD_TOO_SHORT]: "password",
        [ERROR_CODES.PASSWORD_TOO_WEAK]: "password",
        [ERROR_CODES.PASSWORDS_DONT_MATCH]: "confirmPassword",
        [ERROR_CODES.TERMS_NOT_ACCEPTED]: "terms",
        [ERROR_CODES.INVALID_CREDENTIALS]: "identifier"
    };

    /* --------------------------------------------------------
       Helpers
       -------------------------------------------------------- */
    const q = (sel, root = document) => root.querySelector(sel);
    const qa = (sel, root = document) => Array.from(root.querySelectorAll(sel));

    /**
     * Resolve the field wrapper element that owns the given input.
     *
     * Resolution order:
     *   1. The nearest `.field` ancestor.
     *   2. The parent of a `.password-wrap` (common when the input
     *      is paired with a visibility toggle button).
     *   3. The input's direct parent as a final fallback.
     */
    function findFieldWrapper(input) {
        if (!input)
            return null;

        // 1. Direct `.field` ancestor.
        let wrapper = input.closest(".field");
        if (wrapper)
            return wrapper;

        // 2. `.password-wrap` — the field wrapper lives one level up.
        const pwdWrap = input.closest(".password-wrap");
        if (pwdWrap && pwdWrap.parentElement) {
            const above = pwdWrap.parentElement;
            if (above.classList.contains("field"))
                return above;

            return above;
        }

        // 3. Fallback: the input's direct parent.
        return input.parentElement;
    }

    /* Collect all enabled, non-hidden input controls within a form. */
    function getInputs(form) {
        return qa("input[name], textarea[name], select[name]", form).filter(
            (el) => el.type !== "hidden" && !el.disabled
        );
    }

    /* Ensure the field wrapper owns an error slot element, creating one if absent. */
    function ensureErrorSlot(field) {
        if (!field)
            return null;

        let slot = field.querySelector(":scope > .field-error");
        if (!slot)
            slot = field.querySelector(".field-error");

        if (!slot) {
            slot = document.createElement("div");
            slot.className = "field-error";
            slot.setAttribute("role", "alert");
            field.appendChild(slot);
        }

        return slot;
    }

    /* --------------------------------------------------------
       Field Error Display
       -------------------------------------------------------- */

    /**
     * Mark the given input's field wrapper as invalid and render the
     * supplied message. Also triggers a shake animation and scrolls
     * the field into view once per validation cycle.
     */
    function showFieldError(input, message) {
        if (!input)
            return;

        const field = findFieldWrapper(input);
        if (!field) {
            warn("no wrapper for input", input);

            return;
        }

        field.classList.add("has-error");
        field.classList.remove("has-success");
        field.classList.add("shake");

        const slot = ensureErrorSlot(field);
        if (slot) {
            slot.textContent = message || "This field is invalid";
            slot.style.display = "";        // Reset any inline style.
            slot.style.maxHeight = "";      // Reset any inline style.
            slot.style.opacity = "";        // Reset any inline style.
        }

        input.setAttribute("aria-invalid", "true");

        // Remove the shake class when the animation ends.
        const onEnd = () => field.classList.remove("shake");
        field.addEventListener("animationend", onEnd, { once: true });

        // Safety net in case `animationend` never fires (no CSS animation).
        setTimeout(() => {
            field.classList.remove("shake");
            field.removeEventListener("animationend", onEnd);
        }, 600);

        // Scroll the invalid field into view once per validation cycle.
        if (!field.dataset.scrolled) {
            field.dataset.scrolled = "1";
            try {
                field.scrollIntoView({ behavior: "smooth", block: "center" });
            }

            catch {
                field.scrollIntoView();
            }
        }
    }

    /* Clear the error state and message associated with a single input. */
    function clearFieldError(input) {
        const field = findFieldWrapper(input);
        if (!field)
            return;

        field.classList.remove("has-error", "shake");
        input.removeAttribute("aria-invalid");
        delete field.dataset.scrolled;

        const slot = field.querySelector(".field-error");
        if (slot)
            slot.textContent = "";
    }

    /* Clear every field-level error and the form-level banner. */
    function clearAllErrors(form) {
        getInputs(form).forEach(clearFieldError);
        form.querySelectorAll(".has-error, .shake").forEach((el) => {
            el.classList.remove("has-error", "shake");
        });

        const banner = form.querySelector(".form-error-banner");
        if (banner) {
            banner.classList.remove("visible");
            const t = banner.querySelector(".form-error-banner__text");
            if (t)
                t.textContent = "";
        }
    }

    /* --------------------------------------------------------
       Form-Level Banner
       -------------------------------------------------------- */

    /**
     * Render a form-level error banner. The banner element is created
     * lazily and inserted as the first child of the form.
     */
    function showFormBanner(form, message) {
        let banner = form.querySelector(".form-error-banner");
        if (!banner) {
            banner = document.createElement("div");
            banner.className = "form-error-banner";
            banner.innerHTML = `<span class="form-error-banner__icon">!</span><span class="form-error-banner__text"></span>`;
            form.insertBefore(banner, form.firstChild);
        }

        const text = banner.querySelector(".form-error-banner__text");
        if (text)
            text.textContent = message;

        banner.classList.add("visible");
    }

    /* --------------------------------------------------------
       Server Error Extraction
       -------------------------------------------------------- */

    /**
     * Normalise the many shapes of server error payloads into a
     * field-name → messages map. Supported shapes include:
     *   - `details` / `fields` objects (values as strings or arrays)
     *   - `errors` array of `{ path, msg | message }`
     *   - single `{ field, message }` pair
     *   - `{ code, message }` mapped through `CODE_TO_FIELD`
     *   - `_form` messages promoted to a `__form__` bucket
     */
    function extractFieldErrors(payload) {
        if (!payload || typeof payload !== "object")
            return {};

        const map = {};

        const push = (key, msg) => {
            if (!key)
                return;

            const k = Array.isArray(key) ? key.join(".") : String(key);
            map[k] = map[k] || [];
            if (msg)
                map[k].push(String(msg));
        };

        // 1. `details` object.
        if (payload.details && typeof payload.details === "object") {
            for (const [key, val] of Object.entries(payload.details)) {
                if (Array.isArray(val))
                    val.forEach((m) => push(key, m));

                else if (val && typeof val === "object" && val.message)
                    push(key, val.message);

                else
                    push(key, val);
            }
        }

        // 2. `fields` object.
        if (payload.fields && typeof payload.fields === "object") {
            for (const [key, val] of Object.entries(payload.fields)) {
                if (Array.isArray(val))
                    val.forEach((m) => push(key, m));

                else if (val && typeof val === "object" && val.message)
                    push(key, val.message);

                else
                    push(key, val);
            }
        }

        // 3. `errors` array.
        if (Array.isArray(payload.errors)) {
            payload.errors.forEach((e) => {
                if (e && e.path)
                    push(e.path, e.msg || e.message);
            });
        }

        // 4. Single `{ field, message }` pair.
        if (payload.field && payload.message && Object.keys(map).length === 0) {
            push(payload.field, payload.message);
        }

        // 5. `{ code, message }` mapped through CODE_TO_FIELD.
        else if (payload.code && payload.message && Object.keys(map).length === 0) {
            const fieldFromCode = CODE_TO_FIELD[payload.code];
            if (fieldFromCode)
                push(fieldFromCode, payload.message);
        }

        // 6. Promote a lone `_form` entry to `__form__` (form-level).
        if (map._form && Object.keys(map).length === 1) {
            const formMsgs = map._form;
            delete map._form;
            map.__form__ = formMsgs;
        }

        log("extracted errors:", map);

        return map;
    }

    /**
     * Apply server-supplied errors to their corresponding form fields.
     * Returns `true` when at least one field-level error was rendered.
     */
    function applyServerErrors(form, payload) {
        const map = extractFieldErrors(payload);
        const fieldKeys = Object.keys(map).filter((k) => k !== "__form__");
        let firstInvalid = null;

        for (const name of fieldKeys) {
            // The `terms` checkbox may sit outside a `.field` wrapper, but
            // it is still selectable via `input[name]`.
            const input = form.querySelector(`[name="${CSS.escape(name)}"]`);
            if (!input) {
                warn(`input not found for field: ${name}`);

                continue;
            }

            showFieldError(input, map[name][0]);
            if (!firstInvalid)
                firstInvalid = input;
        }

        // Fall back to the banner when only form-level errors exist.
        if (!firstInvalid && map.__form__ && map.__form__.length) {
            showFormBanner(form, map.__form__[0]);
        }

        if (firstInvalid) {
            try {
                firstInvalid.focus({ preventScroll: true });
            }

            catch {
                firstInvalid.focus();
            }
        }

        return fieldKeys.length > 0;
    }

    /* --------------------------------------------------------
       Error Presentation
       -------------------------------------------------------- */

    /**
     * Present an error payload to the user using the most appropriate
     * channel (field-level, form banner, toast, or modal dialog),
     * chosen based on the error code.
     */
    function presentError(form, payload, opts = {}) {
        const { showDialogOnError = false } = opts;
        const code = payload?.code || "";
        const message = payload?.message || "An unexpected error occurred";

        log("presenting error:", { code, message, payload });

        let hasFieldErrors = false;
        try {
            hasFieldErrors = applyServerErrors(form, payload);
        }

        catch (e) {
            warn("applyServerErrors threw:", e);
        }

        if (hasFieldErrors) {
            safeToast(message, "error");

            return {
                handled: "field",
                code
            };
        }

        switch (code) {
            case ERROR_CODES.INVALID_CREDENTIALS:
                showFormBanner(form, message);
                safeToast(message, "error");

                return {
                    handled: "credentials",
                    code
                };

            case ERROR_CODES.TOO_MANY_ATTEMPTS:
            case ERROR_CODES.ACCOUNT_DISABLED:
            case ERROR_CODES.SESSION_EXPIRED:
                safeDialog("Error", message);

                return {
                    handled: "dialog",
                    code
                };

            case ERROR_CODES.NETWORK_ERROR:
                showFormBanner(form, message);
                safeToast(message, "error");

                return {
                    handled: "network",
                    code
                };

            case ERROR_CODES.INTERNAL_ERROR:
                safeDialog("Server Error", message);

                return {
                    handled: "server",
                    code
                };

            default:
                showFormBanner(form, message);
                if (showDialogOnError)
                    safeDialog("Error", message);

                else
                    safeToast(message, "error");

                return {
                    handled: "general",
                    code
                };
        }
    }

    /* --------------------------------------------------------
       Loading State
       -------------------------------------------------------- */

    /**
     * Toggle a form's submission loading state. While loading, the
     * submit button is disabled and all other controls are locked to
     * prevent duplicate submissions.
     */
    function setFormLoading(form, loading) {
        const btn = form.querySelector("button[type='submit'], .auth-btn");
        if (!btn)
            return;

        if (loading) {
            btn.dataset.originalText = btn.textContent;
            btn.classList.add("loading");
            btn.disabled = true;
            form.querySelectorAll("input, textarea, select, button").forEach((el) => {
                if (el !== btn)
                    el.disabled = true;
            });
        }

        else {
            btn.classList.remove("loading");
            if (btn.dataset.originalText) {
                btn.textContent = btn.dataset.originalText;
                delete btn.dataset.originalText;
            }

            btn.disabled = false;
            form.querySelectorAll("input, textarea, select, button").forEach((el) => {
                el.disabled = false;
            });
        }
    }

    /* --------------------------------------------------------
       Value Reading
       -------------------------------------------------------- */

    /**
     * Collect the current values of all named controls in the form.
     * Checkboxes resolve to booleans, radio groups to the selected
     * value, and text-like inputs are trimmed.
     */
    function readValues(form) {
        const out = {};

        getInputs(form).forEach((el) => {
            if (el.type === "checkbox")
                out[el.name] = el.checked;

            else if (el.type === "radio") {
                if (el.checked)
                    out[el.name] = el.value;
            }

            else
                out[el.name] = el.value.trim();
        });

        return out;
    }

    /* --------------------------------------------------------
       Native Validation
       -------------------------------------------------------- */

    /**
     * Run the browser's built-in constraint validation across every
     * eligible control. Invalid fields receive an inline error and
     * the first invalid control is focused.
     */
    function runNativeValidation(form) {
        let valid = true;
        let firstInvalid = null;

        getInputs(form).forEach((el) => {
            if (!el.willValidate)
                return;

            if (el.checkValidity())
                return;

            valid = false;
            showFieldError(el, el.validationMessage || "This field is invalid");
            if (!firstInvalid)
                firstInvalid = el;
        });

        if (firstInvalid) {
            try {
                firstInvalid.focus({ preventScroll: true });
            }

            catch {
                firstInvalid.focus();
            }
        }

        return valid;
    }

    /* --------------------------------------------------------
       Attach
       -------------------------------------------------------- */

    /**
     * Bind submission handling to a form.
     *
     * @param {string|HTMLFormElement} target   Form selector or element.
     * @param {object} options
     *   - validate(values):  Sync client-side validation returning a map of
     *                        field → message. A `__form__` key is treated as
     *                        a form-level error.
     *   - submit(values):    Async submit handler; may throw server payloads.
     *   - onSuccess(data):   Invoked after a successful submission.
     *   - onError(payload):  Invoked after a failed submission.
     *   - showDialogOnError: Prefer modal dialogs for generic errors.
     *   - successMessage:    Optional toast shown after successful submit.
     *   - clearOnInput:      Automatically clear field errors on user input.
     */
    function attach(target, options = {}) {
        const form = typeof target === "string" ? q(target) : target;
        if (!form)
            throw new Error("FormKit: form not found — " + target);

        const {
            validate = null,
            submit = null,
            onSuccess = null,
            onError = null,
            showDialogOnError = false,
            successMessage = null,
            clearOnInput = true,
        } = options;

        // Clear field-level errors as soon as the user edits the field.
        if (clearOnInput) {
            getInputs(form).forEach((input) => {
                const evt = input.type === "checkbox" || input.type === "radio" ? "change" : "input";

                input.addEventListener(evt, () => {
                    const field = findFieldWrapper(input);
                    if (field && field.classList.contains("has-error")) {
                        clearFieldError(input);
                    }

                    const banner = form.querySelector(".form-error-banner.visible");
                    if (banner)
                        banner.classList.remove("visible");
                });
            });
        }

        form.addEventListener("submit", async (e) => {
            e.preventDefault();
            log("submit fired");
            clearAllErrors(form);

            const values = readValues(form);
            log("values:", values);

            // 1. Native constraint validation.
            if (!runNativeValidation(form)) {
                log("native validation failed");

                return;
            }

            // 2. Custom client-side validation.
            if (typeof validate === "function") {
                let errors;

                try {
                    errors = validate(values) || {};
                }

                catch (err) {
                    errors = { __form__: [err.message || "Validation failed"] };
                }

                const keys = Object.keys(errors);
                if (keys.length) {
                    log("client validation failed:", errors);

                    let firstInvalid = null;

                    for (const key of keys) {
                        if (key === "__form__") {
                            const msg = Array.isArray(errors[key]) ? errors[key][0] : errors[key];
                            showFormBanner(form, msg);

                            continue;
                        }

                        const input = form.querySelector(`[name="${CSS.escape(key)}"]`);
                        if (!input) {
                            warn(`no input for ${key}`);

                            continue;
                        }

                        const msg = Array.isArray(errors[key]) ? errors[key][0] : errors[key];
                        showFieldError(input, msg);
                        if (!firstInvalid)
                            firstInvalid = input;
                    }

                    if (firstInvalid) {
                        try {
                            firstInvalid.focus({ preventScroll: true });
                        }

                        catch {
                            firstInvalid.focus();
                        }
                    }

                    return;
                }
            }

            // 3. Submit to the server.
            if (typeof submit !== "function")
                return;

            setFormLoading(form, true);

            try {
                const data = await submit(values);
                log("submit success:", data);

                if (successMessage)
                    safeToast(successMessage, "success");

                if (typeof onSuccess === "function")
                    onSuccess(data);
            }

            catch (err) {
                log("submit threw:", err);
                const payload = err || {};

                try {
                    presentError(form, payload, { showDialogOnError });
                }

                catch (presentErr) {
                    console.error("❌ presentError itself threw:", presentErr);
                }

                if (typeof onError === "function") {
                    try {
                        onError(payload);
                    }

                    catch (cbErr) {
                        console.error("❌ onError callback threw:", cbErr);
                    }
                }
            }

            finally {
                setFormLoading(form, false);
            }
        });

        return {
            form,
            clearErrors: () => clearAllErrors(form),
            showError: (name, msg) => {
                const input = form.querySelector(`[name="${CSS.escape(name)}"]`);

                if (input)
                    showFieldError(input, msg);
            },
            setLoading: (b) => setFormLoading(form, b),
            values: () => readValues(form)
        };
    }

    /* --------------------------------------------------------
       Fetch Wrapper
       -------------------------------------------------------- */

    /**
     * POST a JSON payload and normalise both network failures and
     * non-2xx responses into a consistent error object thrown to
     * the caller.
     */
    async function postJSON(url, body, extra = {}) {
        let res;

        try {
            res = await fetch(url, {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body || {}),
                ...extra
            });
        }

        catch (networkErr) {
            console.error("❌ network error:", networkErr);

            throw {
                code: ERROR_CODES.NETWORK_ERROR,
                message: "Failed to connect to the server",
                status: 0
            };
        }

        let data = null;
        const ct = res.headers.get("content-type") || "";

        if (ct.includes("application/json")) {
            try {
                data = await res.json();
            }

            catch (e) {
                warn("json parse failed:", e);
            }
        }

        else {
            // Non-JSON response — surface a generic server error.
            const txt = await res.text().catch(() => "");
            warn("non-JSON response:", res.status, txt.slice(0, 200));

            data = {
                code: res.ok ? null : ERROR_CODES.INTERNAL_ERROR,
                message: res.ok ? "" : `Server error (${res.status})`,
            };
        }

        log("← response:", res.status, data);

        if (!res.ok) {
            const err = data && typeof data === "object"
                ? data
                : { message: "Network error", code: ERROR_CODES.NETWORK_ERROR };

            err.status = res.status;
            throw err;
        }

        return data;
    }

    /* --------------------------------------------------------
       Public API
       -------------------------------------------------------- */
    global.FormKit = {
        ERROR_CODES,
        CODE_TO_FIELD,
        attach,
        postJSON,
        showFieldError,
        clearFieldError,
        clearAllErrors,
        showFormBanner,
        applyServerErrors,
        presentError,
        setFormLoading,
        extractFieldErrors,
        safeToast,
        safeDialog,
        safeConfirm,
    };

    log("FormKit loaded ✓");
})(window);

/**
 * Copyright (c) 2026 Sobhan Rasoulzadeh Asl (Sobhan-SRZA / Mr. Sinre)
 *
 * Licensed under the BSD 3-Clause License.
 * See the LICENSE file in the project root for license information.
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */