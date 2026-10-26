<div align="center">

<img src="./public/assets/logo.svg" alt="DevHub Logo" width="80" height="80" />

# DevHub

**Discover. Review. Ship.**

پلتفرمی برای کشف، نقد و اشتراک‌گذاری پروژه‌های متن‌باز

[![License: BSD-3-Clause](https://img.shields.io/badge/License-BSD%203--Clause-blue.svg)](https://opensource.org/licenses/BSD-3-Clause)
[![Node.js](https://img.shields.io/badge/Node.js-20%2B-green)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5%2B-blue)](https://www.typescriptlang.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-7%2B-success)](https://www.mongodb.com/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](./CONTRIBUTING.md)

[معرفی](#-معرفی) • [امکانات](#-امکانات) • [نصب](#-نصب-و-راه‌اندازی) • [ساختار](#-ساختار-پروژه) • [API](#-api) • [امنیت](#-امنیت) • [نقش‌ها](#-نقش‌ها-و-دسترسی‌ها)

</div>

---

## 🎯 معرفی

**DevHub** یک پلتفرم متن‌باز برای **کشف، بررسی و به اشتراک‌گذاری پروژه‌های برنامه‌نویسی** است — ترکیبی از GitHub + Product Hunt + Stack Overflow، ولی با تمرکز روی **کیفیت واقعی** به‌جای فقط تعداد ستاره.

### مشکل چیست؟

- **کشف پروژه‌های خوب سخته** — GitHub فقط ستاره نشون می‌ده، ولی اینجا امتیاز و رضایت واقعی از کاربران سنجیده می‌شه
- **بازخورد سازنده‌ها کمه** — سیستم ریویو با امتیاز دقیق، رضایت درصدی، و نظر مفصل
- **دمو، دانلود و مستندات یکجا نیست** — همه‌چیز توی یه صفحه

### برای کیست؟

- 👨‍💻 **توسعه‌دهنده‌ها** — پیدا کردن پروژه‌های مشابه قبل از شروع کار جدید
- 🚀 **صاحبان پروژه** — گرفتن بازخورد واقعی و دیده شدن
- 🔍 **کاوشگرها** — کشف ابزارها و پروژه‌های خوب

---

## ✨ امکانات

### 🔐 احراز هویت
- ثبت‌نام با **تایید ایمیل اجباری** (کد OTP ۶ رقمی)
- ورود با **ایمیل یا نام کاربری**
- تغییر رمز با تایید OTP
- **تغییر ایمیل دو مرحله‌ای** (تایید ایمیل قبلی + جدید)
- فراموشی رمز با کد OTP
- مدیریت سشن‌ها (لیست دستگاه‌ها + revoke)

### 📦 پروژه‌ها
- ساخت/ویرایش/حذف پروژه
- گالری تا ۱۰ تصویر + ویدیو دمو + فایل ZIP
- **سینک خودکار با GitHub** (ستاره، فورک، دانلود، زبان، مجوز)
- شرح **Markdown + HTML** (sanitize شده)
- تگ‌گذاری با کتگوری‌های از پیش تعریف‌شده
- وضعیت: `draft` / `published` / `archived`

### ⭐ ریویو
- امتیاز (۰-۵) + رضایت (۰-۱۰۰)
- **یک ریویو** per user per project (قابل ویرایش)
- نمایش میانگین + توزیع ستاره‌ها
- صاحب پروژه نمی‌تونه به خودش ریویو بده

### 💬 کامنت
- تو در تو تا **۵ سطح**
- Like / Unlike
- **Soft delete** (پاسخ‌ها حفظ می‌شن)
- فقط لاگین‌شده‌ها می‌تونن نظر بدن

### 🏷️ تگ و کتگوری
- ۱۰ کتگوری پیش‌فرض (JS, React, MongoDB, SEO, AI, ...)
- ساخت تگ توسط کاربر → **approved خودکار** (مثل GitHub)
- درخواست کتگوری جدید → **در انتظار تایید ادمین**
- تگ بدون کتگوری → fallback به «عمومی»

### 🔥 اکسپلور
- الگوریتم **Hot Score** (Hacker News-style با decay)
- Sort: `trending` / `hot` / `top-rated` / `top-downloaded` / `new`
- فیلتر بر اساس کتگوری + جستجو
- Cache ۵ دقیقه‌ای

### 📊 داشبورد
- سایدبار با **collapse** (Ctrl+B)
- **Role-based nav** (فقط بخش‌های مجاز)
- آمار نقش‌محور
- **Breadcrumb تعاملی** با dropdown منو
- وضعیت سرور + لاگ‌های زنده (دولوپر)

---

## 🛠️ تکنولوژی‌ها

| لایه           | تکنولوژی                           |
| -------------- | ---------------------------------- |
| **Backend**    | Node.js 20+ · Express · TypeScript |
| **Database**   | MongoDB 7+ · Mongoose              |
| **Template**   | EJS (SSR)                          |
| **Auth**       | JWT (access + refresh) · bcrypt    |
| **Validation** | Zod                                |
| **Upload**     | Multer (disk storage)              |
| **Email**      | Nodemailer (SMTP / Log mode)       |
| **Frontend**   | Vanilla JS · Modular CSS · RTL     |

---

## 🚀 نصب و راه‌اندازی

### پیش‌نیازها

- Node.js ≥ 20
- MongoDB ≥ 7 (لوکال یا Atlas)
- npm یا pnpm

### مراحل

```bash
# 1. کلون
git clone https://github.com/<your-user>/devhub.git
cd devhub

# 2. نصب پکیج‌ها
npm install

# 3. کپی env
cp .env.example .env

# 4. تنظیم .env
# حداقل: MONGODB_URI و JWT_SECRET رو پر کن
```

### اجرا

```bash
# Development (با tsx و nodemon)
npm run dev

# Production
npm run build
npm start
```

سرور روی `http://localhost:3000` بالا میاد.

### راه‌اندازی اولیه

```bash
# ساخت اولین developer (فقط یک بار)
npm run setup:first-admin

# یا ارتقای دستی
npm run promote your-email@example.com developer "Main admin"

# Seed کتگوری‌ها و تگ‌های پیش‌فرض
npm run seed:tags
```

---

## 📁 ساختار پروژه

```
src/
├── config/          → تنظیمات (env, db, upload, mail)
├── controllers/     → منطق درخواست/پاسخ
├── middleware/      → auth, roles, upload, error, locals
├── models/          → Mongoose models
├── routes/          → تعریف endpointها
├── services/        → منطق کسب‌وکار
│   ├── githubService       → sync با GitHub API
│   ├── sessionService      → ساخت/حذف session
│   ├── verificationService → OTP
│   ├── exploreService      → hot score
│   ├── mailService         → ارسال ایمیل
│   └── roleService         → مدیریت نقش‌ها
├── scripts/         → seed, migration, CLI
├── utils/           → helperها (JWT, errors, ...)
├── validators/      → Zod schemas
├── views/           → EJS templates
│   ├── components/  → header, drawer, dialogs, ...
│   └── dashboard/   → صفحات داشبورد
└── index.ts         → entry point

public/
├── js/              → کلاینت JS
│   ├── components/  → FormKit, TagPicker, MarkdownEditor
│   ├── pages/       → Home, Explore, Users
│   ├── projects/    → List, Show
│   ├── dashboard/   → Projects, Settings, System, Logs, ...
│   └── auth/        → Login, Register, Verify, Reset
├── styles/          → CSS ماژولار
└── uploads/         → فایل‌های آپلودی (gitignored)

uploads/             → ذخیره‌ی فایل‌ها
logs/                → لاگ روزانه
```

---

## 🔌 API

### مختصر

| گروه               | Base URL                     |   Auth    |
| ------------------ | ---------------------------- | :-------: |
| **Auth**           | `/api/auth`                  |     —     |
| **Profile**        | `/api/profile`               |     ✅     |
| **Projects**       | `/api/projects`              |  اختیاری  |
| **Reviews**        | `/api/projects/:id/reviews`  |  اختیاری  |
| **Comments**       | `/api/projects/:id/comments` |  اختیاری  |
| **Tags**           | `/api/tags`                  |     —     |
| **Tag Types**      | `/api/tag-types`             |     —     |
| **Users (Public)** | `/api/users`                 |     —     |
| **Admin**          | `/api/admin`                 |  admin+   |
| **System**         | `/api/system`                | developer |
| **Health**         | `/api/health`                |     —     |

### نمونه

```bash
# ثبت‌نام
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Ali",
    "username": "ali",
    "email": "ali@example.com",
    "password": "pass123",
    "confirmPassword": "pass123",
    "terms": true
  }'

# لیست پروژه‌ها
curl http://localhost:3000/api/projects?sort=rating&limit=10

# پروژه با slug
curl http://localhost:3000/api/projects/my-awesome-app
```

### شکل پاسخ (یکسان)

```json
// موفق
{ "ok": true, "message": "...", "data": { ... } }

// خطا
{
  "ok": false,
  "code": "USERNAME_TAKEN",
  "message": "این نام کاربری قبلاً گرفته شده است",
  "field": "username"
}
```

---

## 🔐 امنیت

| مورد                 | پیاده‌سازی                                     |
| -------------------- | --------------------------------------------- |
| **Password**         | bcrypt (12 rounds)                            |
| **JWT**              | access 15 دقیقه · refresh 30 روز · `typ` مشخص |
| **Cookies**          | HttpOnly + Secure (prod) + SameSite=lax       |
| **Refresh Rotation** | هر refresh → access جدید                      |
| **Session Revoke**   | بعد از تغییر رمز، همه sessionها بسته می‌شن     |
| **OTP**              | SHA-256 + salt · ۵ تلاش · cooldown ۶۰ ثانیه   |
| **Rate Limit**       | روی ارسال ایمیل (per recipient)               |
| **Path Traversal**   | `path.basename` + regex در دانلود             |
| **HTML Sanitize**    | Markdown parser خودش strip می‌کنه              |
| **Anti-enumeration** | پیام یکسان برای ایمیل/کاربر موجود یا نه       |

---

## 👥 نقش‌ها و دسترسی‌ها

سه نقش سلسله‌مراتبی:

```
user → admin → developer
```

| عمل                   | user  | admin | developer |
| --------------------- | :---: | :---: | :-------: |
| ساخت پروژه + تگ       |   ✅   |   ✅   |     ✅     |
| **درخواست** کتگوری    |   ✅   |   ✅   |     ✅     |
| **تایید** کتگوری      |   ❌   |   ✅   |     ✅     |
| تایید تگ دیگران       |   ❌   |   ✅   |     ✅     |
| مدیریت کاربران        |   ❌   |   ✅   |     ✅     |
| تغییر نقش → admin     |   ❌   |   ✅   |     ✅     |
| تغییر نقش → developer |   ❌   |   ❌   |     ✅     |
| بن / آنبن             |   ❌   |   ✅   |     ✅     |
| سیستم + لاگ‌ها         |   ❌   |   ❌   |     ✅     |

**اولین کاربر ثبت‌نام‌شده** → خودکار `developer` می‌شه.

---

## 🧪 تست

```bash
# اجرا (به زودی)
npm test

# بررسی TypeScript
npx tsc --noEmit
```

---

## 🗺️ Roadmap

### v1.1
- [ ] Follow/Unfollow کاربران
- [ ] Notification system
- [ ] Activity feed
- [ ] Rate limiting روی `/auth/*`

### v1.2
- [ ] Search پیشرفته (Full-Text)
- [ ] Live comments (SSE)
- [ ] Admin panel UI

### v2.0
- [ ] Public REST API + versioning
- [ ] 2FA با TOTP
- [ ] GraphQL endpoint
- [ ] Mobile app

---

## 🤝 مشارکت

از PR و Issue استقبال می‌کنیم!

```bash
# 1. Fork
# 2. Branch بساز
git checkout -b feature/amazing-feature

# 3. Commit
git commit -m "feat: add amazing feature"

# 4. Push
git push origin feature/amazing-feature

# 5. Pull Request باز کن
```

لطفاً قبل از شروع، [CONTRIBUTING.md](./CONTRIBUTING.md) رو بخون.

---

## 📄 License

```
BSD 3-Clause License

Copyright (c) 2026 Sobhan Rasoulzadeh Asl (Sobhan-SRZA / Mr. Sinre)
All rights reserved.
```

برای متن کامل به [LICENSE](./LICENSE) مراجعه کن.

---

## 🙏 تشکر

ساخته شده با ❤️ توسط [Sobhan-SRZA](https://github.com/Sobhan-SRZA)

الهام‌گرفته از:
- [GitHub](https://github.com) — برای الگوی تگ‌گذاری و نقد
- [Hacker News](https://news.ycombinator.com) — برای الگوریتم Hot Score
- [Product Hunt](https://producthunt.com) — برای UX کشف

---

<div align="center">

**⭐ اگه این پروژه رو دوست داشتی، ستاره بده!**

</div>
```

---

## 3️⃣ فایل‌های تکمیلی پیشنهادی

### `CONTRIBUTING.md` (خلاصه)

```markdown
# Contributing to DevHub

## Setup
1. Fork & clone
2. `npm install`
3. `cp .env.example .env`
4. `npm run dev`

## Commit Convention
- `feat:` — قابلیت جدید
- `fix:` — رفع باگ
- `docs:` — مستندات
- `style:` — ظاهر (بدون تغییر منطق)
- `refactor:` — بازنویسی
- `test:` — تست
- `chore:` — کارهای جانبی

## PR Checklist
- [ ] TypeScript بدون خطا
- [ ] Validation سمت سرور اضافه شد
- [ ] Error handling کامل
- [ ] Responsive تست شد
- [ ] RTL درست
```

### `.github/ISSUE_TEMPLATE/bug_report.md`

```markdown
---
name: Bug report
about: گزارش باگ
title: '[BUG] '
labels: bug
---

**توضیح باگ**
...

**مراحل بازتولید**
1. ...
2. ...

**انتظار**
...

**واقعیت**
...

**محیط**
- OS: 
- Node: 
- MongoDB: 
- Browser: 
```

---

## 📊 خلاصه

| مورد                | مقصد                        |
| ------------------- | --------------------------- |
| **GitHub About**    | بخش "About" پروژه در گیت‌هاب |
| **Topics**          | تگ‌های پروژه                 |
| **README.md**       | فایل اصلی ریشه              |
| **CONTRIBUTING.md** | راهنمای مشارکت              |
| **LICENSE**         | BSD-3-Clause                |