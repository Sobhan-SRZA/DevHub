async function init() {
    state = loadState();

    if (!state) {
        // اگه state تو sessionStorage نیست، از سرور تلاش کن
        try {
            const res = await fetch('/api/auth/me', { credentials: 'include' });
            if (res.ok) {
                const data = await res.json();

                if (data?.user && !data.user.emailVerified) {
                    // کاربر لاگینه ولی ایمیل تایید نشده — کد جدید بگیر
                    const rr = await fetch('/api/auth/resend-verification-for-me', {
                        method: 'POST',
                        credentials: 'include',
                    });

                    if (rr.ok) {
                        const rd = await rr.json();
                        state = { verifyToken: rd.verifyToken, email: rd.email };
                        saveState(state);
                    }
                } else if (data?.user?.emailVerified) {
                    // ایمیل تایید شده — برو داشبورد
                    location.href = '/dashboard';
                    return;
                }
            }
        } catch { }
    }

    if (!state) {
        // هیچ راهی نیست — کاربر باید لاگین کنه
        showDialogAndRedirect(
            'نیاز به ورود',
            'برای ادامه، لطفاً وارد حساب خود شوید',
            '/auth/login'
        );
        return;
    }

    $('#emailDisplay').textContent = state.email;
    startResendCooldown(60);
    setTimeout(() => $('#otpCode').focus(), 200);
}