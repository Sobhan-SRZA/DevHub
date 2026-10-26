# 📘 راهنمای جامع پروژه DevHub — برای هوش مصنوعی

> این سند به‌عنوان **منبع حقیقت (Source of Truth)** پروژه نوشته شده. هر AI یا توسعه‌دهنده‌ای که وارد پروژه می‌شه باید اول این رو کامل بخونه.

---

## 🎯 ۱. معرفی پروژه

### نام پروژه
**DevHub** (قبلاً `manage-projects`)

### شعار
> **Discover. Review. Ship.**

### هدف اصلی
پلتفرمی برای **کشف، بررسی و به اشتراک‌گذاری پروژه‌های متن‌باز** — شبیه GitHub + Product Hunt + Stack Overflow Docs، ولی با تمرکز روی:
- نمایش حرفه‌ای پروژه‌ها (گالری، ویدیو دمو، فایل دانلودی)
- دریافت **نقد و امتیاز واقعی** از کاربران (نه لایک الکی)
- کشف پروژه‌های باکیفیت از طریق الگوریتم هوشمند

### مشکلی که حل می‌کنه
1. **کشف پروژه‌های خوب سخته** — GitHub فقط ستاره نشون می‌ده، ولی اینجا **کیفیت واقعی** سنجیده می‌شه
2. **بازخورد سازنده‌ها کمه** — سیستم Review با امتیاز دقیق و رضایت
3. **دمو و دانلود یکجا نیست** — همه‌چیز توی یک صفحه

### مخاطب هدف
- **توسعه‌دهنده‌ها**: پیدا کردن پروژه‌های مشابه قبل از شروع کار جدید
- **صاحبان پروژه**: گرفتن بازخورد واقعی + دیده شدن
- **کاربران عادی**: کشف ابزارها و پروژه‌های خوب

---

## 🏗️ ۲. معماری کلی

### Tech Stack

| لایه            | تکنولوژی                                   |
| --------------- | ------------------------------------------ |
| **Backend**     | Node.js + Express + TypeScript             |
| **Database**    | MongoDB + Mongoose                         |
| **Template**    | EJS (Server-Side Rendering)                |
| **Auth**        | JWT (Access + Refresh) + Cookie-based      |
| **File Upload** | Multer                                     |
| **Markdown**    | Parser دستی (GitHub-style + HTML sanitize) |
| **Email**       | Nodemailer (SMTP یا Log mode)              |
| **Validation**  | Zod                                        |
| **Password**    | bcrypt                                     |

### ساختار کلی

```
src/
├── config/          → تنظیمات (env, db, upload, mail)
├── controllers/     → منطق درخواست/پاسخ
├── middleware/      → auth, roles, upload, error
├── models/          → Mongoose models
├── routes/          → تعریف endpointها
├── services/        → منطق کسب‌وکار (github, mail, session, ...)
├── scripts/         → seed, migration, CLI
├── utils/           → helperها
├── validators/      → Zod schemas
├── views/           → EJS templates
└── index.ts         → entry point

public/
├── js/              → کلاینت JS (صفحات + کامپوننت‌ها)
├── styles/          → CSS ماژولار
└── uploads/         → فایل‌های آپلودی (gitignored)

uploads/
├── avatars/         → عکس پروفایل
└── projects/
    ├── images/      → تصاویر پروژه
    ├── videos/      → ویدیو دمو
    └── files/       → ZIP دانلود

logs/
└── app-YYYY-MM-DD.log  → لاگ روزانه
```

---

## 👥 ۳. نقش‌ها و دسترسی‌ها

سه نقش سلسله‌مراتبی:

```
user (کاربر عادی)
  ↓
admin (ادمین)
  ↓
developer (دولوپر)
```

| عمل                     | user  | admin | developer |
| ----------------------- | :---: | :---: | :-------: |
| ثبت‌نام + تایید ایمیل    |   ✅   |   ✅   |     ✅     |
| ساخت پروژه              |   ✅   |   ✅   |     ✅     |
| ساخت تگ                 |   ✅   |   ✅   |     ✅     |
| **درخواست** کتگوری جدید |   ✅   |   ✅   |     ✅     |
| **تایید** کتگوری        |   ❌   |   ✅   |     ✅     |
| ویرایش/حذف کتگوری       |   ❌   |   ✅   |     ✅     |
| تایید تگ‌های دیگران      |   ❌   |   ✅   |     ✅     |
| مدیریت کاربران          |   ❌   |   ✅   |     ✅     |
| تغییر نقش user ↔ admin  |   ❌   |   ✅   |     ✅     |
| تغییر نقش → developer   |   ❌   |   ❌   |     ✅     |
| بن/آنبن کاربران         |   ❌   |   ✅   |     ✅     |
| وضعیت سیستم + لاگ‌ها     |   ❌   |   ❌   |     ✅     |

### اولین کاربر
- **اولین** کسی که ثبت‌نام می‌کنه → خودکار `developer` می‌شه
- یا از `DEVELOPER_EMAIL` در `.env` استفاده می‌شه
- یا با CLI: `npm run promote <email> developer`

