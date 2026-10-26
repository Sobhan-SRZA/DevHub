/* ============================================================
   CharCounter — شمارنده‌ی هوشمند متن
   ============================================================ */

(function (global) {
    'use strict';

    const STYLES = {
        ok: { color: '#4ade80' },      // سبز
        warn: { color: '#fbbf24' },      // زرد
        over: { color: '#fb923c' },      // نارنجی (soft exceeded)
        hard: { color: '#ff6b6b' },      // قرمز (hard exceeded)
    };

    /**
     * @param {HTMLTextAreaElement|HTMLInputElement} input
     * @param {Object} opts
     *   - soft: عدد نرم (توصیه‌شده)
     *   - hard: عدد سخت (blocking)
     *   - container: عنصر برای نمایش (اختیاری — خودش می‌سازه)
     *   - label: پیشوند (اختیاری)
     */
    function attach(input, opts = {}) {
        if (!input) return null;

        const soft = opts.soft || 5000;
        const hard = opts.hard || 50000;
        const label = opts.label || 'کاراکتر';

        // ساخت یا پیدا کردن container
        let counter = opts.container;
        if (!counter) {
            counter = document.createElement('div');
            counter.className = 'char-counter';
            counter.style.cssText = `
                display: flex;
                align-items: center;
                justify-content: flex-end;
                gap: 8px;
                font-size: 0.75rem;
                color: #666;
                margin-top: 6px;
                font-variant-numeric: tabular-nums;
                transition: color 0.2s ease;
            `;

            // اگه input داخل .field هست، زیرش بذار
            const field = input.closest('.field');
            if (field) field.appendChild(counter);
            else input.parentElement.appendChild(counter);
        }

        // استایل داخلی
        counter.innerHTML = `
            <span data-role="count">0</span>
            <span style="opacity:0.5">/</span>
            <span data-role="soft" style="color:#888">${formatNumber(soft)}</span>
            <span data-role="label">${label}</span>
            <span data-role="warning" style="color:#fbbf24;display:none">⚠️</span>
        `;

        const countEl = counter.querySelector('[data-role="count"]');
        const warnEl = counter.querySelector('[data-role="warning"]');

        function update() {
            const len = input.value.length;

            let level = 'ok';
            if (len > hard) level = 'hard';
            else if (len > soft) level = 'over';
            else if (len > soft * 0.8) level = 'warn';

            const style = STYLES[level];

            countEl.textContent = formatNumber(len);
            countEl.style.color = style.color;
            countEl.style.fontWeight = level !== 'ok' ? '700' : '400';

            warnEl.style.display = level === 'ok' ? 'none' : 'inline';
            warnEl.title = level === 'hard'
                ? 'متن بیش از حد مجاز است'
                : level === 'over'
                    ? 'متن از حد توصیه‌شده بیشتر شده'
                    : 'متن در حال طولانی شدن است';

            // اگه hard exceeded، border قرمز
            if (level === 'hard') {
                input.style.borderColor = '#ff6b6b';
            } else {
                input.style.borderColor = '';
            }
        }

        input.addEventListener('input', update);
        update();

        // API
        return {
            update,
            getLength: () => input.value.length,
            isOverSoft: () => input.value.length > soft,
            isOverHard: () => input.value.length > hard,
        };
    }

    function formatNumber(n) {
        return Number(n || 0).toLocaleString('fa-IR');
    }

    global.CharCounter = { attach, formatNumber };
})(window);

/**
 * Copyright (c) 2026 Sobhan Rasoulzadeh Asl (Sobhan-SRZA / Mr. Sinre)
 *
 * Licensed under the BSD 3-Clause License.
 * See the LICENSE file in the project root for license information.
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */