# 📘 AI_GUIDE.md — راهنمای جامع برای هوش مصنوعی

> این سند منبع حقیقت (Source of Truth) پروژه **DevHub** است. هر AI که وارد این پروژه می‌شود باید اول این را کامل بخواند.

---

## 🎯 ۱. شمای کلی پروژه

### نام و هدف
- **نام:** DevHub (repo: `manage-projects`)
- **شعار:** Discover. Review. Ship.
- **هدف:** پلتفرم فارسی برای کشف، نقد و به اشتراک‌گذاری پروژه‌های متن‌باز با سیستم ریویو، کامنت تو در تو، تگ‌گذاری، اکسپلور هوشمند و داشبورد نقش‌محور.

### Stack
| لایه       | فناوری                                    |
| ---------- | ----------------------------------------- |
| Backend    | Node.js 20+, Express, TypeScript          |
| Database   | MongoDB + Mongoose                        |
| View       | EJS (SSR)                                 |
| Auth       | JWT (access + refresh) + HttpOnly cookies |
| Validation | Zod                                       |
| Upload     | Multer                                    |
| Email      | Nodemailer (SMTP / Log)                   |
| Frontend   | Vanilla JS + Modular CSS + RTL            |

### ساختار پوشه‌ها (Split: backend / frontend)

```
manage-projects/
├── backend/src/          → همه‌ی کد بک‌اند
├── frontend/public/      → JS + CSS + assets
├── frontend/views/       → EJS templates
├── docs/                 → مستندات پروژه
└── docker-compose.yml    → MongoDB محلی
```

> ⚠️ **مهم:** این پروژه split شده — کد بک‌اند در `backend/`، فرانت (JS/CSS/EJS) در `frontend/`. هنگام ایمپورت‌ها به این ساختار دقت کن.

---

## 🗺️ ۲. نقشه‌ی کامل فایل‌ها (Cheat Sheet)

### Backend — `backend/src/`

#### Entry points
| فایل            | نقش                                                    |
| --------------- | ------------------------------------------------------ |
| `index.ts`      | بوت سرور (connectDB → listen)                          |
| `app.ts`        | ساخت Express app، mount کردن routeها، middlewareها     |
| `lib/loader.ts` | لودر خودکار routeها (کشف و mount از `api/` و `pages/`) |

#### `api/` — روت‌های API (منبع اصلی endpointها)
```
api/
├── 404/page.ts
├── auth/router.ts
├── admin/router.ts
├── profile/router.ts
├── projects/router.ts
├── tags/router.ts
├── tag-types/router.ts
├── users/route.ts
├── system/route.ts
└── health/route.ts
```

> 📌 **قاعده:** هر فولدر یک `router.ts` یا `route.ts` داره که با `loader.ts` به‌صورت خودکار به مسیر `/<folder-name>` mount می‌شه.

#### `routes/` — نسخه‌ی قدیمی/جداگانه route modules
```
routes/
├── adminRoutes.ts
├── authRoutes.ts
├── commentRoutes.ts
├── dashboardRoutes.ts
├── profileRoutes.ts
├── projectRoutes.ts
├── reviewRoutes.ts
├── systemRoutes.ts
├── tagRoutes.ts
├── tagTypeRoutes.ts
└── userRoutes.ts
```

> ⚠️ **هشدار به AI:** هر دو `api/` و `routes/` وجود دارند. **قبل از افزودن endpoint جدید، `app.ts` را بخوان** تا بفهمی کدام فعال است. `api/` معمولاً via `loader.ts` خودکار mount می‌شود و `routes/` ممکن است legacy باشد.

#### `pages/` — روت‌های HTML (SSR)
```
pages/
├── page.ts                    → helperهای render
├── auth/
│   ├── login.ts
│   ├── register.ts
│   ├── forgot-password.ts
│   └── reset-password.ts
├── dashboard/route.ts         → همه‌ی /dashboard/*
├── explore/page.ts
├── projects/
│   ├── projects.ts            → /projects (list)
│   └── project.ts             → /projects/:idOrSlug
└── users/page.ts              → /users/:idOrUsername
```

#### `controllers/`
```
adminController.ts        → مدیریت کاربران (list, changeRole, toggleBan)
authController.ts         → register, login, verifyEmail, refresh, logout, sessions
commentController.ts      → CRUD + like
healthController.ts       → /api/health
profileController.ts      → updateProfile, avatar, email change, password change
projectController.ts      → CRUD + media + explore + homeFeed
reviewController.ts       → CRUD + helpful
systemController.ts       → stats, logs
tagController.ts          → CRUD + findOrCreate + approve
tagTypeController.ts      → CRUD + approve
userController.ts         → public profile + projects + reviews
```

#### `models/`
| فایل                  | Entity                                     |
| --------------------- | ------------------------------------------ |
| `User.ts`             | کاربر (نقش، آواتار، پروفایل، pendingEmail) |
| `Project.ts`          | پروژه (media، GitHub، آمار، تگ‌ها)          |
| `Review.ts`           | ریویو (rating + satisfaction)              |
| `Comment.ts`          | کامنت (تو در تو + like)                    |
| `Tag.ts`              | تگ                                         |
| `TagType.ts`          | کتگوری تگ                                  |
| `Session.ts`          | سشن (device + location + token)            |
| `VerificationCode.ts` | کد OTP                                     |

#### `services/`
```
cache.ts                → in-memory cache (explore، home-feed)
exploreService.ts       → الگوریتم Hot Score + home feeds
fileService.ts          → toPublicUrl، deleteFile، deleteProjectFiles
githubService.ts        → parseGitHubUrl، fetchRepoInfo، fetchRepoDownloads
logger.ts               → hook روی console + ذخیره فایل روزانه
ratingService.ts        → recalculateProjectStats (میانگین امتیاز)
roleService.ts          → changeUserRole، hasRole، bootstrap
sessionService.ts       → startSession، endSession، endAllSessions
verificationService.ts  → createVerificationCode، verifyCode
mail/                   → سیستم ایمیل کامل
  ├── config.ts         → env-based config
  ├── mailService.ts    → orchestrator + rate limit
  ├── rateLimiter.ts
  ├── types.ts
  ├── utils.ts
  ├── templates/otpTemplate.ts + sendOtpEmail.ts
  └── transports/logTransport.ts + smtpTransport.ts
```

#### `middleware/`
```
auth.ts          → requireAuth، optionalAuth
pageAuth.ts      → guard صفحه‌های HTML (redirect به /auth/login)
roles.ts         → requireAdmin، requireDeveloper، pageAdminGuard، pageDeveloperGuard
ownership.ts     → requireProjectOwnership، requireTagOwnership، loadProject
upload.ts        → mwUploadAvatar، mwUploadImages، mwUploadVideo، mwUploadZip
errorHandler.ts  → تبدیل همه‌ی خطاها به JSON
locals.ts        → attachUserLocals (res.locals.currentUser)
noCache.ts       → هدرهای no-cache
```

#### `utils/`
```
AppError.ts       → کلاس خطای ساختاریافته + factoryها
asyncHandler.ts   → wrapper برای همه‌ی controllerها
errorCodes.ts     → همه‌ی کدها + پیام‌های فارسی
geoip.ts          → lookup IP → country/city/isp
parseUserAgent.ts → parse device info از User-Agent
token.ts          → signAccessToken، signRefreshToken، signEmailVerifyToken، ...
validate.ts       → validate(schema, data) → Zod
```

#### `validators/`
```
authValidator.ts     → registerSchema، loginSchema، verifyEmailSchema، forgotPassword، resetPassword، ...
profileValidator.ts  → updateProfile، email change، password change، username
projectValidator.ts  → createProject، updateProject، listQuery، exploreQuery
reviewValidator.ts   → createReview، updateReview، listQuery
commentValidator.ts  → createComment، updateComment، listQuery
tagValidator.ts      → createTag، createTagType، findOrCreate، suggest، requestTagType، ...
```

#### `scripts/` (CLI)
```bash
npx tsx backend/src/scripts/promoteUser.ts <email> <role> [reason]
npx tsx backend/src/scripts/setupFirstAdmin.ts
npx tsx backend/src/scripts/seedDefaultData.ts
npx tsx backend/src/scripts/syncIndexes.ts
npx tsx backend/src/scripts/cleanupVerificationCodes.ts
npx tsx backend/src/scripts/testMail.ts <email>
```

---

### Frontend — `frontend/`

#### `views/` — EJS templates
```
views/
├── index.ejs                    → صفحه اصلی (home)
├── explore.ejs                  → اکسپلور
├── 404.ejs
│
├── auth/
│   ├── login.ejs
│   ├── register.ejs
│   ├── forgot-password.ejs
│   └── reset-password.ejs
│
├── projects/
│   ├── list.ejs                 → /projects
│   └── show.ejs                 → /projects/:idOrSlug
│
├── users/
│   └── show.ejs                 → /users/:idOrUsername
│
├── dashboard/
│   ├── home.ejs                 → /dashboard
│   ├── projects.ejs             → /dashboard/projects
│   ├── profile.ejs              → /dashboard/profile
│   ├── settings.ejs             → /dashboard/profile/settings
│   ├── tags.ejs                 → /dashboard/tags (admin+)
│   ├── tag-types.ejs            → /dashboard/tag-types (admin+)
│   ├── users.ejs                → /dashboard/users (admin+)
│   ├── system.ejs               → /dashboard/system (developer)
│   └── logs.ejs                 → /dashboard/logs (developer)
│
└── components/
    ├── header.ejs               → هدر یکپارچه (nav + search + notif + profile + drawer)
    ├── brand.ejs                → لوگوی SVG با پارامتر
    ├── search-modal.ejs         → مودال Ctrl+K
    ├── mobile-drawer.ejs        → Drawer موبایل + داشبورد section
    ├── dashboard-nav.ejs        → سایدبار داشبورد (دسکتاپ)
    ├── dashboard-nav-items.ejs  → آیتم‌های داشبورد (variant: sidebar|drawer|menu)
    ├── dash-breadcrumb.ejs      → Breadcrumb تعاملی با dropdown
    └── dialogError.ejs          → dialog + confirm + toast
```

#### `public/js/` — Client JS
```
js/
├── index.js                     → helperهای عمومی صفحه اصلی
├── header.js                    → منطق هدر (auth، drawer، search)
├── dashboard-nav.js             → collapse + active + breadcrumb dropdown
├── form-errors.js               → FormKit (global)
├── dialog-error.js              → dialogError + confirmDialog + toast
│
├── components/
│   ├── markdown-editor.js       → کلاس MarkdownEditor
│   ├── tag-picker.js            → کلاس TagPicker
│   └── user-chip.js             → helper window.userChip
│
├── auth/
│   ├── login.js
│   ├── register.js
│   ├── verify-email.js
│   ├── forgot-password.js
│   └── reset-password.js
│
├── pages/
│   ├── home.js                  → صفحه اصلی
│   ├── explore.js               → صفحه اکسپلور
│   └── users-show.js            → پروفایل عمومی
│
├── projects/
│   └── show.js                  → جزئیات پروژه
│
└── dashboard/
    ├── home.js                  → نمای کلی
    ├── projects.js              → CRUD پروژه‌ها
    ├── profile.js               → پروفایل کاربر
    ├── settings.js              → تنظیمات
    ├── tags.js                  → مدیریت تگ‌ها
    ├── tag-types.js             → مدیریت کتگوری‌ها
    ├── users.js                 → مدیریت کاربران
    ├── system.js                → وضعیت سیستم
    └── logs.js                  → لاگ‌ها
```

#### `public/styles/` — CSS
```
styles/
├── index.css                    → base + shared (user-chip، btn)
├── header.css                   → هدر + drawer + search + profile menu
├── dialog.css                   → dialog + toast + confirm
├── form-errors.css              → خطاهای فرم (shake، inline)
├── auth.css                     → فرم‌های auth
├── markdown-editor.css          → ادیتور Markdown + preview
├── explore.css                  → صفحه اکسپلور + کارت پروژه + hero
│
├── auth/
│   └── password-reset.css       → forgot + reset pages
│
├── dashboard/
│   ├── dashboard.css            → layout + card + breadcrumb
│   ├── dashboard-nav.css        → سایدبار + collapse
│   ├── home.css                 → صفحه home
│   ├── projects.css             → پروژه‌ها
│   ├── project-modal.css        → مودال multi-step
│   ├── profile.css              → پروفایل کاربر
│   ├── settings.css             → تنظیمات
│   ├── tags.css                 → تگ‌ها
│   ├── tag-types.css            → کتگوری‌ها
│   ├── tag-picker.css           → کامپوننت TagPicker
│   ├── users.css                → جدول کاربران
│   ├── system.css               → وضعیت سیستم
│   └── logs.css                 → لاگ‌ها
│
├── projects/
│   └── show.css                 → صفحه پروژه
│
└── users/
    └── show.css                 → پروفایل عمومی
```

---

## 🌐 ۳. روت‌های کامل (Endpoints + Pages)

### 📄 صفحات (HTML / SSR)

| Method | Path                          | Template                   |   Auth    |
| ------ | ----------------------------- | -------------------------- | :-------: |
| GET    | `/`                           | `index.ejs`                |     —     |
| GET    | `/explore`                    | `explore.ejs`              |     —     |
| GET    | `/projects`                   | `projects/list.ejs`        |     —     |
| GET    | `/projects/:idOrSlug`         | `projects/show.ejs`        |     —     |
| GET    | `/users/:idOrUsername`        | `users/show.ejs`           |     —     |
| GET    | `/auth/login`                 | `auth/login.ejs`           |   guest   |
| GET    | `/auth/register`              | `auth/register.ejs`        |   guest   |
| GET    | `/auth/verify-email`          | (inline در auth یا صفحه)   |     —     |
| GET    | `/auth/forgot-password`       | `auth/forgot-password.ejs` |   guest   |
| GET    | `/auth/reset-password`        | `auth/reset-password.ejs`  |     —     |
| GET    | `/dashboard`                  | `dashboard/home.ejs`       |     ✅     |
| GET    | `/dashboard/projects`         | `dashboard/projects.ejs`   |     ✅     |
| GET    | `/dashboard/profile`          | `dashboard/profile.ejs`    |     ✅     |
| GET    | `/dashboard/profile/settings` | `dashboard/settings.ejs`   |     ✅     |
| GET    | `/dashboard/tags`             | `dashboard/tags.ejs`       |  admin+   |
| GET    | `/dashboard/tag-types`        | `dashboard/tag-types.ejs`  |  admin+   |
| GET    | `/dashboard/users`            | `dashboard/users.ejs`      |  admin+   |
| GET    | `/dashboard/system`           | `dashboard/system.ejs`     | developer |
| GET    | `/dashboard/logs`             | `dashboard/logs.ejs`       | developer |

### 🔌 API Endpoints

#### `/api/auth`
| Method | Path                          |  Auth  | کار                     |
| ------ | ----------------------------- | :----: | ----------------------- |
| POST   | `/register`                   |   —    | ثبت‌نام + OTP            |
| POST   | `/verify-email`               |   —    | تایید ایمیل + session   |
| POST   | `/resend-verification`        |   —    | ارسال مجدد OTP          |
| POST   | `/resend-verification-for-me` |   ✅    | برای کاربر لاگین        |
| POST   | `/login`                      |   —    | ورود (ایمیل یا یوزرنیم) |
| POST   | `/refresh`                    | cookie | چرخش access             |
| POST   | `/logout`                     | cookie | خروج                    |
| POST   | `/logout-all`                 |   ✅    | خروج از همه             |
| POST   | `/forgot-password`            |   —    | OTP بازیابی             |
| POST   | `/reset-password`             |   —    | بازیابی رمز             |
| POST   | `/resend-password-reset`      |   —    | ارسال مجدد              |
| GET    | `/me`                         |   ✅    | کاربر فعلی              |
| GET    | `/sessions`                   |   ✅    | لیست سشن‌ها              |
| DELETE | `/sessions/:id`               |   ✅    | revoke                  |

#### `/api/profile` (همه ✅)
| Method | Path                  |
| ------ | --------------------- |
| GET    | `/me`                 |
| PATCH  | `/me`                 |
| PATCH  | `/username`           |
| POST   | `/avatar` (multipart) |
| DELETE | `/avatar`             |
| POST   | `/email/request`      |
| POST   | `/email/verify-old`   |
| DELETE | `/email/pending`      |
| POST   | `/password/request`   |
| POST   | `/password/confirm`   |

#### `/api/projects`
| Method | Path                  |   Auth   | کار                       |
| ------ | --------------------- | :------: | ------------------------- |
| GET    | `/`                   | optional | لیست (mine, search, sort) |
| GET    | `/explore`            |    —     | اکسپلور                   |
| GET    | `/home-feed`          |    —     | فید home (cache)          |
| GET    | `/:idOrSlug`          | optional | یک پروژه                  |
| POST   | `/`                   |    ✅     | ساخت                      |
| PUT    | `/:id`                | ✅ owner  | ویرایش                    |
| DELETE | `/:id`                | ✅ owner  | حذف                       |
| POST   | `/:id/sync-github`    | ✅ owner  | سینک                      |
| PATCH  | `/:id/status`         | ✅ owner  | تغییر وضعیت               |
| POST   | `/:id/images`         | ✅ owner  | آپلود (multipart)         |
| DELETE | `/:id/images/:imgId`  | ✅ owner  | حذف تصویر                 |
| PATCH  | `/:id/images/order`   | ✅ owner  | ترتیب                     |
| POST   | `/:id/video`          | ✅ owner  | ویدیو                     |
| DELETE | `/:id/video`          | ✅ owner  | حذف ویدیو                 |
| POST   | `/:id/file`           | ✅ owner  | ZIP                       |
| DELETE | `/:id/file`           | ✅ owner  | حذف ZIP                   |
| GET    | `/:idOrSlug/download` | optional | دانلود + شمارش            |

#### `/api/projects/:idOrSlug/reviews`
| Method | Path           |            Auth            |
| ------ | -------------- | :------------------------: |
| GET    | `/`            | optional (شامل `myReview`) |
| GET    | `/me`          |             ✅              |
| POST   | `/`            |             ✅              |
| PUT    | `/`            |             ✅              |
| DELETE | `/`            |             ✅              |
| POST   | `/:id/helpful` |             ✅              |

#### `/api/projects/:idOrSlug/comments`
| Method | Path        |           Auth           |
| ------ | ----------- | :----------------------: |
| GET    | `/`         | optional (با `parentId`) |
| POST   | `/`         |            ✅             |
| PUT    | `/:id`      |            ✅             |
| DELETE | `/:id`      |            ✅             |
| POST   | `/:id/like` |            ✅             |

#### `/api/tags`
| Method | Path              |    Auth     |
| ------ | ----------------- | :---------: |
| GET    | `/`               |      —      |
| GET    | `/suggest`        |      —      |
| GET    | `/pending`        |    admin    |
| GET    | `/:id`            |      —      |
| POST   | `/find-or-create` |      ✅      |
| POST   | `/`               |      ✅      |
| PUT    | `/:id`            | owner/admin |
| DELETE | `/:id`            | owner/admin |
| POST   | `/:id/approve`    |    admin    |

#### `/api/tag-types`
| Method | Path           |    Auth     |
| ------ | -------------- | :---------: |
| GET    | `/`            |      —      |
| GET    | `/:id`         |      —      |
| POST   | `/request`     | ✅ (pending) |
| POST   | `/`            |    admin    |
| PUT    | `/:id`         |    admin    |
| DELETE | `/:id`         |    admin    |
| POST   | `/:id/approve` |    admin    |

#### `/api/users`
| Method | Path                      |
| ------ | ------------------------- |
| GET    | `/:idOrUsername`          |
| GET    | `/:idOrUsername/projects` |
| GET    | `/:idOrUsername/reviews`  |

#### `/api/admin` (admin+)
| Method | Path              |
| ------ | ----------------- |
| GET    | `/users`          |
| POST   | `/users/:id/role` |
| POST   | `/users/:id/ban`  |

#### `/api/system` (developer)
| Method | Path             |
| ------ | ---------------- |
| GET    | `/stats`         |
| GET    | `/logs`          |
| GET    | `/logs/download` |
| POST   | `/logs/clear`    |

#### Public
| Method | Path          |
| ------ | ------------- |
| GET    | `/api/health` |

---

## 🔐 ۴. احراز هویت و امنیت

### نقش‌ها (سلسله‌مراتبی)
```
user → admin → developer
```

| عمل                     | user  | admin | developer |
| ----------------------- | :---: | :---: | :-------: |
| ساخت پروژه + تگ         |   ✅   |   ✅   |     ✅     |
| درخواست کتگوری          |   ✅   |   ✅   |     ✅     |
| تایید/ویرایش/حذف کتگوری |   ❌   |   ✅   |     ✅     |
| تایید تگ دیگران         |   ❌   |   ✅   |     ✅     |
| مدیریت کاربران          |   ❌   |   ✅   |     ✅     |
| تغییر user ↔ admin      |   ❌   |   ✅   |     ✅     |
| تغییر → developer       |   ❌   |   ❌   |     ✅     |
| بن/آنبن                 |   ❌   |   ✅   |     ✅     |
| صفحه system + logs      |   ❌   |   ❌   |     ✅     |

**اولین کاربر ثبت‌نام‌شده** → خودکار `developer`.

### جریان ثبت‌نام
```
POST /api/auth/register
  → user ساخته می‌شه (emailVerified: false)
  → OTP به ایمیل می‌ره
  → { requiresVerification: true, verifyToken, email }
  → NO session

POST /api/auth/verify-email { verifyToken, code }
  → emailVerified = true
  → session صادر می‌شه ✅
```

### جریان تغییر ایمیل (۲ مرحله)
```
1. POST /api/profile/email/request { newEmail, password }
   → OTP به ایمیل **قبلی**
   → pendingEmail.oldVerified = false

2. POST /api/profile/email/verify-old { code }
   → user.email = newEmail
   → emailVerified = false
   → OTP به ایمیل **جدید**
   → pendingEmail.oldVerified = true

3. redirect /auth/verify-email
   → تایید → emailVerified = true
```

### لایه‌های امنیتی
| مورد             | پیاده‌سازی                                 |
| ---------------- | ----------------------------------------- |
| Password         | bcrypt (12 rounds)                        |
| JWT              | access 15min، refresh 30d، `typ` مشخص     |
| Cookies          | HttpOnly + Secure (prod) + SameSite=lax   |
| Refresh Rotation | هر refresh → access جدید                  |
| Session Revoke   | بعد از تغییر رمز، همه sessionها بسته می‌شن |
| OTP              | SHA-256 + salt · ۵ تلاش · cooldown 60s    |
| Rate Limit       | per-recipient روی ایمیل                   |
| Path Traversal   | `path.basename` + regex در دانلود         |
| HTML Sanitize    | Markdown parser خودش strip می‌کنه          |
| Anti-enumeration | پیام یکسان برای موجود/ناموجود             |

---

## 📦 ۵. الگوهای کدنویسی

### Controller Pattern (همیشه)
```typescript
export const actionName = asyncHandler(async (req: any, res: Response) => {
    const data = validate(someSchema, req.body);
    if (!req.user) throw Unauthorized(ErrorCodes.UNAUTHENTICATED);
    const result = await SomeModel.doThing(data);
    res.json({ ok: true, ...result });
});
```

### AppError Factory
```typescript
throw new AppError(400, ErrorCodes.VALIDATION_ERROR, 'پیام', { field: 'email' });
throw Conflict(ErrorCodes.EMAIL_TAKEN);          // 409
throw Unauthorized(ErrorCodes.INVALID_CREDENTIALS); // 401
throw Forbidden(ErrorCodes.PROJECT_NOT_OWNED);   // 403
throw NotFound(ErrorCodes.PROJECT_NOT_FOUND);    // 404
```

### Response Shape
```json
// موفق
{ "ok": true, "message": "...", "data": { ... } }

// خطا
{
  "ok": false,
  "code": "ERROR_CODE",
  "message": "پیام فارسی",
  "field": "username",              // اختیاری
  "details": { "field": ["msg"] }   // اختیاری
}
```

### Frontend Fetch
```javascript
const data = await FormKit.postJSON('/api/projects', { title: 'X' });
```

### Form Handling
```javascript
FormKit.attach('#myForm', {
    validate(v) { return {}; },
    submit(v) { return FormKit.postJSON(url, v); },
    onSuccess(data) { location.href = '/'; },
});
```

### Client Error Display
- `FormKit.showFieldError(input, msg)` → shake + زیر فیلد
- `FormKit.showFormBanner(form, msg)` → بالا
- `openDialogError(title, msg)` → دیالوگ
- `confirmDialog({...})` → `Promise<boolean>`
- `toast(msg, 'success'|'error'|'info')` → گوشه

### Middleware Order (در app.ts)
```
1. express.json + urlencoded + cookieParser
2. attachUserLocals      → res.locals.currentUser
3. express.static        → /public, /uploads
4. EJS setup
5. Routes (API first، pages second)
6. 404 handler
7. errorHandler          ← آخرین
```

---

## 🧭 ۶. دستورالعمل AI برای افزودن قابلیت جدید

### مرحله ۱ — Model
**محل:** `backend/src/models/Xyz.ts`
```
1. interface IXyz
2. interface IXyzMethods (اگه متد داره)
3. sub-schemas اگه لازم
4. schema + indexes (TTL، unique، compound)
5. pre-save hooks
6. model + export
```

### مرحله ۲ — Validator
**محل:** `backend/src/validators/xyzValidator.ts`
```
createXyzSchema، updateXyzSchema، listQuerySchema
(همه با Zod)
```

### مرحله ۳ — Error Codes
**محل:** `backend/src/utils/errorCodes.ts`
```
XYZ_NOT_FOUND، XYZ_TAKEN، ...
+ پیام فارسی در ErrorMessages
```

### مرحله ۴ — Service (اگه منطق پیچیده)
**محل:** `backend/src/services/xyzService.ts`
```
- منطق کسب‌وکار
- قابل تست
- بدون دسترسی به req/res
```

### مرحله ۵ — Controller
**محل:** `backend/src/controllers/xyzController.ts`
```
- asyncHandler
- validate
- AppError
- پاسخ با { ok, data }
```

### مرحله ۶ — Route
**محل:** `backend/src/api/xyz/router.ts` (روش جدید — auto-load)
**یا** `backend/src/routes/xyzRoutes.ts` (روش قدیمی)
```
1. Router()
2. mount در app.ts یا loader.ts
3. guards مناسب
```

### مرحله ۷ — Page Route (اگه صفحه داره)
**محل:** `backend/src/pages/xyz/page.ts`
```
- اگر HTML page: با pageAuth یا pageAdminGuard
- render EJS
```

### مرحله ۸ — EJS Page
**محل:** `frontend/views/xyz/show.ejs`
```
1. <%- include("../components/header") %>
2. <%- include("../components/dialogError") %>
3. محتوا
4. <script src="/js/xyz/show.js"></script>
```

### مرحله ۹ — CSS
**محل:** `frontend/public/styles/xyz/show.css` یا زیر `dashboard/`

### مرحله ۱۰ — Client JS
**محل:** `frontend/public/js/xyz/show.js`
```
- fetch از API
- رندر DOM
- event handlers
```

---

## 🚫 ۷. قواعد طلایی (AI باید رعایت کند)

### ✅ همیشه
- `asyncHandler` در controller
- `validate` با Zod روی `req.body`
- `AppError` + `ErrorCodes` (نه `throw new Error`)
- `ok: true/false` در response
- `escapeHtml` قبل از `innerHTML`
- `credentials: 'include'` در `fetch`
- guard مناسب (`requireAuth` / `requireAdmin` / `requireDeveloper`)
- Error handling کامل (نه فقط `console.log`)
- Responsive + RTL + فارسی درست

### ❌ هرگز
- secret در کد کلاینت
- raw HTML بدون sanitize
- خطای DB رو مستقیم به کاربر نشون بده
- `req.body` رو بدون validation استفاده کن
- session رو دستی بساز (از `sessionService` استفاده کن)
- مستقیم `Model.save()` رو برای تغییر رمز بدون pre-save bypass کن
- بدون `pageAuth` صفحه‌ی private بساز
- داده‌ی حساس رو لاگ کن (password, token, OTP)

### 🎯 معیارهای کد قابل قبول
- [ ] TypeScript بدون `any` بی‌دلیل
- [ ] Validation سمت سرور (client فقط UX)
- [ ] Authorization (نه فقط Authentication)
- [ ] Error handling با کد و پیام واضح
- [ ] Responsive (دسکتاپ + تبلت + موبایل)
- [ ] RTL و فارسی درست
- [ ] Component ماژولار (اگه تکرار می‌شه)
- [ ] لاگ مناسب (بدون اطلاعات حساس)
- [ ] بدون breaking change در API موجود

---

## 🔄 ۸. جریان‌های مهم (Flow Diagrams)

### ساخت پروژه
```
1. Dashboard → btnNewProject
2. ensureEmailVerified() → اگه verified نبود redirect به verify
3. modal → 5 مراحل (basic / content / media / tags / settings)
4. submit → POST /api/projects → projectId
5. upload media (parallel) → images/video/file
6. reorder images
7. reload list
```

### ثبت‌نام کاربر
```
1. /auth/register → fill form
2. POST /api/auth/register → { requiresVerification, verifyToken, email }
3. sessionStorage.setItem('verify_email_state', ...)
4. redirect → /auth/verify-email
5. enter OTP
6. POST /api/auth/verify-email { verifyToken, code }
7. session issued → redirect /dashboard
```

### اکسپلور با Hot Score
```
GET /api/projects/explore?sort=trending&window=7d
  → exploreService.exploreProjects()
  → Mongo aggregation با:
    points = 1*stars + 2.5*forks + 0.3*downloads
           + 0.01*views + 5*rating + 4*reviews
           + 10 (images) + 10 (video) + 5 (file)
    hotScore = points / (ageHours + 2)^gravity
  → sort by hotScore desc
  → cache 5 min
```

### ریویو → آمار پروژه
```
POST /api/projects/:id/reviews
  → Review.create()
  → ratingService.recalculateProjectStats(projectId)
    → aggregate avg(rating), avg(satisfaction), count
    → Project.updateOne({ rating, satisfaction, reviewCount })
```

---

## 🧪 ۹. دیباگ و لاگ

### علامت‌های لاگ
```
🔴 [UNHANDLED ERROR]      → خطای مدیریت‌نشده
🟨 [FormKit]              → warning در FormKit
🟦 [FormKit]              → debug FormKit
📧 [VERIFICATION CODE]    → کد OTP در حالت log mode
🔐 [ROLE CHANGE]          → تغییر نقش
🔒 [PASSWORD CHANGED]     → تغییر رمز
🔄 [EMAIL CHANGED]        → تغییر ایمیل
✅ [EMAIL VERIFIED]       → تایید ایمیل
```

### Log Files
```
logs/app-YYYY-MM-DD.log
```
Auto-rotation روزانه + حذف بعد از N روز (در آینده).

### Environment Flags
```env
MAIL_MODE=log              # ایمیل در کنسول (dev)
MAIL_MODE=smtp             # ایمیل واقعی
MAIL_DEBUG=true            # verbose SMTP
MAIL_FAIL_FAST=true        # اگه SMTP fail → exit
NODE_ENV=development       # خطاهای دقیق
NODE_ENV=production        # خطاهای عمومی
```

---

## 📊 ۱۰. آمار پروژه

| مورد            | تعداد                        |
| --------------- | ---------------------------- |
| فایل TypeScript | ~۵۵                          |
| Controller      | 11                           |
| Model           | 8                            |
| Service         | 9 + mail/                    |
| EJS Page        | ۲۰                           |
| EJS Component   | 8                            |
| CSS             | ~۱۸                          |
| JS Client       | ~۲۵                          |
| API Endpoint    | ~۷۰                          |
| نقش‌ها           | 3 (user / admin / developer) |

---

## 🔮 ۱۱. Roadmap (اولویت‌بندی)

### v1.1
- [ ] Follow/Unfollow
- [ ] Notification system (bell + inbox)
- [ ] Activity feed در پروفایل
- [ ] Rate limiting روی `/auth/*`

### v1.2
- [ ] Search پیشرفته (Mongo Full-Text یا Elastic)
- [ ] Comments live (SSE)
- [ ] Admin panel UI
- [ ] User preferences

### v2.0
- [ ] Public REST API + versioning
- [ ] 2FA (TOTP)
- [ ] GraphQL
- [ ] Mobile app

---

## 🎯 ۱۲. چک‌لیست شروع برای AI جدید

قبل از هر تغییری:

- [ ] این سند رو کامل خوندم
- [ ] `backend/src/app.ts` رو خوندم تا بفهمم routeها چطور mount می‌شن
- [ ] `backend/src/lib/loader.ts` رو خوندم
- [ ] `.env` تنظیم شد و `npm run dev` اجرا شد
- [ ] صفحات زیر رو دیدم:
  - [ ] `/` (home)
  - [ ] `/explore`
  - [ ] `/projects/:idOrSlug`
  - [ ] `/users/:username`
  - [ ] `/dashboard`
- [ ] flow ثبت‌نام → تایید → لاگین رو تست کردم
- [ ] `errorCodes.ts` + `AppError.ts` + `authController.ts` رو خوندم
- [ ] `dashboard-nav-items.ejs` رو فهمیدم (ماژولار با `variant`)
- [ ] `attachUserLocals` middleware رو فهمیدم
- [ ] آماده‌ام ✅

---

## ⚡ ۱۳. نکات سریع

### برای عوض کردن theme/رنگ
- متغیرهای CSS در `frontend/public/styles/index.css` (base)
- در `header.css` و `dashboard-nav.css` متغیرهای اختصاصی

### برای عوض کردن نام برند
- `frontend/views/components/brand.ejs` — پارامتر `brandName`
- `<title>` در هر EJS

### برای اضافه کردن endpoint جدید به dashboard
1. `backend/src/api/<new-section>/router.ts`
2. `backend/src/controllers/<x>Controller.ts`
3. `backend/src/api/<new-section>/router.ts` — خروجی `router`
4. `frontend/views/components/dashboard-nav-items.ejs` — اضافه کردن لینک در بخش مدیریت
5. `frontend/views/dashboard/<new-section>.ejs`
6. `frontend/public/js/dashboard/<new-section>.js`
7. `frontend/public/styles/dashboard/<new-section>.css`

### برای اضافه کردن نوع کاربر جدید
1. `backend/src/models/User.ts` → `enum` نقش
2. `backend/src/utils/errorCodes.ts`
3. `backend/src/middleware/roles.ts`
4. `backend/src/services/roleService.ts`
5. `frontend/views/components/dashboard-nav-items.ejs` → conditional
6. `frontend/views/dashboard/*.ejs` → guard

---

## 📚 ۱۴. منابع خارجی

- [Mongoose Docs](https://mongoosejs.com/)
- [Express.js](https://expressjs.com/)
- [Zod](https://zod.dev/)
- [JWT Best Practices RFC 8725](https://datatracker.ietf.org/doc/html/rfc8725)
- [OWASP Auth Cheatsheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [GitHub REST API](https://docs.github.com/en/rest)

---

## ✅ ۱۵. خلاصه‌ی یک‌خطی برای AI

> **DevHub** (`manage-projects`) — پلتفرم فارسی کشف و نقد پروژه‌های متن‌باز با Node.js/Express/TypeScript + MongoDB + EJS (split: `backend/` + `frontend/`). SSR، JWT در Cookie، OTP اجباری، ریویو با امتیاز، کامنت تو در تو، تگ با کتگوری، اکسپلور با Hot Score، و داشبورد role-based (user/admin/developer). همه‌ی endpointها زیر `/api/*`، صفحات در `pages/`، routing خودکار با `loader.ts` از `api/`.

---

**آخرین به‌روزرسانی:** ۲۰۲۶
**نگه‌دارنده:** [@Sobhan-SRZA](https://github.com/Sobhan-SRZA)
**License:** BSD-3-Clause