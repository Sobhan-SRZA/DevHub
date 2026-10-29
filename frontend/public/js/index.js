document.addEventListener('DOMContentLoaded', () => {
    /* --------------------------------------------------------
       ICON INJECTION
       --------------------------------------------------------
       Inject the eye / eye-off icon pair into any password
       toggle button that does not already contain icons. This
       keeps markup DRY for buttons declared without inline SVG.
       -------------------------------------------------------- */
    document.querySelectorAll('.toggle-pass').forEach((btn) => {
        // Skip buttons that already contain icons.
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
       --------------------------------------------------------
       Toggle the associated input between `password` and `text`.
       The `.active` class drives the icon switch in CSS, while
       ARIA attributes keep the control accessible.
       -------------------------------------------------------- */
    document.querySelectorAll('.toggle-pass').forEach((btn) => {
        btn.addEventListener('click', () => {
            const input = document.getElementById(btn.dataset.target);
            if (!input) return;

            const isPassword = input.type === 'password';

            // Swap the input type.
            input.type = isPassword ? 'text' : 'password';

            // Toggle the active state; CSS handles the icon swap.
            btn.classList.toggle('active', isPassword);

            // Update accessibility attributes.
            btn.setAttribute('aria-label', isPassword ? 'Hide password' : 'Show password');
            btn.setAttribute('aria-pressed', String(isPassword));

            // Replay the pop animation.
            btn.classList.remove('pop');
            // Force a reflow so the animation can restart.
            void btn.offsetWidth;
            btn.classList.add('pop');
            btn.addEventListener('animationend', () => btn.classList.remove('pop'), { once: true });

            // Optional: return focus to the input so typing can continue.
            // input.focus({ preventScroll: true });
        });

        // Enter/Space on a <button> already triggers click natively.
        // If the button sits inside a <label>, a pointer event could
        // bubble and toggle the input twice — prevent that here.
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