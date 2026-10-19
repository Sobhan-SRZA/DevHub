document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.toggle-pass').forEach((btn) => {
        // فقط اگه آیکون نداره
        if (btn.querySelector('.icon')) return;

        btn.insertAdjacentHTML('afterbegin', `
        <svg class="icon icon-eye" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
            <circle cx="12" cy="12" r="3"></circle>
        </svg>
        <svg class="icon icon-eye-off" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
            <line x1="1" y1="1" x2="23" y2="23"></line>
        </svg>
    `);
    });

    /* --------------------------------------------------------
       PASSWORD VISIBILITY TOGGLE
       -------------------------------------------------------- */
    document.querySelectorAll('.toggle-pass').forEach((btn) => {
        btn.addEventListener('click', () => {
            const input = document.getElementById(btn.dataset.target);
            if (!input) return;

            const isPassword = input.type === 'password';

            // سوییچ نوع input
            input.type = isPassword ? 'text' : 'password';

            // سوییچ کلاس active (CSS خودش آیکون رو عوض می‌کنه)
            btn.classList.toggle('active', isPassword);

            // accessibility
            btn.setAttribute('aria-label', isPassword ? 'پنهان کردن رمز' : 'نمایش رمز');
            btn.setAttribute('aria-pressed', String(isPassword));

            // انیمیشن pop
            btn.classList.remove('pop');
            // force reflow تا انیمیشن دوباره اجرا بشه
            void btn.offsetWidth;
            btn.classList.add('pop');
            btn.addEventListener('animationend', () => btn.classList.remove('pop'), { once: true });

            // فوکوس روی input تا کاربر بتونه ادامه تایپ کنه
            // (اختیاری — اگه نمی‌خوای، کامنت کن)
            // input.focus({ preventScroll: true });
        });

        // دسترس‌پذیری: Enter/Space خودکار کار می‌کنه چون button هست
        // ولی اگه input داخل label بود ممکنه دوبار toggle بشه
        // پس رویداد pointer رو stopPropagation می‌کنیم
        btn.addEventListener('pointerdown', (e) => e.preventDefault());
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