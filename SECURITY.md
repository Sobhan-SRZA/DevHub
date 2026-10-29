# 🔒 SECURITY.md

> **DevHub — Security Policy**
> راهنمای امنیتی پروژه، سیاست گزارش آسیب‌پذیری، و اقدامات امنیتی پیاده‌شده

---

## 📋 Supported Versions

ما فقط آخرین نسخه‌ی پایدار را پشتیبانی امنیتی می‌کنیم:

| Version         | Supported | Notes               |
| --------------- | :-------: | ------------------- |
| `main` (latest) |     ✅     | دریافت patch امنیتی |
| `v1.x`          |     ✅     | فقط critical fixes  |
| `< v1.0`        |     ❌     | استفاده نکنید       |

> **توصیه:** همیشه از آخرین commit روی `main` استفاده کنید.

---

## 🚨 Reporting a Vulnerability

### ⚠️ هرگز آسیب‌پذیری را در Issue عمومی گزارش ندهید

اگر آسیب‌پذیری امنیتی پیدا کردید، **حتماً به‌صورت خصوصی** اطلاع دهید:

### 📧 راه‌های ارتباط خصوصی

| روش                          | آدرس                                                                                       |      اولویت       |
| ---------------------------- | ------------------------------------------------------------------------------------------ | :---------------: |
| **GitHub Security Advisory** | [Report privately](https://github.com/Sobhan-SRZA/manage-projects/security/advisories/new) |    ⭐ توصیه‌شده     |
| **Email**                    | `security@example.com`                                                                     |      جایگزین      |
| **PGP** (اختیاری)            | [کلید عمومی](./.well-known/security.asc)                                                   | برای اطلاعات حساس |

### 📝 چه چیزی در گزارش بنویسیم؟

لطفاً در گزارش خود این اطلاعات را شامل شوید:

```
1. نوع آسیب‌پذیری
   (مثلاً: XSS, SQL Injection, Auth Bypass, IDOR, ...)

2. محل آسیب‌پذیری
   - Endpoint: POST /api/auth/login
   - فایل: backend/src/controllers/authController.ts (line 42)
   - نسخه: commit hash یا tag

3. مراحل بازتولید (PoC)
   - Request/Response مثال
   - یا اسکرین‌شات / ویدیو

4. تأثیر احتمالی
   - چه داده‌ای در خطر است؟
   - چه سطح دسترسی‌ای گرفته می‌شود؟

5. راه‌حل پیشنهادی (اختیاری)
   - اگر ایده‌ای برای fix دارید

6. اطلاعات تماس
   - نام یا nickname برای اعتباردهی
   - روش ارتباط امن (اختیاری)
```

### ⏱️ Timeline پاسخ‌دهی

| مرحله                   |               زمان تعهد               |
| ----------------------- | :-----------------------------------: |
| تأیید دریافت گزارش      |             **≤ 48 ساعت**             |
| ارزیابی اولیه و شدت     |           **≤ 5 روز کاری**            |
| برنامه fix و ETA        |           **≤ 10 روز کاری**           |
| انتشار patch            | بسته به شدت (critical: 7d، high: 30d) |
| انتشار عمومی (advisory) |              بعد از fix               |

---

## 🎯 Scope

### ✅ در محدوده (In Scope)

- **احراز هویت**: ثبت‌نام، ورود، refresh، logout، OTP، reset password
- **مجوزدهی**: bypass role، IDOR، privilege escalation
- **Session**: hijack، fixation، token leakage، CSRF
- **Injection**: XSS، NoSQL injection، HTML injection، Markdown injection
- **File upload**: RCE، path traversal، unrestricted file type، stored XSS via SVG
- **Data exposure**: PII leak، password/token leak، enumeration
- **Business logic**: rating manipulation، spam، quota bypass
- **Rate limiting**: brute force، OTP bombing، API abuse
- **Headers/Cookies**: missing HttpOnly، Secure، SameSite، CORS misconfig

### ❌ خارج از محدوده (Out of Scope)

- DoS/DDoS attacks
- Social engineering
- Physical attacks
- SPF/DKIM/DMARC configuration (وابسته به هاست)
- Outdated browsers (IE11، ...)
- Issues on `localhost` or personal forks
- Automated scanner output بدون PoC
- Self-XSS (بدون impact واقعی)
- Missing security headers که فقط best-practice هستن (بدون exploit)
- Best practices بدون exploit (مثل spam که اجباریه)

---

## 🛡️ Security Measures — پیاده‌شده

### 🔐 Authentication & Sessions

| مورد                   | پیاده‌سازی                        | فایل                               |
| ---------------------- | -------------------------------- | ---------------------------------- |
| **Password hashing**   | bcrypt (12 rounds، auto salt)    | `models/User.ts`                   |
| **Password policy**    | حداقل ۸ کاراکتر، حداقل حرف + عدد | `validators/authValidator.ts`      |
| **Login rate**         | OTP-based با cooldown            | `services/verificationService.ts`  |
| **OTP hash**           | SHA-256 + random salt            | `models/VerificationCode.ts`       |
| **OTP attempts**       | ۵ تلاش، بعد حذف                  | `services/verificationService.ts`  |
| **OTP cooldown**       | ۶۰ ثانیه بین درخواست‌ها           | `services/verificationService.ts`  |
| **OTP TTL**            | ۱۰ دقیقه                         | `services/verificationService.ts`  |
| **JWT**                | access 15min + refresh 30d       | `utils/token.ts`                   |
| **JWT `typ` check**    | access و refresh جدا             | `middleware/auth.ts`               |
| **Refresh rotation**   | هر refresh → access جدید         | `controllers/authController.ts`    |
| **Session revocation** | روی password change              | `controllers/profileController.ts` |
| **Session storage**    | DB با device + location          | `models/Session.ts`                |
| **Email verification** | اجباری قبل از login              | `controllers/authController.ts`    |
| **Email change**       | دو مرحله‌ای (old + new)           | `controllers/profileController.ts` |

### 🍪 Cookie Security

```typescript
const cookieOpts = {
    httpOnly: true,                                      // ✅ ضد XSS
    secure: process.env.NODE_ENV === 'production',       // ✅ فقط HTTPS
    sameSite: 'lax' as const,                            // ✅ ضد CSRF
    path: '/',
};
```

- **`httpOnly`**: JS دسترسی ندارد → JWT از XSS امن
- **`secure`**: فقط روی HTTPS در prod
- **`sameSite: lax`**: CSRF mitigation برای cross-site top-level

### 🔍 Input Validation

| لایه       | ابزار                  | محل                       |
| ---------- | ---------------------- | ------------------------- |
| **Body**   | Zod schemas            | `validators/*.ts`         |
| **Query**  | Zod + coerce           | `validators/*QuerySchema` |
| **Params** | regex + ObjectId check | controllers               |
| **File**   | MIME + size + ext      | `config/upload.ts`        |

**قواعد سختگیرانه**:
- Username: `[a-zA-Z0-9_.-]{3,20}` — بدون `@`, بدون فاصله، بدون حروف غیرانگلیسی
- Email: regex + lowercase + max 254
- Password: min 8, min 1 letter + 1 digit
- ObjectId: `/^[a-f\d]{24}$/i`
- Slug: `/^[a-z0-9-]{2,80}$/`

### 🛡️ XSS Prevention

| مورد                            | پیاده‌سازی                                                    |
| ------------------------------- | ------------------------------------------------------------ |
| **EJS `<%= %>`**                | auto-escape                                                  |
| **`escapeHtml()`**              | قبل از `innerHTML` در همه‌ی JS                                |
| **Markdown sanitize**           | whitelist تگ‌ها + strip `on*` + `javascript:`                 | `components/markdown-editor.js` |
| **Allowed tags**                | `H1-H6, P, STRONG, EM, A, IMG, CODE, PRE, TABLE, ...`        | `parseMarkdown`                 |
| **Forbidden tags**              | `script, style, iframe, object, form, meta, svg, math`       | `sanitizeHtml`                  |
| **URL check**                   | `javascript:`, `vbscript:`, `data:` (جز `data:image/`) مسدود | `sanitizeHtml`                  |
| **`rel="noopener noreferrer"`** | روی همه‌ی لینک‌های خارجی                                       | `sanitizeHtml`                  |

### 📁 File Upload Security

| مورد               | پیاده‌سازی                                                     |
| ------------------ | ------------------------------------------------------------- |
| **Storage**        | خارج از `public/`، فقط در `uploads/`                          |
| **Filename**       | random hash + ext اصلي (نه original name)                     |
| **MIME check**     | whitelist (`image/jpeg`, `video/mp4`, `application/zip`, ...) |
| **Size limits**    | image 5MB / video 200MB / file 500MB                          |
| **Count limits**   | حداکثر ۱۰ تصویر، ۱ ویدیو، ۱ فایل                              |
| **Path traversal** | `path.basename()` + `path.resolve()` + prefix check           |
| **Static serving** | `X-Content-Type-Options: nosniff`                             |
| **Download**       | `Content-Disposition: attachment`                             |

**پیشنهاد برای آینده** (فعلاً پیاده نشده):
- [ ] بررسی magic bytes (`file-type` package)
- [ ] آنتی‌ویروس scan (ClamAV)
- [ ] تصویر resize/compress (sharp) برای حذف metadata و payload

### 🚦 Rate Limiting

| Endpoint                | Limit                            | محل                               |
| ----------------------- | -------------------------------- | --------------------------------- |
| **ارسال OTP**           | ۵ ایمیل / دقیقه (per recipient)  | `services/mail/rateLimiter.ts`    |
| **Create verification** | ۱ در ۶۰ ثانیه (per user+purpose) | `services/verificationService.ts` |
| **OTP verification**    | ۵ تلاش                           | `services/verificationService.ts` |

**پیشنهاد برای آینده**:
- [ ] Rate limit روی `/api/auth/login` (per IP + per user)
- [ ] Rate limit روی `/api/auth/register` (per IP)
- [ ] Rate limit روی `/api/projects` (per user)
- [ ] CAPTCHA روی register (اگه spam شد)

### 🔒 Authorization

| لایه               | فایل                                                                     |
| ------------------ | ------------------------------------------------------------------------ |
| **Authentication** | `middleware/auth.ts` (requireAuth, optionalAuth)                         |
| **Page auth**      | `middleware/pageAuth.ts` (redirect به login)                             |
| **Role check**     | `middleware/roles.ts` (requireAdmin, requireDeveloper)                   |
| **Ownership**      | `middleware/ownership.ts` (requireProjectOwnership, requireTagOwnership) |

**قواعد**:
- کاربر فقط پروژه‌های خودش رو ویرایش/حذف می‌کنه
- کاربر عادی نمی‌تونه کتگوری بسازه (فقط درخواست)
- ادمین نمی‌تونه developer رو بن یا تنزیل کنه
- هیچ‌کس نمی‌تونه نقش خودش رو تغییر بده

### 🗄️ Database Security

| مورد                | پیاده‌سازی                                                        |
| ------------------- | ---------------------------------------------------------------- |
| **NoSQL injection** | Mongoose schema + Zod cast → بدون `$where` یا operator injection |
| **Unique indexes**  | email، usernameLower، slug، sessionId                            |
| **TTL indexes**     | Session (`expiresAt`)، VerificationCode (`expiresAt`)            |
| **Select: false**   | `password`، `refreshToken`                                       |
| **Connection**      | `MONGODB_URI` در env، نه در کد                                   |

**قواعد نوشتن**:
- هرگز رشته‌ی خام کاربر رو در query مونگو نذار
- برای فیلترهای دینامیک همیشه allowlist
- `$regex` فقط با `safe = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')`

### 📧 Email Security

| مورد                 | پیاده‌سازی                                                  |
| -------------------- | ---------------------------------------------------------- |
| **TLS**              | `minVersion: 'TLSv1.2'`، `rejectUnauthorized: true` (prod) |
| **Timeout**          | connection/greeting/socket                                 |
| **Anti-abuse**       | rate limit per recipient                                   |
| **Anti-enumeration** | پیام یکسان: «اگر ایمیل موجود باشد، کد ارسال می‌شود»         |
| **Log mode**         | `MAIL_MODE=log` برای dev (فقط کنسول)                       |
| **HTML escape**      | در `otpTemplate.ts`                                        |

### 🚫 Anti-Enumeration

| مورد                        | پاسخ                                                                                       |
| --------------------------- | ------------------------------------------------------------------------------------------ |
| **Login (user exists?)**    | پیام یکسان: «ایمیل/نام کاربری یا رمز اشتباه است»                                           |
| **Register (user exists?)** | کد اختصاصی (`USERNAME_TAKEN` / `EMAIL_TAKEN`) — فقط برای UX بهتر، چون register عامدانه است |
| **Forgot password**         | پیام یکسان: «اگر ایمیل موجود باشد...» + توکن fake برای ایمیل ناموجود                       |
| **Change email**            | چک تکراری در مرحله verify                                                                  |

### 📝 Logging & Monitoring

| مورد                | پیاده‌سازی                                       |
| ------------------- | ----------------------------------------------- |
| **App logs**        | فایل روزانه در `logs/app-YYYY-MM-DD.log`        |
| **Sensitive data**  | ❌ password، token، OTP، full JWT هرگز لاگ نمی‌شن |
| **OTP in log mode** | در `MAIL_MODE=log` فقط، برای dev                |
| **Error logging**   | `[UNHANDLED ERROR]` با stack (فقط dev)          |
| **Production**      | فقط message عمومی، نه stack                     |

**❌ چه چیزهایی هرگز لاگ نمی‌شن:**
- `password` (هرگز)
- `token` / `refreshToken` (هرگز)
- `Authorization` header
- `cookie` value
- کد OTP در حالت `smtp` (فقط hash)

### 🌐 HTTP Security Headers

**پیشنهاد (هنوز کامل نیست):**

```typescript
// TODO: add helmet
import helmet from 'helmet';
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],  // برای inline styles
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'"],
            fontSrc: ["'self'"],
            objectSrc: ["'none'"],
            frameAncestors: ["'none'"],
        },
    },
    crossOriginEmbedderPolicy: false,  // برای compatibility
    hsts: { maxAge: 31536000, includeSubDomains: true },
    noSniff: true,
    frameguard: { action: 'deny' },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
}));
```

**وضعیت فعلی:**

| Header                            |         وضعیت          |
| --------------------------------- | :--------------------: |
| `X-Content-Type-Options: nosniff` | ✅ (فقط روی `/uploads`) |
| `Content-Security-Policy`         |         ❌ TODO         |
| `Strict-Transport-Security`       | ❌ TODO (بعد از HTTPS)  |
| `X-Frame-Options: DENY`           |         ❌ TODO         |
| `Referrer-Policy`                 |         ❌ TODO         |
| `Permissions-Policy`              |         ❌ TODO         |

---

## ⚠️ Known Limitations

### در وضعیت فعلی، این موارد پیاده **نشده‌اند**:

| مورد                          |         ریسک          | برنامه             |
| ----------------------------- | :-------------------: | ------------------ |
| **Rate limit روی login**      |     🟡 brute force     | v1.1               |
| **CAPTCHA روی register**      |      🟡 spam bots      | v1.1 (اگه لازم شد) |
| **2FA (TOTP)**                |  🟡 account takeover   | v2.0               |
| **Magic bytes check**         |      🟡 fake MIME      | v1.2               |
| **Antivirus scan**            |   🟡 malware upload    | نیاز به ClamAV     |
| **CSP header**                |      🟡 XSS depth      | v1.1               |
| **HSTS**                      |      🟡 downgrade      | بعد از HTTPS setup |
| **Audit log (DB)**            |      🟢 forensics      | v1.2               |
| **IP whitelist (admin)**      |     🟢 admin panel     | v1.2               |
| **Email change notification** | 🟢 alert به ایمیل قبلی | v1.1               |

### 🔴 موارد زیر **خارج از کنترل پروژه** هستند:

- امنیت هاست (پروژه خودش سرور نیست)
- امنیت HTTPS certificates (بسته به هاست)
- امنیت MongoDB (بسته به config)
- امنیت SMTP provider
- امنیت CDN (اگه استفاده شه)

---

## 🔐 Cryptographic Details

### Algorithms Used

| کاربرد               | الگوریتم                     | پارامترها                      |
| -------------------- | ---------------------------- | ------------------------------ |
| Password hash        | **bcrypt**                   | rounds=12                      |
| OTP hash             | **SHA-256**                  | + 16-byte random salt          |
| JWT signing          | **HS256**                    | با `JWT_SECRET` (min 32 chars) |
| Session ID           | **crypto.randomBytes(16)**   | hex (32 char)                  |
| File name            | **crypto.randomBytes(12)**   | hex + timestamp                |
| Device fingerprint   | **SHA-256**                  | userAgent + client fingerprint |
| Password reset token | **JWT** (typ=password_reset) | expiry=15min                   |
| Email verify token   | **JWT** (typ=email_verify)   | expiry=1h                      |

### Secret Management

**قواعد:**
- ✅ همه‌ی secrets در `.env` (نه در کد)
- ✅ `.env` در `.gitignore`
- ✅ `.env.example` فقط با placeholder
- ❌ هرگز commit نکن
- ❌ هرگز log نکن
- ❌ هرگز در error message نذار

**الزامات `JWT_SECRET`:**
- حداقل ۳۲ کاراکتر
- random (مثلاً `openssl rand -hex 32`)
- **هرگز** تغییر نکن (باعث logout همه)
- در prod از secret manager استفاده کن (AWS Secrets، Vault، ...)

---

## 🧪 Security Testing

### چک‌لیست تست دستی

#### Authentication
- [ ] Login با password اشتباه ۶ بار → OTP / lockout؟
- [ ] Register با ایمیل تکراری → پیام درست؟
- [ ] Access protected route بدون token → 401 / redirect؟
- [ ] Access admin route با role=user → 403؟
- [ ] Refresh token منقضی → ریدایرکت به login؟
- [ ] Logout → token بعدی invalid؟

#### Authorization
- [ ] Edit project دیگران (user B modifies user A's project) → 403؟
- [ ] Delete tag دیگران → 403؟
- [ ] Approve tag type به‌عنوان user → 403؟
- [ ] Ban خودت → rejected؟
- [ ] Change role خودت → rejected؟

#### XSS
- [ ] `<script>alert(1)</script>` در bio → escape / strip؟
- [ ] `<img src=x onerror=alert(1)>` در comment → escape؟
- [ ] `[click](javascript:alert(1))` در markdown → strip؟
- [ ] SVG upload با `<script>` → rejected؟
- [ ] Username با `<script>` → rejected توسط regex؟

#### File Upload
- [ ] Upload `.php` به‌عنوان image → rejected؟
- [ ] Upload ۱۰۰MB video → rejected؟
- [ ] Upload با filename `../../etc/passwd` → safe name؟
- [ ] Upload fake `.jpg` که در واقع `.exe` هست → only MIME check (TODO: magic bytes)

#### Session
- [ ] Session hijack (token از device دیگر) → maybe works (IP/UA check TODO)
- [ ] Session fixation (force user to use known session) → not applicable (server-issued)
- [ ] Concurrent sessions از ۲ device → works (features)؟
- [ ] Password change → همه‌ی sessionها بسته می‌شن؟ ✅

#### Rate Limiting
- [ ] ۶ بار ارسال OTP در ۵ دقیقه → cooldown فعال؟
- [ ] ۱۰ بار تلاش OTP اشتباه → کد حذف می‌شه؟

### 🛠️ ابزارهای پیشنهادی

| ابزار                    | کاربرد               |
| ------------------------ | -------------------- |
| **OWASP ZAP**            | DAST scan            |
| **Burp Suite Community** | Manual testing       |
| **npm audit**            | Dependency vulns     |
| **Snyk**                 | CI/CD scanning       |
| **Semgrep**              | SAST (code patterns) |
| **Trivy**                | Container scan       |

```bash
# اجرا
npm audit
npm audit fix --force    # با احتیاط

# Semgrep
semgrep --config=auto backend/src/
```

---

## 📜 Disclosure Policy

### Timeline پیش‌فرض

1. **Report received** → تأیید ≤ 48h
2. **Triage** → severity + scope ≤ 5 روز
3. **Fix development** → بسته به severity
   - Critical: ≤ 7 روز
   - High: ≤ 30 روز
   - Medium: ≤ 90 روز
   - Low: next release
4. **Patch release** → نسخه‌ی جدید + advisory
5. **Public disclosure** → بعد از 90 روز یا انتشار patch (هرکدام زودتر)

### اگر reporter بخواد public کنه قبل از fix:

از شما درخواست می‌کنیم **حداقل ۹۰ روز** صبر کنید. اگر patch در این مدت منتشر نشد، آزادید منتشر کنید — با ذکر نام maintainer.

### Credit

اگر مایل باشید، در `SECURITY.md` و release notes به‌عنوان **Security Researcher** نام شما ذکر می‌شود.

---

## 🏆 Security Hall of Fame

با تشکر از افرادی که به امنیت DevHub کمک کرده‌اند:

<!-- 
Format:
- [@username](https://github.com/username) — نوع آسیب‌پذیری — تاریخ
-->

_هنوز کسی ثبت نشده. اولین نفر باشید!_

---

## 🔄 Changelog امنیتی

| تاریخ | نسخه | مورد                 |
| ----- | ---- | -------------------- |
| —     | —    | (پروژه در حال توسعه) |

---

## 📚 منابع و استانداردها

### پیروی از:

- **OWASP Top 10** (2021) — mitigation‌ها پیاده‌شده
- **OWASP ASVS** — بخش‌های احراز هویت
- **CWE Top 25** — آگاهی از الگوهای خطرناک
- **RFC 7519** — JWT
- **RFC 6749** — OAuth2 (الهام‌گرفته، بدون پیاده‌سازی کامل)
- **BSD-3-Clause** — License

### References:

- [OWASP Authentication Cheatsheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [OWASP Session Management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)
- [OWASP File Upload](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html)
- [JWT Best Practices RFC 8725](https://datatracker.ietf.org/doc/html/rfc8725)

---

## 📞 Contact

| نقش                | آدرس                                                     |
| ------------------ | -------------------------------------------------------- |
| **Maintainer**     | [@Sobhan-SRZA](https://github.com/Sobhan-SRZA)           |
| **Security Email** | `security@example.com`                                   |
| **PGP Key**        | [`.well-known/security.asc`](./.well-known/security.asc) |

---

<div align="center">

**🙏 از اینکه به امنیت DevHub کمک می‌کنید متشکریم**

_Last updated: ۲۰۲۶_

</div>

---

## 📎 فایل‌های مرتبط

- [`CONTRIBUTING.md`](./CONTRIBUTING.md) — راهنمای مشارکت
- [`CODE_OF_CONDUCT.md`](./CODE_OF_CONDUCT.md) — قوانین رفتار
- [`LICENSE`](./LICENSE) — BSD-3-Clause
- [`README.md`](./README.md) — معرفی پروژه
- [`docs/PROJECT_GUIDE.md`](./docs/PROJECT_GUIDE.md) — راهنمای کامل
- [`docs/GOALS.md`](./docs/GOALS.md) — اهداف پروژه