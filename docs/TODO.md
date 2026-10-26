# 📋 TODO — نسخه‌ی فعلی (v1.0)

> **هدف:** تکمیل نسخه‌ی قابل انتشار اول (v1.0) قبل از رفتن به v1.1

---

## 🔴 اولویت بحرانی (Blockers — قبل از release)

### امنیت
- [ ] **Rate limiting روی `/api/auth/*`**
  - `POST /login` — 5 تلاش / ۱۵ دقیقه per IP
  - `POST /register` — 3 ثبت‌نام / ۲۴ ساعت per IP
  - `POST /forgot-password` — 3 بار / ساعت per email
  - `POST /refresh` — 10 بار / دقیقه per session
  - کتابخانه: `express-rate-limit` + store (memory/Redis)

- [ ] **Security headers با helmet**
  ```bash
  npm install helmet
  ```
  - `Content-Security-Policy` (whitelist منابع)
  - `Strict-Transport-Security` (فقط prod)
  - `X-Frame-Options: DENY`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy` (camera، mic، geo off)
  - `X-Content-Type-Options: nosniff` (همه‌جا، نه فقط uploads)

- [ ] **CORS configuration دقیق**
  - allowlist origin در prod
  - `credentials: true` فقط برای origin معتبر

- [ ] **Password change → revoke همه sessionها** (بررسی که پیاده شده) ✅ اگه هست، تست کن
- [ ] **Add `express.json({ limit: '2mb' })`** — جلوگیری از DoS
- [ ] **محدودیت body size** روی همه‌ی endpoints

### داده و امنیت فایل
- [ ] **Magic bytes check** برای uploadها
  ```bash
  npm install file-type
  ```
  - بعد از multer، MIME واقعی رو با magic bytes چک کن
  - جلوگیری از upload فایل جعلی (مثلاً `.exe` با MIME `image/jpeg`)

- [ ] **حذف فایل‌های ناقص روی خطا**
  - اگه `User.save()` بعد از `uploadAvatar` خطا داد → فایل باید پاک شه
  - مشابه در `projectController` برای images/video/file

- [ ] **Unique index روی `VerificationCode`** برای `{ user, purpose, consumedAt }` (اگه نیست)

### لاگ و مانیتورینگ
- [ ] **`process.on('unhandledRejection')`** و **`uncaughtException`** با لاگ کامل
- [ ] **`res.headersSent` check** در errorHandler (جلوگیری از کرش)
- [ ] **`graceful shutdown`** روی `SIGTERM`:
  - بستن MongoDB connection
  - بستن SMTP
  - flush لاگ‌ها

### Environment
- [ ] **`.env.example` کامل** با همه‌ی متغیرها + کامنت
- [ ] **Validation env در startup** — اگه `JWT_SECRET` یا `MONGODB_URI` نبود → exit
- [ ] **`.gitignore`** شامل: `.env`, `logs/`, `uploads/`, `node_modules/`, `dist/`

### داده اولیه
- [ ] **Seed کتگوری‌ها** — مطمئن شو `seedDefaultData.ts` کامل اجرا می‌شه
- [ ] **`setupFirstAdmin.ts`** — تست شده؟
- [ ] **`.gitkeep`** در `uploads/` برای اینکه folder توی git بمونه

---

## 🟡 اولویت بالا (قبل از release، ولی نه blocker)

### UX و Frontend
- [ ] **Header responsive نهایی** — تست روی:
  - iPhone SE (375px)
  - iPhone 14 (390px)
  - iPad (768px)
  - Laptop (1024px)
  - Desktop (1440px+)

- [ ] **Breadcrumb dropdown** — تست بسته شدن با:
  - کلیک بیرون ✅
  - `Escape` ✅
  - کلیک روی لینک ✅
  - resize ✅

- [ ] **404 page** — بررسی که طراحی داره و لینک «بازگشت به خانه» داره
- [ ] **Loading states** — بررسی همه‌ی صفحات که «در حال بارگذاری» یا spinner دارن
- [ ] **Empty states** — بررسی همه‌ی لیست‌ها (پروژه، کاربر، تگ، ...) که پیام مناسب دارن

### احراز هویت
- [ ] **Verify email page** — بررسی که صفحه‌ی `/auth/verify-email` وجود داره یا inline redirect
- [ ] **Resend OTP** — بررسی که روی صفحه‌ی verify قابل دسترسیه
- [ ] **Error messages** — بررسی که همه‌ی کدهای `errorCodes.ts` پیام فارسی دارن

### پروژه
- [ ] **Edit project modal** — تست کامل ویرایش با media
- [ ] **Sync GitHub** — تست با repo واقعی
- [ ] **Download counting** — بررسی که شمارنده درسته
- [ ] **Image reorder** — drag & drop کار می‌کنه؟

### ریویو و کامنت
- [ ] **یک ریویو per user per project** — تست که نمی‌شه دو تا ثبت کرد
- [ ] **Soft delete comments** — تست که با حذف parent، replies حفظ می‌شن
- [ ] **Deep reply depth** — بررسی که max 5 سطح رعایت می‌شه

### تگ‌ها
- [ ] **TagPicker component** — تست find-or-create
- [ ] **Category fallback** — تگ بدون کتگوری → «عمومی»
- [ ] **Admin approval** — درخواست کتگوری → تایید ادمین

### اکسپلور
- [ ] **Hot Score algorithm** — بررسی که با data واقعی درست کار می‌کنه
- [ ] **Cache invalidation** — بعد از ساخت/حذف پروژه، cache پاک می‌شه؟
- [ ] **Filter + sort ترکیبی** — تست همه‌ی حالت‌ها

### پروفایل
- [ ] **Public profile** — تست `/users/:username`
- [ ] **Stats نمایش** — تعداد پروژه، ریویو، دانلود، امتیاز
- [ ] **Owner actions** — دکمه‌های ویرایش برای خود کاربر

### داشبورد
- [ ] **همه‌ی ۹ صفحه** کار می‌کنن:
  - [x] home ✅
  - [x] projects ✅
  - [x] profile ✅
  - [x] settings ✅
  - [x] tags (admin) ✅
  - [x] tag-types (admin) ✅
  - [x] users (admin) ✅
  - [x] system (developer) ✅
  - [x] logs (developer) ✅

- [ ] **Sidebar collapse** — Ctrl+B کار می‌کنه و persist می‌شه ✅
- [ ] **Role guards** — بررسی که user عادی نمی‌تونه به `/dashboard/users` بره

---

## 🟢 اولویت متوسط (release رو بلاک نمی‌کنه، ولی خوبه)

### Testing
- [ ] **Unit tests** برای utils:
  - `parseGitHubUrl`
  - `escapeHtml`
  - `parseMarkdown`
  - `slugify`
- [ ] **Integration tests** برای auth flow:
  - register → verify → login → logout
  - password reset flow
  - email change flow
- [ ] **E2E با Playwright** (اختیاری)

کتابخانه‌های پیشنهادی:
```bash
npm install -D jest @types/jest ts-jest supertest @types/supertest
```

### DevOps
- [ ] **Dockerfile** برای build
- [ ] **`docker-compose.yml`** کامل (app + mongo + nginx)
- [ ] **GitHub Actions CI**:
  - lint
  - typecheck (`tsc --noEmit`)
  - test
  - build
- [ ] **Health check endpoint** — `/api/health` ✅ (هست، ولی تست کن)

### مستندات
- [ ] **`README.md`** نهایی — با screenshot
- [ ] **`CONTRIBUTING.md`**
- [ ] **`CODE_OF_CONDUCT.md`**
- [ ] **`CHANGELOG.md`** — نسخه‌ی 1.0.0
- [ ] **`docs/AI_GUIDE.md`** ✅ (انجام شده)
- [ ] **`docs/goal.md`** ✅ (انجام شده)
- [ ] **`SECURITY.md`** ✅ (انجام شده)

### Email
- [ ] **Email verification واقعی** — تست با Gmail SMTP
- [ ] **قالب ایمیل** — بررسی که HTML درست در Gmail/Outlook نمایش داده می‌شه
- [ ] **`MAIL_MODE` در `.env.example`** — log vs smtp توضیح داده

### GitHub Integration
- [ ] **`GITHUB_TOKEN` support** — برای rate limit بالاتر
- [ ] **Error handling** — اگه repo پیدا نشد یا private بود، پیام مناسب
- [ ] **Retry logic** — برای خطای شبکه
- [ ] **Cache GitHub response** — جلوگیری از hit مکرر

---

## 🔵 Nice-to-have (اگه وقت بود)

### Performance
- [ ] **Indexes review** — بررسی که همه‌ی queryهای پرکاربرد index دارن:
  - `Project.owner + Project.status`
  - `Project.tags + Project.status`
  - `Review.project + Review.user`
  - `Comment.project + Comment.parent`
  - `Session.sessionId`

- [ ] **MongoDB connection pool** — tuning
- [ ] **Compression middleware** — `compression` package
- [ ] **Static assets caching** — `maxAge` روی `/public`
- [ ] **Image optimization** — `sharp` برای resize + WebP

### UX
- [ ] **Toast notifications** — بررسی همه‌ی actionها
- [ ] **Skeleton loading** — به‌جای spinner ساده
- [ ] **Keyboard shortcuts** — `Ctrl+K` (search)، `Ctrl+B` (collapse) ✅
- [ ] **Dark/light theme toggle** — (اختیاری)
- [ ] **Focus management** — کیبورد navigation
- [ ] **ARIA labels** — بررسی همه‌ی دکمه‌ها و فرم‌ها

### Features
- [ ] **Markdown editor** — پشتیبانی HTML ✅ (تست کن)
- [ ] **Image paste** — آپلود مستقیم در markdown editor (اختیاری)
- [ ] **Draft autosave** — ذخیره‌ی خودکار پروژه‌ی نیمه‌کاره
- [ ] **Preview before publish** — مشاهده‌ی پروژه قبل از انتشار

---

## 🚫 خارج از scope نسخه‌ی فعلی (v1.1+)

این‌ها رو **آگاهانه** به v1.1 یا بعد موکول می‌کنیم:

| Feature                    | نسخه  |
| -------------------------- | :---: |
| Notification system        | v1.1  |
| Follow/Unfollow            | v1.1  |
| Activity feed              | v1.1  |
| Live comments (SSE)        | v1.2  |
| Advanced search (Elastic)  | v1.2  |
| 2FA (TOTP)                 | v2.0  |
| Public REST API versioning | v2.0  |
| GraphQL                    | v2.0  |
| Mobile app                 | v2.0  |
| Webhooks                   | v2.0  |
| Redis session store        | v1.2  |
| Multi-language (i18n)      | v2.0  |
| OAuth (Google/GitHub)      | v2.0  |

---

## 📅 پیشنهاد ترتیب کار (۲-۳ هفته)

### هفته ۱ — امنیت + زیرساخت
```
روز ۱-۲: Rate limiting + helmet + CORS
روز ۳-۴: Magic bytes + file cleanup + unique indexes
روز ۵:   Graceful shutdown + env validation
روز ۶-۷: تست auth flow + رفع باگ
```

### هفته ۲ — UX + Feature completion
```
روز ۱-۲: تست و رفع باگ همه‌ی صفحات داشبورد
روز ۳-۴: تست header/breadcrumb/drawer روی همه‌ی breakpointها
روز ۵:   تست پروژه (CRUD + media + GitHub sync)
روز ۶-۷: تست ریویو + کامنت + تگ
```

### هفته ۳ — Release prep
```
روز ۱:   Dockerfile + docker-compose کامل
روز ۲:   GitHub Actions (CI)
روز ۳:   README نهایی + screenshots + CHANGELOG
روز ۴:   تست نهایی + smoke test
روز ۵:   Tag v1.0.0 + Release notes
```

---

## ✅ چک‌لیست Release v1.0

قبل از `git tag v1.0.0`:

- [ ] همه‌ی blockerها رفع شده
- [ ] `npm audit` بدون high/critical
- [ ] `npx tsc --noEmit` بدون خطا
- [ ] تست دستی همه‌ی flowها
- [ ] README کامل با screenshots
- [ ] CHANGELOG نوشته شده
- [ ] License فایل هست
- [ ] `.env.example` کامل
- [ ] Docker build موفق
- [ ] `seedDefaultData` روی دیتابیس خالی کار می‌کنه
- [ ] Demo روی staging اجرا می‌شه
- [ ] Backup strategy مستند شده
- [ ] Rollback plan مشخص

---

## 📊 آمار فعلی

| مورد             | تعداد   | وضعیت |
| ---------------- | ------- | :---: |
| Blocker          | ~۱۵     |   🔴   |
| High             | ~۲۰     |   🟡   |
| Medium           | ~۱۵     |   🟢   |
| Nice-to-have     | ~۱۲     |   🔵   |
| **کل TODO v1.0** | **~۶۰** |   —   |

---

## 🎯 معیار «آماده برای v1.0»

پروژه رو می‌شه v1.0 نامید اگه:

- ✅ **هیچ bug شناخته‌شده‌ای** در flowهای اصلی نباشه
- ✅ **`npm audit`** صفر vulnerability critical/high داشته باشه
- ✅ **Rate limiting** روی auth فعال باشه
- ✅ **Security headers** ست شده باشن
- ✅ **README** با راهنمای نصب و اسکرین‌شات کامل باشه
- ✅ **Docker** با یک command بالا بیاد
- ✅ **حداقل یه محیط staging** تست شده باشه



---


# 📄 صفحات پروژه — وضعیت + ایده‌های بهبود

> بررسی همه‌ی صفحات موجود، ناقص، و پیشنهادی — همراه با ایده‌های بهتر شدن

---

## 🟢 ۱. صفحات موجود (کامل یا تقریباً کامل)

این‌ها هستن، ولی هر کدوم جای بهبود دارن:

### ۱.۱ — `/` — صفحه اصلی (`index.ejs`)

**وضعیت فعلی:**
- Hero + stats + trending + featured + new + top-rated + top-downloaded
- داده از `/api/projects/home-feed` (cache 5min)

**ایده‌های بهبود:**

| اولویت | ایده |
|:------:|------|
| 🔴 | **Hero داینامیک** — اگه پروژه‌ی ویژه‌ای هست، اول نمایش داده بشه (featured hero) |
| 🔴 | **«داغ‌های امروز» به‌جای ۷ روز** — کاربر جدید محتوای تازه ببینه |
| 🟡 | **بخش «کاربران فعال»** — ۵ کاربر با بیشترین پروژه در ماه اخیر |
| 🟡 | **بخش «تگ‌های داغ»** — تگ‌هایی که اخیراً زیاد استفاده شدن |
| 🟡 | **شمارنده زنده** — «X پروژه در ۲۴ ساعت گذشته اضافه شد» |
| 🟢 | **CTA پایین صفحه** — «پروژه‌ی خودت رو ثبت کن» |
| 🟢 | **Background animation** — ذرات گرادیانت ملایم (perf-aware) |
| 🟢 | **Personalized** — اگه لاگین، پروژه‌های مشابه با علاقه‌ش نشون بده |

---

### ۱.۲ — `/explore` — اکسپلور (`explore.ejs`)

**وضعیت فعلی:**
- Search + sort tabs (trending/hot/top-rated/top-downloaded/new)
- Chipهای کتگوری
- Pagination
- Hot Score algorithm

**ایده‌های بهبود:**

| اولویت | ایده |
|:------:|------|
| 🔴 | **فیلترهای پیشرفته** — زبان، مجوز، سال ساخت، بازه‌ی امتیاز |
| 🔴 | **View toggle** — grid (کارت) / list (ردیف compact) / table (فشرده) |
| 🟡 | **Save filter** — «فیلترهای من» در localStorage |
| 🟡 | **URL sync کامل** — همه‌ی فیلترها در query string (`?sort=hot&tag=react&lang=typescript`) |
| 🟡 | **Empty state هوشمند** — «فیلترهای X رو برداشتی، Y پروژه پیدا می‌شه» |
| 🟡 | **Chip کتگوری multi-select** — انتخاب چند کتگوری همزمان |
| 🟢 | **Infinite scroll** به‌جای pagination (اختیاری، toggle) |
| 🟢 | **Kbd navigation** — `j/k` برای بالا/پایین، `Enter` برای باز کردن |
| 🟢 | **Highlight search term** در عنوان/توضیحات |

---

### ۱.۳ — `/projects` — لیست پروژه‌ها (`projects/list.ejs`)

**وضعیت فعلی:**
- Grid ساده + search + sort
- Pagination

**ایده‌های بهبود:**

| اولویت | ایده |
|:------:|------|
| 🔴 | **تفاوت با `/explore`** — این صفحه ساده‌تره، ولی «لیست کامل با فیلتر» می‌تونه با `/explore` merge بشه یا تفکیک بمونه |
| 🟡 | **Breadcrumb + title واضح** — «همه پروژه‌ها» |
| 🟡 | **Filter sidebar** — مشابه اکسپلور |
| 🟢 | **Card density toggle** |

> 💡 **پیشنهاد:** شاید `/projects` رو با `/explore` **merge** کنیم و فقط `/explore` داشته باشیم. کاربر رو گیج نکنیم.

---

### ۱.۴ — `/projects/:idOrSlug` — صفحه پروژه (`projects/show.ejs`)

**وضعیت فعلی:**
- Header + breadcrumb + owner + tags + stats
- Gallery + video + download + description (Markdown)
- Reviews + comments (nested)
- Lightbox + share modal

**ایده‌های بهبود:**

| اولویت | ایده |
|:------:|------|
| 🔴 | **ToC (Table of Contents)** — برای `fullDescription` طولانی، سایدبار با headingهای H2/H3 |
| 🔴 | **Scroll progress bar** — بالای صفحه |
| 🔴 | **«درباره سازنده»** — کارت owner با لینک پروفایل + پروژه‌های دیگه‌ش |
| 🟡 | **Similar projects** — در سایدبار (بر اساس تگ مشترک) |
| 🟡 | **Version history** — آپلود نسخه‌های جدید ZIP + changelog |
| 🟡 | **Copy code button** — روی code blockهای markdown |
| 🟡 | **Anchor links** — `#review-123` یا `#comment-456` |
| 🟡 | **Reviews sort/filter** — «جدیدترین», «بیشترین امتیاز», «فقط ۵ ستاره» |
| 🟡 | **Sticky action bar** — موقع scroll، دکمه‌ی دانلود همیشه بالا |
| 🟢 | **Reading time** — «زمان مطالعه: ۳ دقیقه» |
| 🟢 | **Print-friendly** — CSS `@media print` |
| 🟢 | **Report content** — گزارش محتوای نامناسب |

---

### ۱.۵ — `/users/:idOrUsername` — پروفایل عمومی (`users/show.ejs`)

**وضعیت فعلی:**
- Hero + bio (Markdown) + stats (projects, reviews, downloads, rating)
- Tab: پروژه‌ها + ریویوهای دریافتی
- Owner actions (edit/settings)

**ایده‌های بهبود:**

| اولویت | ایده |
|:------:|------|
| 🔴 | **Follow/Unfollow button** — (نیاز به feature جدید) |
| 🔴 | **Social links** — GitHub، Twitter، LinkedIn، سایت شخصی |
| 🟡 | **Activity feed** — آخرین فعالیت‌ها (پروژه جدید، ریویو، کامنت) |
| 🟡 | **Badges** — «۱۰۰ ریویو»، «۱۰ پروژه»، «عضو ۱ ساله» |
| 🟡 | **گرید پروژه‌ها با فیلتر** — sort + status |
| 🟡 | **Skeleton loading** — جای blank state |
| 🟢 | **Avatar upload for self** — لینک به settings |
| 🟢 | **Share profile** — کپی لینک پروفایل |
| 🟢 | **Tab: کامنت‌ها** — نظراتی که کاربر داده |

---

## 🟡 ۲. صفحات ناقص (وجود دارن ولی ناکامل)

### ۲.۱ — `/auth/verify-email` — تایید ایمیل

**وضعیت فعلی:**
- فایل `verify-email.js` هست ولی **`verify-email.ejs` توی tree نیست**
- احتمالاً inline render می‌شه یا از همون login.ejs استفاده می‌کنه

**ایده‌های بهبود:**

| اولویت | ایده |
|:------:|------|
| 🔴 | **صفحه‌ی مستقل** — `views/auth/verify-email.ejs` با طراحی اختصاصی |
| 🔴 | **6-digit OTP input با auto-advance** — ۶ باکس جدا که با تایپ خودکار می‌ره بعدی |
| 🔴 | **Paste support** — paste کردن کد از کلیپ‌بورد → auto-fill همه |
| 🟡 | **Countdown timer** — «ارسال مجدد در ۴۵ ثانیه» |
| 🟡 | **Resend button** — با cooldown |
| 🟡 | **«تغییر ایمیل»** — لینک به settings اگه اشتباه وارد کرد |
| 🟡 | **WhatsApp/Telegram hint** — «ایمیل رو در اسپم چک کن» |
| 🟢 | **Success animation** — ✓ بزرگ سبز بعد از تایید |
| 🟢 | **Auto-redirect** — به داشبورد بعد از ۲ ثانیه |

---

### ۲.۲ — `/auth/login` و `/auth/register`

**وضعیت فعلی:**
- فرم کامل + validation + FormKit
- ورود با ایمیل یا یوزرنیم
- تایید ایمیل بعد از ثبت‌نام

**ایده‌های بهبود:**

| اولویت | ایده |
|:------:|------|
| 🔴 | **«ورود با Google»** — (نیاز به OAuth) |
| 🟡 | **Password strength meter** — توی register (فعلاً هست ✅) |
| 🟡 | **Username availability check** — debounced (اگه هست، تست کن) |
| 🟡 | **Caps Lock warning** — «Caps Lock روشنه» |
| 🟡 | **Remember me** — چک‌باکس ✅ (تست کن که کار می‌کنه) |
| 🟢 | **«چه اتفاقی افتاد؟»** — لینک به FAQ |
| 🟢 | **Social proof** — «۱۰,۰۰۰ توسعه‌دهنده عضو شدن» |
| 🟢 | **Dark/light preview** — نمایش تم |

---

### ۲.۳ — `/dashboard/profile` — پروفایل خود

**وضعیت فعلی:**
- Hero (name + username + email + avatar)
- Info grid
- Sessions list (revoke)
- Logout / Logout-all

**ایده‌های بهبود:**

| اولویت | ایده |
|:------:|------|
| 🔴 | **«پروفایل عمومی من»** — لینک به `/users/:username` |
| 🔴 | **پروژه‌های من** — گرید کوچیک پروژه‌ها |
| 🟡 | **Activity feed** — فعالیت‌های اخیر |
| 🟡 | **Stats expand** — تعداد ریویو داده‌شده + دریافتی |
| 🟡 | **2FA section** — (نیاز به feature) |
| 🟢 | **Export data** — دانلود همه‌ی اطلاعات (GDPR) |

---

### ۲.۴ — `/dashboard/settings` — تنظیمات

**وضعیت فعلی:**
- Tab: عمومی / ایمیل / امنیت
- Avatar، name، bio (Markdown)، email change (۲ مرحله‌ای)، password change (OTP)

**ایده‌های بهبود:**

| اولویت | ایده |
|:------:|------|
| 🔴 | **Tab جدید: «پروفایل عمومی»** — social links، visibility |
| 🔴 | **Tab جدید: «اعلانات»** — انتخاب کانال (ایمیل، in-app) |
| 🟡 | **Session management** — جدا از profile، همه‌ی sessionها اینجا با جزئیات |
| 🟡 | **API tokens** — (برای v2) |
| 🟡 | **Delete account** — با confirmation چند مرحله‌ای |
| 🟡 | **Theme preference** — dark/light/system |
| 🟢 | **Language** — فارسی/انگلیسی |
| 🟢 | **Notifications email frequency** — فوری/روزانه/هفتگی |

---

### ۲.۵ — `/dashboard/home` — نمای کلی داشبورد

**وضعیت فعلی:**
- Welcome hero
- Stats نقش‌محور
- Admin panel shortcuts
- Dev health
- Recent projects

**ایده‌های بهبود:**

| اولویت | ایده |
|:------:|------|
| 🔴 | **Charts** — نمودار رشد پروژه‌ها/دانلودها در ۳۰ روز |
| 🔴 | **Activity feed** — «۲ نظر جدید»، «۱ ریویو»، «کاربر جدید» |
| 🟡 | **Quick actions** — «پروژه جدید»، «ویرایش پروژه‌ی آخر» |
| 🟡 | **Pending alerts** — «۵ کتگوری در انتظار تایید» (برای admin) |
| 🟡 | **Empty state برای کاربر جدید** — onboarding checklist |
| 🟢 | **Weather-like widget** — «امروز ۳ پروژه‌ی جدید ثبت شد» |

---

### ۲.۶ — `/dashboard/projects` — پروژه‌های من

**وضعیت فعلی:**
- Grid + filter + sort + search
- Modal ۵ مرحله‌ای (basic/content/media/tags/settings)
- Sync GitHub

**ایده‌های بهبود:**

| اولویت | ایده |
|:------:|------|
| 🔴 | **Bulk actions** — انتخاب چند پروژه → حذف/آرشیو/انتشار |
| 🔴 | **Drag to reorder** — (اگه featured) |
| 🟡 | **Duplicate project** — کپی با تغییر slug |
| 🟡 | **Draft autosave** — localStorage |
| 🟡 | **Preview as user** — مشاهده‌ی پروژه از دید بازدیدکننده |
| 🟡 | **Analytics per project** — کلیک روی کارت → صفحه‌ی آمار |
| 🟡 | **Import from GitHub** — paste repo URL → auto-fill |
| 🟢 | **Templates** — قالب‌های آماده |

---

### ۲.۷ — `/dashboard/tags` و `/dashboard/tag-types` — مدیریت تگ‌ها

**وضعیت فعلی:**
- لیست تگ‌ها + CRUD
- لیست کتگوری‌ها + approve/reject pending

**ایده‌های بهبود:**

| اولویت | ایده |
|:------:|------|
| 🔴 | **Bulk approve** — انتخاب چند pending → تایید یکجا |
| 🟡 | **Merge tags** — ادغام دو تگ مشابه |
| 🟡 | **Usage stats** — نمودار استفاده در زمان |
| 🟡 | **Reorder drag-drop** — برای کتگوری‌ها (order field) |
| 🟡 | **Approve with note** — «تایید با یادداشت» (audit) |
| 🟢 | **Import/Export JSON** — کتگوری‌ها و تگ‌ها |
| 🟢 | **Suggest with AI** — «این تگ شبیه X هست» |

---

### ۲.۸ — `/dashboard/users` — مدیریت کاربران

**وضعیت فعلی:**
- جدول کاربران + search + role filter
- تغییر نقش + ban

**ایده‌های بهبود:**

| اولویت | ایده |
|:------:|------|
| 🔴 | **Pagination واقعی** — (فعلاً شاید limit=20 ثابته) |
| 🔴 | **آمار per user** — پروژه‌ها، ریویو، آخرین فعالیت |
| 🟡 | **Bulk actions** — انتخاب چند کاربر → تغییر نقش |
| 🟡 | **User detail modal** — کلیک روی کاربر → modal با همه‌چیز |
| 🟡 | **Search by email** — دقیق |
| 🟡 | **Sort by** — تاریخ عضویت، آخرین فعالیت، تعداد پروژه |
| 🟢 | **Export CSV** |
| 🟢 | **Audit log** — چه کسی چه تغییری داد |

---

### ۲.۹ — `/dashboard/system` و `/dashboard/logs` — مانیتورینگ

**وضعیت فعلی:**
- Stats (CPU، memory، db، uptime)
- Logs با filter + download

**ایده‌های بهبود:**

| اولویت | ایده |
|:------:|------|
| 🔴 | **Real-time chart** — نمودار CPU/memory live (Chart.js) |
| 🔴 | **SSE (Server-Sent Events)** — لاگ‌های زنده بدون polling |
| 🟡 | **Alert thresholds** — اگه memory > 80%، warning |
| 🟡 | **DB slow queries** — top 10 کندترین query |
| 🟡 | **Restart button** — graceful restart (اگه PM2) |
| 🟢 | **Export logs** — فایل زیپ همه |
| 🟢 | **Search در لاگ‌ها** ✅ (هست) |
| 🟢 | **Filter by level** ✅ |

---

## 🔴 ۳. صفحاتی که **وجود ندارن** ولی لازم‌ان

این‌ها توی nav یا footer لینک دارن، ولی صفحه‌شون نیست:

### ۳.۱ — `/users` — لیست کاربران (عمومی)

**وضعیت:** لینک توی nav هدر هست ✅، ولی صفحه نداره ❌

**چی باید باشه:**
- گرید کاربران با آواتار + نام + تعداد پروژه
- Search + sort (جدیدترین، فعال‌ترین)
- فیلتر بر اساس نقش
- Pagination

**ایده‌های اضافی:**
- Leaderboard (برترین‌های ماه)
- «کاربران پیشنهادی» بر اساس علاقه

---

### ۳.۲ — `/about` — درباره ما

**وضعیت:** لینک توی nav ✅، ولی صفحه نداره ❌

**چی باید باشه:**
- داستان پروژه (چرا ساخته شد)
- تیم / maintainers
- تکنولوژی‌ها
- آمار (X پروژه، Y کاربر)
- لینک به GitHub / CONTRIBUTING
- Roadmap کوتاه

---

### ۳.۳ — `/contact` — تماس با ما

**وضعیت:** لینک توی nav ✅، ولی صفحه نداره ❌

**چی باید باشه:**
- فرم تماس (name, email, subject, message)
- لینک ایمیل مستقیم
- لینک به GitHub Issues
- سوشال مدیا
- FAQ کوتاه

**ایده:** با `POST /api/contact` → ذخیره در DB + notification به admin

---

### ۳.۴ — `/terms` — قوانین استفاده

**وضعیت:** لینک از فرم register ✅، ولی صفحه نداره ❌

**چی باید باشه:**
- شرایط استفاده
- رفتار مجاز / غیرمجاز
- مالکیت محتوا
- مسئولیت‌ها

---

### ۳.۵ — `/privacy` — حریم خصوصی

**وضعیت:** احتمالاً لینک هست، صفحه نیست ❌

**چی باید باشه:**
- چه داده‌ای جمع‌آوری می‌شه
- چرا (purpose)
- چه کسی دسترسی داره
- حق حذف / export
- Cookies

---

### ۳.۶ — `/tags` و `/tags/:slug` — لیست تگ‌های عمومی

**وضعیت:** وجود نداره ❌

**چی باید باشه:**
- `/tags` → همه‌ی تگ‌ها با usage count، فیلتر بر اساس کتگوری
- `/tags/:slug` → پروژه‌های یک تگ خاص (مثل `/projects?tag=react`)

---

### ۳.۷ — `/faq` — سوالات متداول

**چی باید باشه:**
- «چطور پروژه بسازم؟»
- «چرا ایمیل تایید نمی‌شه؟»
- «چطور تگ جدید بسازم؟»
- «چرا ریویو ثبت نمی‌شه؟»
- با آکاردئون (details/summary)

---

### ۳.۸ — `/changelog` — تغییرات

**چی باید باشه:**
- لیست نسخه‌ها با تغییرات
- لینک به GitHub Releases

---

### ۳.۹ — `/forgot-password` — فراموشی رمز

**وضعیت:** فایل `forgot-password.ejs` هست ✅، ولی توی tree که فرستادی، **فقط `auth/forgot-password.js` بود**. بررسی کن که صفحه‌ش هست.

---

## 🟣 ۴. صفحات پیشنهادی (فراتر از MVP)

### ۴.۱ — `/dashboard/notifications` — اعلانات

**چی باید باشه:**
- لیست اعلانات (ریویو جدید، کامنت، follow، approve)
- علامت «خوانده‌شده»
- فیلتر (همه / unread)
- Real-time با SSE یا WebSocket

---

### ۴.۲ — `/dashboard/analytics` — آمار پیشرفته

**چی باید باشه:**
- نمودار بازدید/دانلود در زمان
- Traffic source (referrer)
- Top projects
- Funnel: visit → download → review

---

### ۴.۳ — `/dashboard/security` — امنیت (جدا از settings)

**چی باید باشه:**
- Session management کامل با جزئیات
- 2FA setup (TOTP + QR)
- Login history
- API tokens (برای v2)

---

### ۴.۴ — `/blog` و `/blog/:slug` — بلاگ / اخبار

**چی باید باشه:**
- مقاله‌های فنی (اختیاری)
- اخبار پروژه
- تغییرات roadmap
- فقط admin publish

---

### ۴.۵ — `/roadmap` — نقشه راه

**چی باید باشه:**
- نسخه‌های آینده
- وضعیت هر feature (planned / in progress / done)
- رأی کاربران (برای اولویت)

---

### ۴.۶ — `/search` — جستجوی پیشرفته

**چی باید باشه:**
- جستجوی همه‌چیز (پروژه، کاربر، تگ)
- فیلترهای ترکیبی
- Highlight نتایج
- لینک به `/explore?q=` برای پروژه‌ها

---

## 📊 ۵. خلاصه‌ی وضعیت

### موجود (کار می‌کنن) ✅
| صفحه | وضعیت | نیاز به بهبود |
|------|:-----:|:-------------:|
| `/` | ✅ | 🟡 متوسط |
| `/explore` | ✅ | 🟡 متوسط |
| `/projects` | ✅ | 🟢 کم (merge با explore?) |
| `/projects/:idOrSlug` | ✅ | 🔴 زیاد |
| `/users/:username` | ✅ | 🔴 زیاد |
| `/auth/login` | ✅ | 🟢 کم |
| `/auth/register` | ✅ | 🟢 کم |
| `/auth/forgot-password` | ✅ | 🟢 کم |
| `/auth/reset-password` | ✅ | 🟢 کم |
| `/dashboard` | ✅ | 🟡 متوسط |
| `/dashboard/projects` | ✅ | 🟡 متوسط |
| `/dashboard/profile` | ✅ | 🔴 زیاد |
| `/dashboard/settings` | ✅ | 🟡 متوسط |
| `/dashboard/tags` | ✅ | 🟢 کم |
| `/dashboard/tag-types` | ✅ | 🟢 کم |
| `/dashboard/users` | ✅ | 🟡 متوسط |
| `/dashboard/system` | ✅ | 🟡 متوسط |
| `/dashboard/logs` | ✅ | 🟢 کم |
| `/404` | ✅ | 🟢 کم |

### ناقص (صفحه‌ی مستقل نداره یا ناکامله) 🟡
| صفحه | مشکل |
|------|------|
| `/auth/verify-email` | فایل `.ejs` نیست (inline render می‌شه؟) |
| `/projects` (list) | تفاوتش با explore مشخص نیست |

### گم‌شده (لینک هست، صفحه نیست) 🔴
| صفحه | توی nav |
|------|:-------:|
| `/users` | ✅ |
| `/about` | ✅ |
| `/contact` | ✅ |
| `/terms` | ✅ (از register) |
| `/privacy` | ✅ (احتمالاً) |
| `/tags` | ❌ (نه، ولی خوبه) |
| `/faq` | ❌ |
| `/changelog` | ❌ |
| `/roadmap` | ❌ |

---

## 🎯 ۶. پیشنهاد ترتیب کار

### فاز ۱ — ضروری (سریع، ۱-۲ روز)
```
1. /auth/verify-email.ejs — اگه نیست، بساز
2. /users — لیست کاربران (با search + sort)
3. /about — صفحه‌ی ساده
4. /contact — فرم + API
5. /terms و /privacy — صفحات قانونی ساده
```

### فاز ۲ — بهبود صفحات اصلی (۳-۵ روز)
```
6. صفحه پروژه — ToC + similar + «درباره سازنده»
7. پروفایل عمومی — Follow + Activity + Badges
8. اکسپلور — فیلترهای پیشرفته + view toggle
9. داشبورد home — Charts + Activity feed
10. settings — 2 tab جدید
```

### فاز ۳ — ویژگی‌های جدید (۱-۲ هفته)
```
11. /dashboard/notifications — سیستم اعلانات
12. /dashboard/analytics — آمار پیشرفته
13. /tags و /tags/:slug — صفحه‌ی تگ
14. /faq, /roadmap, /changelog — صفحات محتوایی
15. /search — جستجوی سراسری
```

---

## 💡 ۷. ایده‌های کلی برای همه صفحات

### Micro-interactions
- ✅ Hover روی کارت → lift + shadow
- ✅ Skeleton loading قبل از داده
- ✅ Smooth page transitions
- ✅ Focus ring واضح برای کیبورد

### Accessibility
- ⬜ `aria-label` روی همه‌ی دکمه‌های icon-only
- ⬜ Skip-to-content link
- ⬜ Focus trap در modalها
- ⬜ Alt text روی همه‌ی تصاویر
- ⬜ High contrast mode

### Performance
- ⬜ Lazy load تصاویر (`loading="lazy"`)
- ⬜ Prefetch لینک‌های مهم (`<link rel="prefetch">`)
- ⬜ Image optimization (WebP + srcset)
- ⬜ Font subsetting (فقط فارسی)

### SEO
- ⬜ `<title>` و `<meta description>` برای همه صفحات
- ⬜ Open Graph tags (og:title, og:image)
- ⬜ JSON-LD برای پروژه‌ها
- ⬜ Sitemap.xml
- ⬜ robots.txt

### i18n (آینده)
- ⬜ سیستم ترجمه (fa/en)
- ⬜ RTL/LTR switch

### Empty states
- ⬜ همه‌ی لیست‌ها → تصویر + پیام + CTA
- ⬜ «اولین نفری باش که X می‌سازه»

### Error states
- ⬜ 404 اختصاصی (نه generic)
- ⬜ 500 با «دوباره امتحان کن»
- ⬜ Offline detection

---

## 📈 ۸. اولویت‌بندی نهایی

### 🔴 باید حتماً باشه (قبل از v1.0)
- [ ] `/users` (لیست کاربران) — لینک هست، صفحه نیست
- [ ] `/about`, `/contact`, `/terms`, `/privacy`
- [ ] `/auth/verify-email.ejs` (چک که هست)
- [ ] بهبود صفحه‌ی پروژه (ToC، similar)
- [ ] بهبود پروفایل (Follow، Activity)
- [ ] داشبورد home (Charts، Activity)

### 🟡 خوبه که باشه (v1.1)
- [ ] `/dashboard/notifications`
- [ ] `/tags` و `/tags/:slug`
- [ ] `/faq`, `/roadmap`, `/changelog`
- [ ] `/dashboard/analytics`
- [ ] `/search`

### 🟢 عالیه (v1.2+)
- [ ] `/blog`
- [ ] `/dashboard/security` (2FA)
- [ ] `/dashboard/api-tokens`
- [ ] Multi-language