---

## 🎨 ۴. قابلیت‌های اصلی (Feature List)

### ✅ پیاده‌شده

#### احراز هویت
- [x] ثبت‌نام با تایید ایمیل اجباری (کد ۶ رقمی)
- [x] ورود با **ایمیل یا نام کاربری**
- [x] تغییر رمز با تایید OTP
- [x] تغییر ایمیل (دو مرحله‌ای: تایید ایمیل قبلی + جدید)
- [x] فراموشی رمز با کد OTP
- [x] مدیریت سشن‌ها (لیست دستگاه‌ها، revoke)
- [x] ورود امن (HttpOnly cookies، refresh rotation)

#### پروژه‌ها
- [x] ساخت/ویرایش/حذف پروژه
- [x] آپلود گالری (۱۰ تصویر)
- [x] آپلود ویدیو دمو
- [x] آپلود فایل ZIP با نسخه
- [x] اتصال به GitHub (auto-sync ستاره، فورک، دانلود)
- [x] شرح Markdown + HTML (sanitize شده)
- [x] تگ‌گذاری با کتگوری
- [x] وضعیت: draft / published / archived

#### ریویو
- [x] امتیاز (0-5) + رضایت (0-100)
- [x] یک ریویو per user per project
- [x] ویرایش ریویو
- [x] نمایش میانگین + توزیع
- [x] صاحب پروژه نمی‌تونه به خودش ریویو بده

#### کامنت
- [x] کامنت تو در تو (تا ۵ سطح)
- [x] Like/Unlike
- [x] Soft delete (پاسخ‌ها حفظ می‌شن)
- [x] فقط لاگین‌شده‌ها می‌تونن کامنت بذارن

#### تگ‌ها
- [x] کتگوری‌های از پیش تعریف‌شده (seed)
- [x] ساخت تگ (کاربر عادی → approved خودکار، مثل GitHub)
- [x] درخواست کتگوری جدید (pending → admin approve)
- [x] تگ بدون کتگوری → fallback به «عمومی»

#### اکسپلور
- [x] الگوریتم Hot Score (Hacker News style)
- [x] Sort: trending, hot, top-rated, top-downloaded, new
- [x] فیلتر بر اساس کتگوری + جستجو
- [x] Cache 5 دقیقه‌ای

#### داشبورد
- [x] Sidebar با collapse (Ctrl+B)
- [x] Role-based nav (فقط بخش‌های مجاز)
- [x] Stats بر اساس نقش
- [x] Breadcrumb تعاملی با dropdown منو
- [x] سیستم لاگ + وضعیت سرور (دولوپر)

### 🔜 پیشنهادی (Next)

- [ ] Follow/Unfollow کاربران
- [ ] Notification system
- [ ] Activity feed
- [ ] Search پیشرفته با Elasticsearch
- [ ] Rate limiting روی login/register
- [ ] 2FA با TOTP
- [ ] API versioning (`/api/v1/...`)
- [ ] GraphQL endpoint
- [ ] WebSocket برای کامنت‌های زنده
- [ ] Dashboard analytics (chart)

---

## 🗄️ ۵. مدل‌های داده (Mongoose)

### User
```typescript
{
  name: string;
  username: string;         // case حساس
  usernameLower: string;    // lowercase برای یکتایی
  email: string;            // lowercase
  emailVerified: boolean;
  emailVerifiedAt: Date | null;
  password: string;         // bcrypt hash (select: false)

  bio: string;              // Markdown
  avatar: { url, filename, mimeType, size, uploadedAt } | null;

  role: 'user' | 'admin' | 'developer';

  pendingEmail: {
    newEmail: string;
    previousEmail: string;
    oldVerified: boolean;
    expiresAt: Date;
    requestedAt: Date;
  } | null;

  isBanned: boolean;
  roleChangedBy: ObjectId | null;
  roleChangedAt: Date | null;
  roleChangeReason: string | null;

  createdAt: Date;
  updatedAt: Date;
}
```

### Project
```typescript
{
  owner: ObjectId;          // User
  title: string;
  slug: string;             // unique
  githubUrl: string | null;
  githubRepo: string | null;  // "owner/repo"
  githubData: {
    stars, forks, watchers, openIssues, downloads,
    language, license, topics, ...
  };
  githubSyncedAt: Date | null;
  autoSync: boolean;

  shortDescription: string;    // max 300
  fullDescription: string;     // Markdown, max 20000

  images: Array<{
    url, filename, mimeType, size, order, uploadedAt;
  }>;

  demoVideo: {
    url, filename, mimeType, size, uploadedAt;
  } | null;

  downloadFile: {
    url, filename, mimeType, size, version, downloads, uploadedAt;
  } | null;

  rating: number;              // میانگین (auto-updated)
  satisfaction: number;        // میانگین (auto-updated)
  reviewCount: number;
  downloads: number;
  views: number;

  tags: ObjectId[];

  status: 'draft' | 'published' | 'archived';
  isPublic: boolean;
  featured: boolean;           // برای پروژه‌های ویژه
  featuredOrder: number;

  createdAt: Date;
  updatedAt: Date;
}
```

### Tag
```typescript
{
  name: string;
  slug: string;
  type: ObjectId;             // TagType (الزامی)
  color: string;
  description?: string;
  isSystem: boolean;          // تگ‌های seed‌شده
  isApproved: boolean;
  createdBy: ObjectId | null;
  usageCount: number;
  createdAt: Date;
  updatedAt: Date;
}
// unique index: { slug, type }
```

### TagType (کتگوری)
```typescript
{
  name: string;
  slug: string;               // unique
  description?: string;
  color: string;
  icon?: string;              // emoji
  isSystem: boolean;
  isApproved: boolean;
  allowUserTags: boolean;     // کاربر می‌تونه تگ جدید اضافه کنه؟
  maxTags?: number;
  order: number;
  createdBy: ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}
```

### Review
```typescript
{
  project: ObjectId;
  user: ObjectId;
  rating: number;             // 0-5
  satisfaction: number;       // 0-100
  title?: string;
  body?: string;
  isEdited: boolean;
  editedAt?: Date;
  helpfulCount: number;
  createdAt: Date;
  updatedAt: Date;
}
// unique index: { project, user }
```

### Comment
```typescript
{
  project: ObjectId;
  user: ObjectId;
  body: string;
  parent: ObjectId | null;     // برای تو در تو
  depth: number;               // 0-5
  isEdited: boolean;
  editedAt?: Date;
  isDeleted: boolean;
  deletedAt?: Date;
  replyCount: number;
  likes: ObjectId[];           // userهای لایک‌کننده
  createdAt: Date;
  updatedAt: Date;
}
```

### Session
```typescript
{
  user: ObjectId;
  sessionId: string;           // در JWT به‌عنوان sid
  token: string;               // access token
  refreshToken: string;

  device: {                    // از User-Agent پارس شده
    userAgent, deviceType, deviceVendor, deviceModel,
    os, osVersion, browser, browserVersion, engine, isBot
  };

  location: {                  // از IP گرفته شده
    ip, ipVersion, country, countryCode,
    region, city, latitude, longitude, timezone, isp
  };

  loginAt: Date;
  lastActiveAt: Date;
  expiresAt: Date;             // TTL index
  createdAt: Date;
  updatedAt: Date;
}
```

### VerificationCode
```typescript
{
  user: ObjectId;
  purpose: 'verify_email' | 'change_password' | 'change_email_old'
         | 'change_email_new' | 'login_2fa' | 'reset_password';
  codeHash: string;            // sha256(code + salt)
  salt: string;
  targetEmail?: string | null;
  attempts: number;
  maxAttempts: number;
  expiresAt: Date;             // TTL index (60s بعد از انقضا حذف)
  consumedAt: Date | null;
  requestedAt: Date;
  ip?: string;
  userAgent?: string;
  createdAt: Date;
  updatedAt: Date;
}
```

---

## 🔌 ۶. API Endpoints

### Auth — `/api/auth`
| Method | Path                          |  Auth  | توضیح                      |
| ------ | ----------------------------- | :----: | -------------------------- |
| POST   | `/register`                   |   —    | ثبت‌نام + ارسال OTP ایمیل   |
| POST   | `/verify-email`               |   —    | تایید ایمیل + صدور session |
| POST   | `/resend-verification`        |   —    | ارسال مجدد OTP             |
| POST   | `/resend-verification-for-me` |   ✅    | برای کاربر لاگین‌شده        |
| POST   | `/login`                      |   —    | ایمیل یا username          |
| POST   | `/refresh`                    | cookie | چرخش access token          |
| POST   | `/logout`                     | cookie | خروج از سشن فعلی           |
| POST   | `/logout-all`                 |   ✅    | خروج از همه سشن‌ها          |
| POST   | `/forgot-password`            |   —    | ارسال OTP                  |
| POST   | `/reset-password`             |   —    | تایید OTP + رمز جدید       |
| POST   | `/resend-password-reset`      |   —    | ارسال مجدد OTP             |
| GET    | `/me`                         |   ✅    | کاربر فعلی                 |
| GET    | `/sessions`                   |   ✅    | لیست سشن‌ها                 |
| DELETE | `/sessions/:id`               |   ✅    | revoke یک سشن              |

### Profile — `/api/profile` (همه ✅)
| Method | Path                | توضیح                                            |
| ------ | ------------------- | ------------------------------------------------ |
| GET    | `/me`               | اطلاعات کامل                                     |
| PATCH  | `/me`               | نام + بیو                                        |
| PATCH  | `/username`         | تغییر username                                   |
| POST   | `/avatar`           | آپلود آواتار (multipart)                         |
| DELETE | `/avatar`           | حذف آواتار                                       |
| POST   | `/email/request`    | شروع تغییر ایمیل                                 |
| POST   | `/email/verify-old` | تایید ایمیل قبلی → ایمیل عوض می‌شه ولی unverified |
| DELETE | `/email/pending`    | لغو + rollback                                   |
| POST   | `/password/request` | شروع تغییر رمز                                   |
| POST   | `/password/confirm` | تایید OTP + رمز جدید                             |

### Projects — `/api/projects`
| Method | Path                  |  Auth   | توضیح                             |
| ------ | --------------------- | :-----: | --------------------------------- |
| GET    | `/`                   | اختیاری | لیست (با mine, search, sort, ...) |
| GET    | `/explore`            |    —    | لیست اکسپلور با sort              |
| GET    | `/home-feed`          |    —    | فید صفحه اصلی (cache)             |
| GET    | `/:idOrSlug`          | اختیاری | یک پروژه                          |
| POST   | `/`                   |    ✅    | ساخت (نیاز به emailVerified)      |
| PUT    | `/:id`                |    ✅    | ویرایش (owner)                    |
| DELETE | `/:id`                |    ✅    | حذف (owner)                       |
| POST   | `/:id/sync-github`    |    ✅    | سینک دستی                         |
| PATCH  | `/:id/status`         |    ✅    | تغییر وضعیت                       |
| POST   | `/:id/images`         |    ✅    | آپلود تصاویر                      |
| DELETE | `/:id/images/:imgId`  |    ✅    | حذف تصویر                         |
| PATCH  | `/:id/images/order`   |    ✅    | تغییر ترتیب                       |
| POST   | `/:id/video`          |    ✅    | آپلود ویدیو                       |
| DELETE | `/:id/video`          |    ✅    | حذف ویدیو                         |
| POST   | `/:id/file`           |    ✅    | آپلود ZIP                         |
| DELETE | `/:id/file`           |    ✅    | حذف ZIP                           |
| GET    | `/:idOrSlug/download` | اختیاری | دانلود + شمارش                    |

### Reviews — `/api/projects/:idOrSlug/reviews`
| Method | Path           |          Auth           |
| ------ | -------------- | :---------------------: |
| GET    | `/`            | اختیاری (شامل myReview) |
| GET    | `/me`          |            ✅            |
| POST   | `/`            |            ✅            |
| PUT    | `/`            |            ✅            |
| DELETE | `/`            |            ✅            |
| POST   | `/:id/helpful` |            ✅            |

### Comments — `/api/projects/:idOrSlug/comments`
| Method | Path        |                Auth                 |
| ------ | ----------- | :---------------------------------: |
| GET    | `/`         | اختیاری (با `parentId` برای پاسخ‌ها) |
| POST   | `/`         |                  ✅                  |
| PUT    | `/:id`      |                  ✅                  |
| DELETE | `/:id`      |                  ✅                  |
| POST   | `/:id/like` |                  ✅                  |

### Tags — `/api/tags`
| Method | Path              |     Auth     |
| ------ | ----------------- | :----------: |
| GET    | `/`               |      —       |
| GET    | `/suggest`        |      —       |
| GET    | `/pending`        |    admin     |
| GET    | `/:id`            |      —       |
| POST   | `/find-or-create` | ✅ (پیشنهادی) |
| POST   | `/`               |      ✅       |
| PUT    | `/:id`            | owner/admin  |
| DELETE | `/:id`            | owner/admin  |
| POST   | `/:id/approve`    |    admin     |

### Tag Types — `/api/tag-types`
| Method | Path           |    Auth     |
| ------ | -------------- | :---------: |
| GET    | `/`            |      —      |
| GET    | `/:id`         |      —      |
| POST   | `/request`     | ✅ (pending) |
| POST   | `/`            |    admin    |
| PUT    | `/:id`         |    admin    |
| DELETE | `/:id`         |    admin    |
| POST   | `/:id/approve` |    admin    |

### Users (Public) — `/api/users`
| Method | Path                      | توضیح                             |
| ------ | ------------------------- | --------------------------------- |
| GET    | `/:idOrUsername`          | پروفایل + stats                   |
| GET    | `/:idOrUsername/projects` | پروژه‌های عمومی                    |
| GET    | `/:idOrUsername/reviews`  | **ریویوهای دریافتی** روی پروژه‌هاش |

### Admin — `/api/admin` (admin+)
| Method | Path              |
| ------ | ----------------- |
| GET    | `/users`          |
| POST   | `/users/:id/role` |
| POST   | `/users/:id/ban`  |

### System — `/api/system` (developer)
| Method | Path                   |
| ------ | ---------------------- |
| GET    | `/stats`               |
| GET    | `/logs`                |
| GET    | `/logs/download`       |
| POST   | `/logs/clear`          |
| GET    | `/api/health` (public) |

---

## 🎨 ۷. ساختار Frontend

### EJS Pages

| Route                         | Template                   |    Auth    |
| ----------------------------- | -------------------------- | :--------: |
| `/`                           | `home.ejs`                 |     —      |
| `/explore`                    | `explore.ejs`              |     —      |
| `/projects`                   | `projects/list.ejs`        |     —      |
| `/projects/:idOrSlug`         | `projects/show.ejs`        |     —      |
| `/users/:idOrUsername`        | `users/show.ejs`           |     —      |
| `/auth/login`                 | `auth/login.ejs`           | guest only |
| `/auth/register`              | `auth/register.ejs`        | guest only |
| `/auth/verify-email`          | `auth/verify-email.ejs`    |     —      |
| `/auth/forgot-password`       | `auth/forgot-password.ejs` | guest only |
| `/auth/reset-password`        | `auth/reset-password.ejs`  |     —      |
| `/dashboard`                  | `dashboard/home.ejs`       |     ✅      |
| `/dashboard/projects`         | `dashboard/projects.ejs`   |     ✅      |
| `/dashboard/profile`          | `dashboard/profile.ejs`    |     ✅      |
| `/dashboard/profile/settings` | `dashboard/settings.ejs`   |     ✅      |
| `/dashboard/tags`             | `dashboard/tags.ejs`       |   admin+   |
| `/dashboard/tag-types`        | `dashboard/tag-types.ejs`  |   admin+   |
| `/dashboard/users`            | `dashboard/users.ejs`      |   admin+   |
| `/dashboard/system`           | `dashboard/system.ejs`     | developer  |
| `/dashboard/logs`             | `dashboard/logs.ejs`       | developer  |

### Components (`views/components/`)

| فایل                      | کار                                                        |
| ------------------------- | ---------------------------------------------------------- |
| `header.ejs`              | هدر یکپارچه سایت (nav + search + notif + profile + drawer) |
| `brand.ejs`               | لوگوی SVG قابل‌تنظیم                                        |
| `search-modal.ejs`        | مودال جستجو (Ctrl+K)                                       |
| `mobile-drawer.ejs`       | Drawer موبایل + داشبورد section                            |
| `dialogError.ejs`         | دیالوگ خطا + confirm + toast                               |
| `dashboard-nav.ejs`       | سایدبار داشبورد (دسکتاپ)                                   |
| `dashboard-nav-items.ejs` | آیتم‌های داشبورد (ماژولار: sidebar/drawer/menu)             |
| `dash-breadcrumb.ejs`     | Breadcrumb تعاملی با dropdown                              |

### CSS (`public/styles/`)

| فایل                          | مسئولیت                                     |
| ----------------------------- | ------------------------------------------- |
| `index.css`                   | Base + reset + shared (user-chip, btn, ...) |
| `header.css`                  | هدر + drawer + search modal + profile menu  |
| `dialog.css`                  | دیالوگ + toast + confirm                    |
| `form-errors.css`             | خطاهای inline فیلدها                        |
| `auth.css`                    | فرم‌های login/register                       |
| `markdown-editor.css`         | ویرایشگر Markdown + preview                 |
| `explore.css`                 | صفحه اکسپلور + کارت پروژه + hero            |
| `projects/show.css`           | صفحه جزئیات پروژه                           |
| `users/show.css`              | پروفایل عمومی                               |
| `dashboard/dashboard.css`     | Layout + card + breadcrumb                  |
| `dashboard/dashboard-nav.css` | سایدبار + collapse                          |
| `dashboard/home.css`          | صفحه home داشبورد                           |
| `dashboard/settings.css`      | تنظیمات                                     |
| `dashboard/system.css`        | وضعیت سیستم                                 |
| `dashboard/logs.css`          | لاگ‌ها                                       |
| `dashboard/tag-types.css`     | کتگوری‌ها                                    |
| `dashboard/users.css`         | جدول کاربران                                |
| `tag-picker.css`              | TagPicker component                         |

### JavaScript (`public/js/`)

| فایل                            | کار                                     |
| ------------------------------- | --------------------------------------- |
| `form-errors.js`                | `FormKit` — مدیریت خطای فرم (global)    |
| `components/user-chip.js`       | helper برای نمایش کاربر با لینک         |
| `components/markdown-editor.js` | کلاس `MarkdownEditor`                   |
| `components/tag-picker.js`      | کلاس `TagPicker`                        |
| `header.js`                     | منطق هدر (auth state, search, drawer)   |
| `auth/login.js`                 | فرم لاگین                               |
| `auth/register.js`              | فرم ثبت‌نام                              |
| `auth/verify-email.js`          | تایید ایمیل                             |
| `auth/forgot-password.js`       | فراموشی رمز                             |
| `auth/reset-password.js`        | بازیابی رمز                             |
| `pages/home.js`                 | صفحه اصلی                               |
| `pages/explore.js`              | صفحه اکسپلور                            |
| `pages/users-show.js`           | پروفایل عمومی                           |
| `projects/list.js`              | لیست پروژه‌ها                            |
| `projects/show.js`              | جزئیات پروژه                            |
| `dashboard/home.js`             | داشبورد                                 |
| `dashboard/projects.js`         | CRUD پروژه‌ها                            |
| `dashboard/settings.js`         | تنظیمات پروفایل                         |
| `dashboard/tags.js`             | مدیریت تگ‌ها                             |
| `dashboard/tag-types.js`        | مدیریت کتگوری‌ها                         |
| `dashboard/system.js`           | وضعیت سیستم                             |
| `dashboard/logs.js`             | لاگ‌ها                                   |
| `dashboard/profile.js`          | پروفایل کاربر                           |
| `dashboard-nav.js`              | collapse + active + breadcrumb dropdown |

---

## 🔐 ۸. احراز هویت و امنیت

### جریان ثبت‌نام
```
1. POST /api/auth/register
   → user ساخته می‌شه (emailVerified: false)
   → OTP ارسال می‌شه
   → { requiresVerification: true, verifyToken, email }
   → NO session issued

2. User redirects to /auth/verify-email
   → وارد کردن کد

3. POST /api/auth/verify-email { verifyToken, code }
   → verify OTP
   → emailVerified = true
   → session صادر می‌شه ✅
```

### جریان تغییر ایمیل (دو مرحله‌ای)
```
1. POST /api/profile/email/request { newEmail, password }
   → OTP به ایمیل **قبلی** ارسال می‌شه
   → pendingEmail = { newEmail, previousEmail, oldVerified: false }

2. POST /api/profile/email/verify-old { code }
   → verify OTP
   → user.email = newEmail
   → user.emailVerified = false
   → OTP به ایمیل **جدید** ارسال می‌شه
   → pendingEmail.oldVerified = true

3. Redirect to /auth/verify-email
   → تایید → emailVerified = true
```

### لایه‌های امنیتی

| مورد                 | پیاده‌سازی                                 |
| -------------------- | ----------------------------------------- |
| **Password**         | bcrypt (12 rounds)                        |
| **JWT**              | access 15min، refresh 30d، `typ` مشخص     |
| **Cookies**          | HttpOnly + Secure (prod) + SameSite=lax   |
| **Refresh Rotation** | هر refresh → access جدید                  |
| **Session Revoke**   | بعد از تغییر رمز، همه sessionها بسته می‌شن |
| **OTP**              | SHA-256 + salt، ۵ تلاش، cooldown 60s      |
| **Rate Limit**       | روی ارسال ایمیل (per recipient)           |
| **Path Traversal**   | `path.basename` + regex در دانلود         |
| **HTML Sanitize**    | Markdown parser خودش strip می‌کنه          |
| **Anti-enumeration** | پیام یکسان برای ایمیل/کاربر موجود یا نه   |
| **CSRF**             | SameSite=LAX + JSON فقط (بدون form)       |
| **XSS**              | همه‌ی ورودی‌ها escape/parse می‌شن            |

### Env Variables (`.env.example`)

```env
# Server
PORT=3000
NODE_ENV=development

# Database
MONGODB_URI=mongodb://localhost:27017/devhub

# JWT
JWT_SECRET=your-super-secret-key-min-32-chars
JWT_EXPIRES_IN=7d

# Mail (log = فقط چاپ کنسول، smtp = ارسال واقعی)
MAIL_MODE=log
MAIL_FROM_NAME="DevHub"
MAIL_FROM_ADDRESS=noreply@devhub.local
# SMTP_HOST=smtp.gmail.com
# SMTP_PORT=587
# SMTP_USER=your-email@gmail.com
# SMTP_PASS=your-app-password

# Bootstrap
DEVELOPER_EMAIL=your-email@example.com

# GitHub (اختیاری - برای نرخ بالاتر API)
# GITHUB_TOKEN=ghp_xxx

# Upload
MAX_IMAGE_SIZE_MB=5
MAX_VIDEO_SIZE_MB=200
MAX_FILE_SIZE_MB=500
```

---

## 🧩 ۹. الگوهای کدنویسی

### Controller Pattern
```typescript
export const actionName = asyncHandler(async (req: any, res: Response) => {
    // 1. Validate
    const data = validate(someSchema, req.body);

    // 2. Auth check (اگر middleware نکرده)
    if (!req.user) throw Unauthorized(ErrorCodes.UNAUTHENTICATED);

    // 3. Business logic
    const result = await SomeService.doSomething(data);

    // 4. Response
    res.json({ ok: true, ...result });
});
```

### AppError Factory
```typescript
// خطاهای نوع‌دار
throw new AppError(400, ErrorCodes.VALIDATION_ERROR, 'پیام', { field: 'email' });
throw Conflict(ErrorCodes.EMAIL_TAKEN);   // 409
throw Unauthorized(ErrorCodes.INVALID_CREDENTIALS);   // 401
throw Forbidden(ErrorCodes.PROJECT_NOT_OWNED);   // 403
throw NotFound(ErrorCodes.PROJECT_NOT_FOUND);   // 404
```

### Response Shape (یکسان)
```json
// موفق
{ "ok": true, "message": "...", "data": {...} }

// خطا
{
  "ok": false,
  "code": "ERROR_CODE",
  "message": "پیام فارسی",
  "field": "username",           // اختیاری
  "details": { "field": ["msg"] } // اختیاری
}
```

### Frontend Fetch (کلاینت)
```javascript
// استفاده از FormKit.postJSON
const data = await FormKit.postJSON('/api/projects', { title: 'X' });
```

### Form Handling (کلاینت)
```javascript
FormKit.attach('#myForm', {
    validate(v) { /* return { field: 'error' } */ },
    submit(v) { /* throw if error */ },
    onSuccess(data) { /* redirect یا toast */ },
});
```

### Form errors در فرانت
- `FormKit.showFieldError(input, msg)` → shake + زیر فیلد
- `FormKit.showFormBanner(form, msg)` → بالا
- `openDialogError(title, msg)` → دیالوگ
- `confirmDialog({...})` → Promise<boolean>
- `toast(msg, 'success'|'error'|'info')` → گوشه

---

## 📋 ۱۰. Seed & Init

### اسکریپت‌های راه‌اندازی

```bash
npm run migrate              # prisma migrate (اگه داری) یا seed
npm run seed:tags            # کتگوری‌ها + تگ‌های پیش‌فرض
npm run promote <email> <role>   # ارتقای نقش از CLI
npm run setup:first-admin    # اولین developer
```

### کتگوری‌های پیش‌فرض (seed)

| slug                   | name             | icon  | allowUserTags |
| ---------------------- | ---------------- | :---: | :-----------: |
| `programming-language` | زبان برنامه‌نویسی |   💻   |  ❌ (سیستمی)   |
| `framework`            | فریمورک          |   🧩   |       ✅       |
| `database`             | دیتابیس          |   🗄️   |       ✅       |
| `seo`                  | سئو              |   🔍   |       ✅       |
| `devops`               | دواپس            |   ⚙️   |       ✅       |
| `ai`                   | هوش مصنوعی       |   🤖   |       ✅       |
| `mobile`               | موبایل           |   📱   |       ✅       |
| `security`             | امنیت            |   🛡️   |       ✅       |
| `design`               | دیزاین           |   🎨   |       ✅       |
| `general`              | عمومی            |   🌐   | ✅ (fallback)  |

هر کتگوری دارای تگ‌های seed‌شده است (JS، Python، React، MongoDB، ...).

---

## 🚀 ۱۱. اجرا و توسعه

### نصب
```bash
git clone <repo>
cd devhub
npm install
cp .env.example .env
# تنظیم MONGODB_URI و JWT_SECRET
```

### اجرا
```bash
# Development
npm run dev

# Production
npm run build
npm start
```

### ساختار دیباگ

```javascript
// لاگ‌ها
🔴 [UNHANDLED ERROR]
🟨 [FormKit] ...
🟦 [FormKit] ...
📧 [VERIFICATION CODE]
🔐 [ROLE CHANGE]
🔒 [PASSWORD CHANGED]
🔄 [EMAIL CHANGED]
✅ [EMAIL VERIFIED]
```

---

## 🎯 ۱۲. راهنمای AI برای توسعه

### وقتی یه قابلیت جدید می‌خوای اضافه کنی:

1. **Model** → `src/models/` (interface + schema + methods + indexes)
2. **Validator** → `src/validators/` (Zod)
3. **Error codes** → `src/utils/errorCodes.ts`
4. **Service** (اگه منطق پیچیده) → `src/services/`
5. **Controller** → `src/controllers/` (استفاده از `asyncHandler` + `validate` + `AppError`)
6. **Route** → `src/routes/` (با guard مناسب: `requireAuth`, `requireAdmin`, `requireDeveloper`)
7. **Page route** → `src/app.ts` (با `pageAuth` + `pageAdminGuard`)
8. **EJS** → `src/views/...`
9. **CSS** → `public/styles/...` (ماژولار)
10. **JS** → `public/js/...` (اگه نیاز به interactivity)
11. **Test** → manual + optional: jest

### قواعد طلایی

- ✅ **همیشه** `asyncHandler` در controller
- ✅ **همیشه** `validate` با Zod روی `req.body`
- ✅ **همیشه** `AppError` نه `throw new Error`
- ✅ **همیشه** `ok: true/false` در response
- ✅ **همیشه** `escapeHtml` قبل از `innerHTML`
- ✅ **همیشه** `credentials: 'include'` در fetch
- ❌ **هرگز** secret رو در client
- ❌ **هرگز** raw HTML بدون sanitize
- ❌ **هرگز** خطای DB رو مستقیم به کاربر نشون بده

### معیارهای «قابل قبول» برای کد جدید

- [ ] TypeScript بدون `any` بی‌دلیل
- [ ] Validation سمت سرور (client فقط UX)
- [ ] Error handling کامل
- [ ] Authorization (نه فقط Authentication)
- [ ] Responsive (دسکتاپ + موبایل)
- [ ] RTL و فارسی درست
- [ ] Component ماژولار (اگه تکرار می‌شه)
- [ ] لاگ مناسب (بدون اطلاعات حساس)
- [ ] بدون breaking change در API موجود

---

## 📊 ۱۳. آمار پروژه (تا این لحظه)

| مورد                | تعداد                                                                       |
| ------------------- | --------------------------------------------------------------------------- |
| **فایل TypeScript** | ~50                                                                         |
| **Controller**      | 8 (auth, profile, project, review, comment, tag, user, system)              |
| **Model**           | 7 (User, Project, Tag, TagType, Review, Comment, Session, VerificationCode) |
| **Service**         | 6 (github, session, verification, file, cache, explore, mail, role)         |
| **EJS Page**        | ~20                                                                         |
| **EJS Component**   | 8                                                                           |
| **CSS File**        | ~18                                                                         |
| **JS File**         | ~25                                                                         |
| **API Endpoint**    | ~70                                                                         |
| **نقش‌ها**           | 3 (user, admin, developer)                                                  |
| **زبان**            | فارسی (UI) + انگلیسی (کد)                                                   |

---

## 🎓 ۱۴. فلسفه‌ی طراحی

### چرا این تصمیم‌ها؟

| تصمیم                           | دلیل                                                         |
| ------------------------------- | ------------------------------------------------------------ |
| **SSR با EJS**                  | ساده، SEO-friendly، برای scale کوچیک-متوسط بهتر از React SPA |
| **JWT در Cookie**               | امن‌تر از localStorage + کار با SSR                           |
| **تایید ایمیل اجباری**          | جلوگیری از spam و fake accounts                              |
| **تگ‌های از پیش تعریف‌شده**       | جلوگیری از tag soup (مثل ۵۰ تگ مشابه)                        |
| **Hot Score با Decay**          | پروژه‌های جدید هم شانس دیده شدن دارن                          |
| **دو مرحله تغییر ایمیل**        | جلوگیری از قفل شدن اکانت اگه ایمیل اشتباه وارد شد            |
| **Soft delete کامنت**           | حفظ thread حتی بعد از حذف                                    |
| **ماژولار dashboard-nav-items** | یک منبع برای سایدبار + drawer + breadcrumb                   |
| **Breadcrumb + Dropdown**       | دسترسی سریع به هر بخش داشبورد از هر صفحه                     |
| **Role سلسله‌مراتبی**            | ساده‌تر از permission-based، برای MVP کافیه                   |

---

## 🔮 ۱۵. نقشه راه آینده

### کوتاه‌مدت (v1.1)
- [ ] Follow/Unfollow
- [ ] Notification system (bell + inbox)
- [ ] Activity feed در پروفایل
- [ ] Rate limiting روی `/auth/*`

### میان‌مدت (v1.2)
- [ ] Search پیشرفته (Elasticsearch یا Mongo Full-Text)
- [ ] Comments live update (SSE)
- [ ] User settings: preferences, theme
- [ ] Admin panel UI برای مدیریت نقش‌ها

### بلندمدت (v2.0)
- [ ] API versioning + Public REST API
- [ ] 2FA با TOTP
- [ ] Mobile app (React Native)
- [ ] GraphQL endpoint
- [ ] Webhooks برای پروژه‌ها
- [ ] CI/CD integrations (خودکار از GitHub Actions)

---

## 📚 ۱۶. منابع خارجی

- [Mongoose Docs](https://mongoosejs.com/)
- [Express.js](https://expressjs.com/)
- [Zod](https://zod.dev/)
- [bcrypt](https://www.npmjs.com/package/bcrypt)
- [JWT Best Practices](https://datatracker.ietf.org/doc/html/rfc8725)
- [OWASP Auth Cheatsheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [GitHub REST API](https://docs.github.com/en/rest)

---

## ✅ ۱۷. خلاصه‌ی یک‌خطی برای AI

> **DevHub** یه پلتفرم فارسی برای کشف و نقد پروژه‌های متن‌بازه — با Node.js/Express/TypeScript/MongoDB، SSR با EJS، احراز هویت دو مرحله‌ای، سیستم ریویو با امتیاز، کامنت تو در تو، تگ‌گذاری با کتگوری، و داشبورد role-based. هدف: جایگزین بهتر از GitHub برای **کشف کیفیت** نه فقط ستاره.

---

## 🎯 چک‌لیست برای AI جدیدی که وارد می‌شه

- [ ] این سند رو کامل خوندم
- [ ] `.env` رو تنظیم کردم
- [ ] `npm run dev` رو اجرا کردم
- [ ] صفحات زیر رو دیدم: `/`, `/explore`, `/projects/:id`, `/users/:username`, `/dashboard`
- [ ] یکی از flowها رو تست کردم: register → verify → login
- [ ] `errorCodes.ts`, `AppError.ts`, `authController.ts` رو خوندم
- [ ] `dashboard-nav-items.ejs` رو فهمیدم
- [ ] آماده‌ام برای توسعه ✅