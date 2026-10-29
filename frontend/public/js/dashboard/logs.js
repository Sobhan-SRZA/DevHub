/* ============================================================
 * Logs Page
 * ============================================================ */

document.addEventListener("DOMContentLoaded", () => {
    const $ = (selector) => document.querySelector(selector);
    const $$ = (selector) => Array.from(document.querySelectorAll(selector));

    const state = {
        level: "all",
        search: "",
        file: "live",
        autoRefresh: true,
        follow: true,
        interval: null,
        lastCount: 0,
        filesLoaded: false
    };

    /* ============================================================
     * Formatting Utilities
     * ============================================================ */

    /**
     * Escapes HTML-sensitive characters to prevent HTML injection.
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

    /**
     * Escapes regular expression metacharacters in a search query.
     *
     * @param {string} value - The search query.
     * @returns {string} The escaped query.
     */
    function escapeRegExp(value) {
        return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }

    /**
     * Highlights search matches in a log message.
     *
     * @param {string} message - The log message.
     * @param {string} search - The search query.
     * @returns {string} The escaped message with highlighted matches.
     */
    function highlight(message, search) {
        const safeMessage = escapeHtml(message);

        if (!search) {
            return safeMessage;
        }

        const regex = new RegExp(`(${escapeRegExp(search)})`, "gi");

        return safeMessage.replace(regex, "<mark>$1</mark>");
    }

    /**
     * Formats a timestamp using the Persian locale.
     *
     * @param {string|number|Date} timestamp - The timestamp to format.
     * @returns {string} The formatted time or the original value if invalid.
     */
    function formatTime(timestamp) {
        if (!timestamp) {
            return "";
        }

        try {
            return new Date(timestamp);
        } catch {
            return String(timestamp);
        }
    }

    /* ============================================================
     * Log Rendering
     * ============================================================ */

    /**
     * Renders log entries, statistics, and terminal metadata.
     *
     * @param {Array<Object>} entries - The log entries to display.
     * @param {Object|null} stats - Aggregated log statistics.
     * @param {string} source - The source of the displayed logs.
     */
    function renderLogs(entries, stats, source) {
        const terminal = $("#logsTerminal");

        if (!entries.length) {
            terminal.innerHTML = `
                <div class="logs-empty">
                    No log entries match the selected filters.
                </div>
            `;
        } else {
            terminal.innerHTML = entries.map((entry) => `
                <div class="log-line" data-level="${escapeHtml(entry.level)}">
                    <span class="log-line__time">${escapeHtml(formatTime(entry.timestamp))}</span>
                    <span class="log-line__level">${escapeHtml(entry.level)}</span>
                    <span class="log-line__message">${highlight(entry.message, state.search)}</span>
                </div>
            `).join("");
        }

        // Update the log statistics.
        if (stats) {
            $("#statTotal").textContent = Number(stats.total || 0);
            $("#statInfo").textContent = Number(stats.info || 0);
            $("#statWarn").textContent = Number(stats.warn || 0);
            $("#statError").textContent = Number(stats.error || 0);
            $("#statDebug").textContent = Number(stats.debug || 0);
        }

        // Update the terminal footer.
        $("#logsCount").textContent =
            `${Number(entries.length)} log entries`;

        $("#logsSource").textContent = source === "live"
            ? "Source: In-memory buffer"
            : `Source: ${source}`;

        $("#logsLastUpdate").textContent =
            `Last updated: ${new Date()}`;

        // Keep the terminal scrolled to the latest entry when follow mode is enabled.
        if (state.follow) {
            terminal.scrollTop = terminal.scrollHeight;
        }
    }

    /* ============================================================
     * Log File Discovery
     * ============================================================ */

    /**
     * Retrieves available log files and populates the file selector.
     */
    async function loadFiles() {
        try {
            const response = await fetch("/api/system/logs?limit=1", {
                credentials: "include"
            });

            if (!response.ok) {
                return;
            }

            const data = await response.json();

            if (!data.files || !data.files.length) {
                return;
            }

            const select = $("#fileFilter");
            const currentFile = select.value || state.file;

            select.innerHTML = `
                <option value="live">Live (Memory)</option>
                ${data.files.map((file) => `
                    <option value="${escapeHtml(file)}">${escapeHtml(file)}</option>
                `).join("")}
            `;

            // Preserve the current selection when the file is still available.
            const availableFiles = Array.from(select.options).map(
                (option) => option.value
            );

            select.value = availableFiles.includes(currentFile)
                ? currentFile
                : "live";

            state.file = select.value;
            state.filesLoaded = true;
        } catch {
            // File discovery failures should not interrupt log viewing.
        }
    }

    /* ============================================================
     * Log Retrieval
     * ============================================================ */

    /**
     * Fetches log entries from the API and updates the terminal.
     */
    async function load() {
        try {
            const params = new URLSearchParams({
                limit: "300",
                level: state.level,
                search: state.search,
                file: state.file
            });

            const response = await fetch(
                `/api/system/logs?${params}`,
                { credentials: "include" }
            );

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();
            const entries = data.entries || [];

            renderLogs(entries, data.stats, data.source);

            state.lastCount = entries.length;

            if (!state.filesLoaded) {
                loadFiles();
            }
        } catch (error) {
            console.error("[Logs] Failed to load log entries:", error);

            $("#logsTerminal").innerHTML = `
                <div class="logs-empty">
                    Failed to retrieve logs: ${escapeHtml(error.message)}
                </div>
            `;
        }
    }

    /* ============================================================
     * Automatic Refresh
     * ============================================================ */

    /**
     * Starts periodic log retrieval.
     */
    function startAuto() {
        stopAuto();
        state.interval = setInterval(load, 3000);
    }

    /**
     * Stops periodic log retrieval.
     */
    function stopAuto() {
        if (state.interval) {
            clearInterval(state.interval);
            state.interval = null;
        }
    }

    /* ============================================================
     * Debounce Utility
     * ============================================================ */

    /**
     * Delays function execution until the specified interval has elapsed
     * without another invocation.
     *
     * @param {Function} callback - The function to execute.
     * @param {number} [wait=300] - The debounce interval in milliseconds.
     * @returns {Function} The debounced function.
     */
    function debounce(callback, wait = 300) {
        let timeout;

        return (...args) => {
            clearTimeout(timeout);

            timeout = setTimeout(() => {
                callback(...args);
            }, wait);
        };
    }

    /* ============================================================
     * Event Handlers
     * ============================================================ */

    // Filter log entries by clicking a statistics card.
    $$(".log-stat-card").forEach((card) => {
        card.addEventListener("click", () => {
            const level = card.dataset.level;

            state.level = level;
            $("#levelFilter").value = level;

            $$(".log-stat-card").forEach((item) => {
                item.classList.toggle("active", item === card);
            });

            load();
        });
    });

    // Handle changes to the log severity filter.
    $("#levelFilter").addEventListener("change", (event) => {
        state.level = event.target.value;

        $$(".log-stat-card").forEach((card) => {
            card.classList.toggle(
                "active",
                card.dataset.level === state.level
            );
        });

        load();
    });

    // Handle changes to the selected log source.
    $("#fileFilter").addEventListener("change", (event) => {
        state.file = event.target.value;
        load();
    });

    // Debounce search input to avoid unnecessary API requests.
    const doSearch = debounce(load, 300);

    $("#searchInput").addEventListener("input", (event) => {
        state.search = event.target.value.trim();
        doSearch();
    });

    // Enable or disable periodic log retrieval.
    $("#autoRefreshToggle").addEventListener("change", (event) => {
        state.autoRefresh = event.target.checked;

        if (state.autoRefresh) {
            startAuto();
        } else {
            stopAuto();
        }
    });

    // Keep the terminal positioned at the latest entry when follow mode is enabled.
    $("#followToggle").addEventListener("change", (event) => {
        state.follow = event.target.checked;

        if (state.follow) {
            const terminal = $("#logsTerminal");
            terminal.scrollTop = terminal.scrollHeight;
        }
    });

    // Manually refresh the available log files and displayed entries.
    $("#refreshBtn").addEventListener("click", () => {
        loadFiles();
        load();
    });

    // Download the selected log file.
    $("#downloadBtn").addEventListener("click", () => {
        const file = state.file === "live"
            ? `app-${new Date().toISOString().split("T")[0]}.log`
            : state.file;

        window.location.href =
            `/api/system/logs/download?file=${encodeURIComponent(file)}`;
    });

    // Clear in-memory logs after explicit user confirmation.
    $("#clearBtn").addEventListener("click", async () => {
        const confirmed = typeof confirmDialog === "function"
            ? await confirmDialog({
                title: "Clear Logs",
                message: "Clear all log entries from memory? Log files will remain unchanged.",
                confirmText: "Yes, Clear Logs",
                danger: true
            })
            : confirm("Are you sure you want to clear the logs?");

        if (!confirmed) {
            return;
        }

        try {
            const response = await fetch("/api/system/logs/clear", {
                method: "POST",
                credentials: "include"
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            if (typeof window.toast === "function") {
                toast("Logs cleared successfully.", "success");
            }

            await load();
        } catch (error) {
            console.error("[Logs] Failed to clear logs:", error);

            if (typeof window.toast === "function") {
                toast("Failed to clear logs.", "error");
            }
        }
    });

    /* ============================================================
     * Initialization
     * ============================================================ */

    // Highlight the statistics card corresponding to the initial severity filter.
    $$(".log-stat-card").forEach((card) => {
        if (card.dataset.level === state.level) {
            card.classList.add("active");
        }
    });

    loadFiles().then(load);

    if (state.autoRefresh) {
        startAuto();
    }
});

/**
 * Copyright (c) 2026 Sobhan Rasoulzadeh Asl (Sobhan-SRZA / Mr. Sinre)
 *
 * Licensed under the BSD 3-Clause License.
 * See the LICENSE file in the project root for license information.
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */