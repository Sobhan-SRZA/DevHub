/* ============================================================
   Global Dialog, Confirm, and Toast API
   ------------------------------------------------------------
   Provides a unified interface for modal dialogs, promise-based
   confirmation prompts, and transient toast notifications.
   Maintains backwards compatibility with the legacy
   `openDialogError` / `closeDialogError` functions.
   ============================================================ */

(function () {
    /* ---------- Element References ---------- */
    const backdrop = document.getElementById("dialogBackdrop");

    const errDialog = document.getElementById("appDialog");
    const errIcon = document.getElementById("appDialogIcon");
    const errTitle = document.getElementById("appDialogTitle");
    const errMessage = document.getElementById("appDialogMessage");
    const errOk = document.getElementById("appDialogOk");

    const cfmDialog = document.getElementById("confirmDialog");
    const cfmIcon = document.getElementById("confirmDialogIcon");
    const cfmTitle = document.getElementById("confirmDialogTitle");
    const cfmMessage = document.getElementById("confirmDialogMessage");
    const cfmOk = document.getElementById("confirmDialogOk");
    const cfmCancel = document.getElementById("confirmDialogCancel");

    const toastWrap = document.getElementById("toastContainer");

    /* ---------- Helpers ---------- */
    function openBackdrop() {
        backdrop.classList.add("open");
    }

    function closeBackdrop() {
        backdrop.classList.remove("open");
    }

    function isAnyDialogOpen() {
        return errDialog.open || cfmDialog.open;
    }

    /* ============================================================
       ERROR / INFO DIALOG
       ------------------------------------------------------------
       Displays a modal dialog for error, success, or informational
       messages. The visual style of the icon is driven by `type`.
       ============================================================ */
    function openDialogError(title, message, type = "error") {
        errTitle.textContent = title || "Error";
        errMessage.textContent = message || "";
        errIcon.textContent = type === "success" ? "✓" : type === "info" ? "i" : "!";
        errIcon.className = `app-dialog__icon app-dialog__icon--${type}`;

        openBackdrop();
        errDialog.showModal();
    }

    function closeDialogError() {
        errDialog.close();
        if (!isAnyDialogOpen()) closeBackdrop();
    }

    errOk.addEventListener("click", closeDialogError);

    /* ============================================================
       CONFIRM DIALOG (Promise-based)
       ------------------------------------------------------------
       Presents a confirmation prompt and resolves to `true` when
       the user confirms, or `false` when the dialog is cancelled
       (including via the Escape key or backdrop click).
       ============================================================ */
    function confirmDialog(opts = {}) {
        const {
            title = "Confirm",
            message = "Are you sure?",
            confirmText = "Confirm",
            cancelText = "Cancel",
            danger = true,
        } = opts;

        return new Promise((resolve) => {
            cfmTitle.textContent = title;
            cfmMessage.textContent = message;
            cfmOk.textContent = confirmText;
            cfmCancel.textContent = cancelText;
            cfmIcon.textContent = danger ? "!" : "?";
            cfmIcon.className = `app-dialog__icon ${danger ? "app-dialog__icon--error" : "app-dialog__icon--warn"}`;
            cfmOk.className = `app-dialog__btn ${danger ? "app-dialog__btn--danger" : "app-dialog__btn--primary"}`;

            /**
             * Remove all event listeners and hide the backdrop.
             * Called from both the confirm and cancel paths.
             */
            const cleanup = () => {
                cfmOk.removeEventListener("click", onOk);
                cfmCancel.removeEventListener("click", onCancel);
                cfmDialog.removeEventListener("cancel", onCancel);
                cfmDialog.removeEventListener("close", onClose);
                closeBackdrop();
            };

            const onOk = () => {
                cleanup();
                cfmDialog.close("ok");
                resolve(true);
            };

            const onCancel = (e) => {
                e?.preventDefault?.();
                cleanup();
                cfmDialog.close("cancel");
                resolve(false);
            };

            const onClose = () => {
                /* Safety net — no additional action required. */
            };

            cfmOk.addEventListener("click", onOk);
            cfmCancel.addEventListener("click", onCancel);
            cfmDialog.addEventListener("cancel", onCancel); // Handle Escape key.
            cfmDialog.addEventListener("close", onClose);

            openBackdrop();
            cfmDialog.showModal();
        });
    }

    /* ============================================================
       TOAST
       ------------------------------------------------------------
       Renders a transient notification that automatically dismisses
       after the specified duration. Users may dismiss it manually.
       ============================================================ */
    function toast(message, type = "info", duration = 3200) {
        const el = document.createElement("div");
        el.className = `app-toast app-toast--${type}`;
        el.setAttribute("role", "status");

        const icons = {
            success: "✓",
            error: "!",
            info: "i",
            warn: "!"
        };

        el.innerHTML = `
            <span class="app-toast__icon">${icons[type] || "i"}</span>
            <span class="app-toast__message"></span>
            <button type="button" class="app-toast__close" aria-label="Close">×</button>
        `;
        el.querySelector(".app-toast__message").textContent = message;
        el.querySelector(".app-toast__close").addEventListener("click", () => dismiss());

        toastWrap.appendChild(el);

        // Trigger the entry animation on the next animation frame.
        requestAnimationFrame(() => el.classList.add("app-toast--visible"));

        let timer = setTimeout(() => dismiss(), duration);

        /**
         * Begin the dismissal sequence: hide the toast and remove it
         * from the DOM after its exit transition completes.
         */
        function dismiss() {
            clearTimeout(timer);
            el.classList.remove("app-toast--visible");
            el.addEventListener("transitionend", () => el.remove(), {
                once: true
            });
        }
    }

    /* ============================================================
       Backdrop Click — Close Any Open Dialog
       ============================================================ */
    backdrop.addEventListener("click", () => {
        cfmDialog.close("cancel");
        closeDialogError();
    });

    /* ============================================================
       Escape Key — Safety Net
       ------------------------------------------------------------
       Closes any open dialog if the native `cancel` event does not
       fire (for example, in browsers with partial dialog support).
       ============================================================ */
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
            cfmDialog.close("cancel");
            closeDialogError();
        }
    });

    /* ============================================================
       Expose Public API Globally
       ============================================================ */
    window.openDialogError = openDialogError;
    window.closeDialogError = closeDialogError;
    window.confirmDialog = confirmDialog;
    window.toast = toast;
})();


/**
 * Copyright (c) 2026 Sobhan Rasoulzadeh Asl (Sobhan-SRZA / Mr. Sinre)
 *
 * Licensed under the BSD 3-Clause License.
 * See the LICENSE file in the project root for license information.
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */