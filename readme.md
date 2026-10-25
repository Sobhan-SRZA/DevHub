npm run promote ali@example.com admin "Moderator"
npm run promote sohban@example.com developer "Main dev"

# هدر کامل ریسپانسیو + قابلیت‌های جدید

## 📋 امکانات این نسخه

| قابلیت | وضعیت |
|--------|:-----:|
| ریسپانسیو کامل (دسکتاپ/تبلت/موبایل) | ✅ |
| **Search Modal** با `Ctrl+K` و `/` | ✅ |
| **Notification Bell** (placeholder) | ✅ |
| **Profile Dropdown** بهبودیافته با اطلاعات کامل | ✅ |
| **Mobile Drawer** با همه امکانات | ✅ |
| **Active Link Detection** هوشمند | ✅ |
| **Escape/Outside click** برای بستن همه | ✅ |
| **Suggested Pages** (Explore/Projects/Users/About/Contact) | ✅ |
| **Keyboard Shortcuts** | ✅ |
| **Anti-Flicker** (بدون پرش در لود) | ✅ |

---

## 4️⃣ صفحات پیشنهادی (TODO برای آینده)

این صفحات لینک داده شدن ولی هنوز ساخته نشدن. برای ساختنشون این routeها رو به `app.ts` اضافه کن:

```typescript
/* ---------- Public pages (suggested) ---------- */

// اکسپلور پروژه‌ها (search + filter)
// app.get('/explore', optionalAuth, (req, res) => res.render('explore'));

// لیست همه پروژه‌ها (با search)
// app.get('/projects', optionalAuth, (req, res) => res.render('projects/list'));

// لیست کاربران
// app.get('/users', optionalAuth, (req, res) => res.render('users/list'));

// پروفایل کاربر (آماده است)
app.get('/users/:idOrUsername', optionalAuth, (req, res) => {
    res.render('users/show', { idOrUsername: req.params.idOrUsername });
});

// درباره ما
// app.get('/about', (req, res) => res.render('about'));

// تماس با ما
// app.get('/contact', (req, res) => res.render('contact'));

// قوانین
// app.get('/terms', (req, res) => res.render('terms'));

// حریم خصوصی
// app.get('/privacy', (req, res) => res.render('privacy'));

// بلاگ / اخبار
// app.get('/blog', (req, res) => res.render('blog/list'));
// app.get('/blog/:slug', (req, res) => res.render('blog/show', { slug: req.params.slug }));

// جستجوی کاربران
// app.get('/users?q=...', optionalAuth, (req, res) => res.render('users/list', { q: req.query.q }));
```

### پیشنهاد اضافه کردن صفحات بعدی:

| مسیر | توضیح | اولویت |
|------|--------|:------:|
| `/explore` | اکسپلور با search/filter | 🔴 بالا |
| `/projects` | لیست پروژه‌های عمومی | 🔴 بالا |
| `/users` | لیست کاربران | 🟡 متوسط |
| `/about` | درباره تیم/پروژه | 🟢 پایین |
| `/contact` | تماس با ما | 🟢 پایین |
| `/terms` | قوانین استفاده | 🟢 پایین |
| `/privacy` | حریم خصوصی | 🟢 پایین |
| `/blog` | اخبار و مقالات | 🟢 پایین |
| `/faq` | سوالات متداول | 🟢 پایین |


### ⚠️ نکات مهم برای سینک

- **Anti-flicker**: `visibility: hidden` اولیه در `authGuests` جلوی پرش هنگام چک کردن auth رو می‌گیره
- **`user-chip.js`** اگه نداری، هنوز می‌تونی استفاده کنی چون فقط برای کارت‌ها لازمه (این فایل رو در پیام قبل ساختم)
- **Search target** پیش‌فرض `projects` هست. اگه `users` رو بذاری، به `/users?q=` میره

### ⚠️ برای فعال کردن Notification

وقتی سیستم notification آماده شد، فقط این رو در `header.js` عوض کن:

```javascript
els.notifBtn?.addEventListener('click', () => {
    // به‌جای toast placeholder، dropdown یا modal باز کن
    openNotificationsModal();
});

// و برای نمایش dot:
els.notifDot.style.display = hasUnread ? 'block' : 'none';
```

### ✅ Responsive Breakpoints

| عرض | وضعیت |
|-----|-------|
| > 1024px | Full desktop |
| 768-1024px | Condensed desktop |
| ≤ 768px | Mobile (hamburger) |
| ≤ 420px | Very small |

---

## 📊 خلاصه‌ی ویژگی‌های جدید

| ویژگی | جزئیات |
|--------|--------|
| ✅ **Logo** | آیکون + نام با لینک به `/` |
| ✅ **Nav** | خانه، اکسپلور، پروژه‌ها، کاربران، درباره |
| ✅ **Search Modal** | با `Ctrl+K`, `/`، ESC بستن، target chips |
| ✅ **Notifications** | placeholder با dot + tooltip |
| ✅ **Profile Dropdown** | header با avatar + name + username |
| ✅ **Mobile Drawer** | از راست، با profile + nav + logout |
| ✅ **Keyboard Shortcuts** | `Ctrl+K`, `/`, `Escape` |
| ✅ **Active Link** | خودکار با path matching |
| ✅ **Anti-Flicker** | بدون پرش در auth check |
| ✅ **Outside Click** | همه dropdownها |
| ✅ **Body Scroll Lock** | هنگام باز بودن modal/drawer |
| ✅ **Reduced Motion** | برای کاربرانی که انیمیشن کم می‌خوان |
