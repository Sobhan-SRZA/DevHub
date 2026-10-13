/* ---------------- Active nav link ---------------- */
const nav_list = document.querySelectorAll(".nav-ul li");
const address = location.pathname;
nav_list.forEach(list => {
    const link = list.querySelector("a");
    if (link.pathname === address) list.classList.add("active");
});

/* ---------------- Real auth state ---------------- */
(async function initAuth() {
    const authGuests = document.getElementById("authGuests");
    const authProfile = document.getElementById("authProfile");
    const profileBtn = document.getElementById("profileBtn");
    const profileMenu = document.getElementById("profileMenu");
    const profileName = document.getElementById("profileName");
    const profileAvatar = document.getElementById("profileAvatar");
    const logoutBtn = document.getElementById("logoutBtn");

    let currentUser = null;

    try {
        const res = await fetch('/api/auth/me', {
            credentials: 'include'
        });
        if (res.ok) {
            const data = await res.json();
            currentUser = data.user;
        }
    } catch {
        /* offline / guest */
    }

    function render() {
        if (currentUser) {
            authGuests.style.display = 'none';
            authProfile.style.display = 'flex';

            const displayName = currentUser.name || currentUser.username || 'کاربر';
            profileName.textContent = displayName;

            const avatarEl = document.getElementById('profileAvatar');
            const initialEl = document.getElementById('profileInitial');

            if (currentUser.avatar?.url) {
                // ✅ آواتار داره
                avatarEl.style.backgroundImage = `url('${currentUser.avatar.url}')`;
                avatarEl.style.backgroundSize = 'cover';
                avatarEl.style.backgroundPosition = 'center';
                initialEl.style.display = 'none';
            } else {
                // حرف اول
                avatarEl.style.backgroundImage = '';
                avatarEl.style.background = 'linear-gradient(135deg, #007bff, #6ebbff)';
                initialEl.style.display = '';
                initialEl.textContent = displayName.trim().charAt(0).toUpperCase();
            }
        }
    }

    function toggleMenu(e) {
        e.stopPropagation();
        profileMenu.classList.toggle('open');
        profileBtn.setAttribute('aria-expanded', profileMenu.classList.contains('open'));
    }

    profileBtn?.addEventListener('click', toggleMenu);
    document.addEventListener('click', (e) => {
        if (profileMenu?.classList.contains('open') &&
            !profileMenu.contains(e.target) &&
            !profileBtn.contains(e.target)) {
            profileMenu.classList.remove('open');
            profileBtn.setAttribute('aria-expanded', 'false');
        }
    });

    logoutBtn?.addEventListener('click', async () => {
        await fetch('/api/auth/logout', {
            method: 'POST',
            credentials: 'include'
        });
        currentUser = null;
        render();
        if (location.pathname !== '/') location.href = '/';
    });

    render();
})();

/**
 * Copyright (c) 2026 Sobhan Rasoulzadeh Asl (Sobhan-SRZA / Mr. Sinre)
 *
 * Licensed under the BSD 3-Clause License.
 * See the LICENSE file in the project root for license information.
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */