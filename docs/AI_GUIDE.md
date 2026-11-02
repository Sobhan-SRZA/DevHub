# AI Development Guide

> **Source of truth for the DevHub codebase.**
> Every AI agent or contributor entering this project must read this document
> in full before making changes. It describes the architecture, the routing
> model, the conventions, and the traps that are not obvious from the source
> code alone.

---

## Table of Contents

- [1. Overview](#1-overview)
- [2. Technology Stack](#2-technology-stack)
- [3. Directory Structure](#3-directory-structure)
- [4. Route Model and Loader](#4-route-model-and-loader)
- [5. Complete Route Map](#5-complete-route-map)
- [6. Data Models](#6-data-models)
- [7. Middleware Chain](#7-middleware-chain)
- [8. Authentication and Sessions](#8-authentication-and-sessions)
- [9. API Registry and Guards](#9-api-registry-and-guards)
- [10. Service Layer](#10-service-layer)
- [11. Coding Conventions](#11-coding-conventions)
- [12. Response and Error Format](#12-response-and-error-format)
- [13. Adding a Feature](#13-adding-a-feature)
- [14. Environment and Configuration](#14-environment-and-configuration)
- [15. CLI Scripts](#15-cli-scripts)
- [16. Common Tasks](#16-common-tasks)
- [17. Known Gaps and Traps](#17-known-gaps-and-traps)
- [18. Quick Reference](#18-quick-reference)

---

## 1. Overview

**DevHub** is a curation platform for open-source projects. Users publish
project pages, receive structured reviews, and discover work through a
ranked explore feed. The application is a **server-rendered Express
application** with a thin vanilla-JavaScript client, not a single-page
application and not an API-only service.

### What this means for implementation

- Pages are rendered as EJS templates on the server. The browser receives
  complete HTML.
- Client-side JavaScript adds interactivity to specific pages. It does not
  render the page.
- The same Express process serves both HTML pages and the JSON API. They share
  the same middleware stack and the same session cookies.
- The API is consumed by the application's own client code and by third-party
  integrations. API responses are JSON only.

### Design principles

- **Quality over popularity.** Rankings favour verified engagement over
  passive metrics.
- **Reversibility.** Destructive operations require confirmation; deletions are
  soft where hierarchy matters; role and email changes are audited.
- **Security by default.** Email verification is mandatory; every request is
  validated; every session is revocable.
- **Explicit declarations.** Every API endpoint is registered through
  `apiGuard()`, which enforces environment and feature-flag rules and records
  the endpoint in the manifest.

---

## 2. Technology Stack

| Layer            | Technology                          | Version     |
| ---------------- | ----------------------------------- | ----------- |
| Runtime          | Node.js                             | 20 or later |
| HTTP framework   | Express                             | 5.x         |
| Language         | TypeScript                          | 5 or later  |
| Database         | MongoDB                             | 7 or later  |
| ODM              | Mongoose                            | 9.x         |
| Templating       | EJS                                 | 7.x         |
| Validation       | Zod                                 | 4.x         |
| Authentication   | JSON Web Tokens (HS256)             | 9.x         |
| Password hashing | bcrypt                              | 6.x         |
| File uploads     | Multer                              | 2.x         |
| Email            | Nodemailer                          | 10.x        |
| Rate limiting    | express-rate-limit                  | 8.x         |
| Frontend         | Vanilla JavaScript (ES5-compatible) | —           |
| Styling          | Modular CSS with custom properties  | —           |

---

## 3. Directory Structure

The project is split into two top-level trees.

```
devhub/
├── backend/
│   └── src/
│       ├── api/            → route entry points (auto-mounted)
│       ├── config/         → environment, database, upload, registry
│       ├── controllers/    → request handlers
│       ├── lib/            → route loader
│       ├── middleware/     → auth, roles, ownership, security, errors
│       ├── models/         → Mongoose schemas
│       ├── pages/          → HTML page entry points (auto-mounted)
│       ├── routes/         → concrete router implementations
│       ├── scripts/        → CLI utilities
│       ├── services/       → business logic
│       ├── types/          → shared TypeScript types
│       ├── utils/          → helpers, error factories, tokens
│       ├── validators/     → Zod schemas
│       ├── app.ts          → Express assembly
│       └── index.ts        → process entry point
│
├── frontend/
│   ├── public/
│   │   ├── assets/         → logo
│   │   ├── js/             → client modules
│   │   └── styles/         → modular CSS
│   └── views/
│       ├── components/     → EJS partials
│       └── pages/          → full page templates
│
└── docs/                   → project documentation
```

### `api/` versus `routes/`

Both directories exist and serve different purposes. This distinction is the
most common source of confusion for new contributors.

| Directory             | Purpose                                                                                                                     |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `backend/src/api/`    | Declarative entry points. Each file re-exports a router. The loader walks this tree and mounts every file it finds.         |
| `backend/src/routes/` | Concrete router implementations. These files define the endpoints and are imported by the corresponding `api/` entry point. |

The pattern is consistent throughout the project:

```
backend/src/api/v1/auth/router.ts
  → imports → backend/src/routes/api/authRoutes.ts
               and re-exports it as default

backend/src/api/v1/tag-types/router.ts
  → imports → backend/src/routes/api/tagTypeRoutes.ts
               and re-exports it as default
```

**The loader mounts the `api/` file, not the `routes/` file.** When adding an
endpoint, always modify the `routes/` implementation. When adding a new
namespace, create both the `api/` entry point and the `routes/` implementation.

### Exceptions

Some `api/` files define routes directly rather than re-exporting a router:

- `backend/src/api/v1/404/page.ts` — defines a single route inline
- `backend/src/api/v1/contact/route.ts` — defines routes inline
- `backend/src/api/v1/health/route.ts` — defines routes inline

Both patterns are valid. The `routes/`-based pattern is preferred for anything
that will grow; the inline pattern is acceptable for small, single-purpose
namespaces.

---

## 4. Route Model and Loader

### How mounting works

`backend/src/app.ts` calls `loadRoutes()` twice:

```typescript
const routes = [
  { dir: "pages", prefix: "" },
  { dir: "api", prefix: "/api" }
];

await Promise.all(
  routes.map(async (route) => {
    await loadRoutes(app, path.join(__dirname, route.dir), route.prefix);
  })
);
```

`loadRoutes()` in `backend/src/lib/loader.ts` recursively walks the directory.

- **Files** ending in `.ts` or `.js` are imported and their default export is
  mounted as a router at the current prefix.
- **Directories** are traversed recursively, with their name appended to the
  prefix.

### Path derivation

The mount path is derived from the directory structure, not from the file name.

| File                         | Mounted at          |
| ---------------------------- | ------------------- |
| `api/v1/auth/router.ts`      | `/api/v1/auth`      |
| `api/v1/tag-types/router.ts` | `/api/v1/tag-types` |
| `api/v1/health/route.ts`     | `/api/v1/health`    |
| `api/_meta.ts`               | `/api/_meta`        |
| `pages/explore/page.ts`      | `/explore`          |
| `pages/auth/login.ts`        | `/auth/login`       |
| `pages/dashboard/route.ts`   | `/dashboard`        |

### What the loader does not do

- It does not read any manifest or configuration file. The directory structure
  is the source of truth.
- It does not validate that a route is declared through `apiGuard()`. Strict
  mode flags undeclared routes only through the diagnostic pass during boot,
  not by refusing to mount them.
- It does not apply middleware. Middleware must be declared inside the router
  file itself.

### Consequence for AI agents

Adding a new file at `backend/src/api/v1/xyz/router.ts` is enough to make
`/api/v1/xyz` reachable, **provided the file exports a router as its default
export**. If the file exports nothing, or exports something other than a
router, the loader logs a warning and skips it.

---

## 5. Complete Route Map

The tables below describe every route mounted in the current application.
They reflect the source files exactly.

### 5.1 Pages (HTML)

| Method | Path                     | Template                            | Authentication                    |
| ------ | ------------------------ | ----------------------------------- | --------------------------------- |
| `GET`  | `/`                      | `pages/index.ejs`                   | Public                            |
| `GET`  | `/explore`               | `pages/explore.ejs`                 | Public                            |
| `GET`  | `/projects`              | `pages/projects/list.ejs`           | Public                            |
| `GET`  | `/projects/:idOrSlug`    | `pages/projects/show.ejs`           | Public (SEO enriched)             |
| `GET`  | `/users`                 | `pages/users/list.ejs`              | Public                            |
| `GET`  | `/users/:idOrUsername`   | `pages/users/show.ejs`              | Public (SEO enriched)             |
| `GET`  | `/about`                 | `pages/about.ejs`                   | Public                            |
| `GET`  | `/contact`               | `pages/contact.ejs`                 | Public                            |
| `GET`  | `/legal/privacy`         | `pages/legal/privacy.ejs`           | Public                            |
| `GET`  | `/legal/terms`           | `pages/legal/terms.ejs`             | Public                            |
| `GET`  | `/tickets/track/:token`  | `pages/tickets/track.ejs`           | Public (token-scoped)             |
| `GET`  | `/tickets/lookup`        | `pages/tickets/lookup.ejs`          | Public                            |
| `GET`  | `/auth/login`            | `pages/auth/login.ejs`              | Guest only                        |
| `GET`  | `/auth/register`         | `pages/auth/register.ejs`           | Guest only                        |
| `GET`  | `/auth/forgot-password`  | `pages/auth/forgot-password.ejs`    | Guest only                        |
| `GET`  | `/auth/reset-password`   | `pages/auth/reset-password.ejs`     | Guest only                        |
| `GET`  | `/auth/verify-email`     | `pages/auth/verify-email.ejs`       | Public                            |
| `GET`  | `/dashboard`             | `pages/dashboard/home.ejs`          | `pageAuth`                        |
| `GET`  | `/dashboard/projects`    | `pages/dashboard/projects.ejs`      | `pageAuth`                        |
| `GET`  | `/dashboard/profile`     | `pages/dashboard/profile.ejs`       | `pageAuth`                        |
| `GET`  | `/dashboard/security`    | `pages/dashboard/security.ejs`      | `pageAuth`                        |
| `GET`  | `/dashboard/settings`    | `pages/dashboard/settings.ejs`      | `pageAuth`                        |
| `GET`  | `/dashboard/my-tickets`  | `pages/dashboard/my-tickets.ejs`    | `pageAuth`                        |
| `GET`  | `/dashboard/users`       | `pages/dashboard/users.ejs`         | `pageAuth` + `pageAdminGuard`     |
| `GET`  | `/dashboard/tags`        | `pages/dashboard/tags.ejs`          | `pageAuth` + `pageAdminGuard`     |
| `GET`  | `/dashboard/tag-types`   | `pages/dashboard/tag-types.ejs`     | `pageAuth` + `pageAdminGuard`     |
| `GET`  | `/dashboard/tickets`     | `pages/dashboard/tickets.ejs`       | `pageAuth` + `pageAdminGuard`     |
| `GET`  | `/dashboard/tickets/:id` | `pages/dashboard/ticket-detail.ejs` | `pageAuth` + `pageAdminGuard`     |
| `GET`  | `/dashboard/system`      | `pages/dashboard/system.ejs`        | `pageAuth` + `pageDeveloperGuard` |
| `GET`  | `/dashboard/logs`        | `pages/dashboard/logs.ejs`          | `pageAuth` + `pageDeveloperGuard` |
| `GET`  | `/sitemap`               | Generated dynamically               | Public                            |
| `GET`  | `/sitemap.xml`           | 301 redirect to `/sitemap`          | Public                            |

### 5.2 Authentication — `/api/v1/auth`

| Method   | Path                     | Middleware                                   | Handler                              |
| -------- | ------------------------ | -------------------------------------------- | ------------------------------------ |
| `POST`   | `/register`              | `authLimiter`                                | `authController.register`            |
| `POST`   | `/login`                 | `authLimiter`                                | `authController.login`               |
| `POST`   | `/refresh`               | `authLimiter`                                | `authController.refresh`             |
| `POST`   | `/logout`                | —                                            | `authController.logout`              |
| `POST`   | `/forgot-password`       | `sensitiveLimiter`                           | `authController.forgotPassword`      |
| `POST`   | `/reset-password`        | `sensitiveLimiter`                           | `authController.resetPassword`       |
| `POST`   | `/resend-password-reset` | `sensitiveLimiter`                           | `authController.resendPasswordReset` |
| `POST`   | `/verify-email`          | `noCache`, `sensitiveLimiter`                | `authController.verifyEmail`         |
| `POST`   | `/resend-verification`   | `noCache`, `requireAuth`, `sensitiveLimiter` | `authController.resendVerification`  |
| `GET`    | `/me`                    | `requireAuth`                                | `authController.me`                  |
| `POST`   | `/logout-all`            | `requireAuth`                                | `authController.logoutAll`           |
| `GET`    | `/sessions`              | `requireAuth`                                | `authController.listSessions`        |
| `DELETE` | `/sessions/:id`          | `requireAuth`                                | `authController.revokeSession`       |

**Note on `/resend-verification`:** this route requires authentication. The
controller accepts either an authenticated session or a signed verification
token in the request body. The frontend uses the authenticated path when
restoring a verification state after a page reload.

### 5.3 Profile — `/api/profile`

All routes are protected by `router.use(requireAuth, noCache)`.

| Method   | Path                | Handler                                     |
| -------- | ------------------- | ------------------------------------------- |
| `GET`    | `/me`               | `profileController.getMe`                   |
| `PATCH`  | `/me`               | `profileController.updateProfile`           |
| `PATCH`  | `/username`         | `profileController.changeUsername`          |
| `POST`   | `/avatar`           | `profileController.uploadAvatar`            |
| `DELETE` | `/avatar`           | `profileController.deleteAvatar`            |
| `POST`   | `/email/request`    | `profileController.requestEmailChange`      |
| `POST`   | `/email/verify`     | `profileController.verifyEmailChange`       |
| `POST`   | `/email/verify-old` | `profileController.verifyOldEmailForChange` |
| `DELETE` | `/email/pending`    | `profileController.cancelEmailChange`       |
| `POST`   | `/password/request` | `profileController.requestPasswordChange`   |
| `POST`   | `/password/confirm` | `profileController.confirmPasswordChange`   |

### 5.4 Projects — `/api/v1/projects`

| Method   | Path                   | Middleware                                                 | Handler               |
| -------- | ---------------------- | ---------------------------------------------------------- | --------------------- |
| `GET`    | `/`                    | `optionalAuth`, `apiRateLimit`                             | `listProjects`        |
| `GET`    | `/explore`             | `apiRateLimit`                                             | `explore`             |
| `GET`    | `/home-feed`           | `apiRateLimit`                                             | `homeFeeds`           |
| `GET`    | `/:idOrSlug`           | `optionalAuth`, `apiRateLimit`                             | `getProject`          |
| `POST`   | `/`                    | `requireAuth`, `apiRateLimit`                              | `createProject`       |
| `PUT`    | `/:id`                 | `requireAuth`, `requireProjectOwnership`                   | `updateProject`       |
| `DELETE` | `/:id`                 | `requireAuth`, `requireProjectOwnership`                   | `deleteProject`       |
| `POST`   | `/:id/sync-github`     | `requireAuth`, `requireProjectOwnership`                   | `syncGithub`          |
| `PATCH`  | `/:id/status`          | `requireAuth`, `requireProjectOwnership`                   | `toggleStatus`        |
| `POST`   | `/:id/images`          | `requireAuth`, `requireProjectOwnership`, `mwUploadImages` | `uploadProjectImages` |
| `DELETE` | `/:id/images/:imageId` | `requireAuth`, `requireProjectOwnership`                   | `deleteProjectImage`  |
| `PATCH`  | `/:id/images/order`    | `requireAuth`, `requireProjectOwnership`                   | `reorderImages`       |
| `POST`   | `/:id/video`           | `requireAuth`, `requireProjectOwnership`, `mwUploadVideo`  | `uploadProjectVideo`  |
| `DELETE` | `/:id/video`           | `requireAuth`, `requireProjectOwnership`                   | `deleteProjectVideo`  |
| `POST`   | `/:id/file`            | `requireAuth`, `requireProjectOwnership`, `mwUploadZip`    | `uploadProjectZip`    |
| `DELETE` | `/:id/file`            | `requireAuth`, `requireProjectOwnership`                   | `deleteProjectZip`    |
| `GET`    | `/:idOrSlug/download`  | `optionalAuth`, `loadProject`, `apiRateLimit`              | `downloadProject`     |

Nested routers:

```
router.use("/:idOrSlug/reviews", reviewRoutes);
router.use("/:idOrSlug/comments", commentRoutes);
```

### 5.5 Reviews — `/api/v1/projects/:idOrSlug/reviews`

The router uses `{ mergeParams: true }` so that `idOrSlug` is available in
controllers.

| Method   | Path           | Middleware                     | Handler        |
| -------- | -------------- | ------------------------------ | -------------- |
| `GET`    | `/`            | `optionalAuth`, `apiRateLimit` | `listReviews`  |
| `GET`    | `/me`          | `requireAuth`, `apiRateLimit`  | `getMyReview`  |
| `POST`   | `/`            | `requireAuth`, `apiRateLimit`  | `createReview` |
| `PUT`    | `/`            | `requireAuth`, `apiRateLimit`  | `updateReview` |
| `DELETE` | `/`            | `requireAuth`, `apiRateLimit`  | `deleteReview` |
| `POST`   | `/:id/helpful` | `requireAuth`, `apiRateLimit`  | `markHelpful`  |

`/me` is registered before parameterized routes so it is not shadowed.

### 5.6 Comments — `/api/v1/projects/:idOrSlug/comments`

Also mounted with `{ mergeParams: true }`. Every handler receives both
`idOrSlug` (project) and `id` (comment). Controllers must verify that the
comment belongs to the project — `assertCommentBelongsToProject` performs
this check to prevent IDOR.

| Method   | Path        | Middleware                     | Handler         |
| -------- | ----------- | ------------------------------ | --------------- |
| `GET`    | `/`         | `optionalAuth`, `apiRateLimit` | `listComments`  |
| `POST`   | `/`         | `requireAuth`, `apiRateLimit`  | `createComment` |
| `PUT`    | `/:id`      | `requireAuth`, `apiRateLimit`  | `updateComment` |
| `DELETE` | `/:id`      | `requireAuth`, `apiRateLimit`  | `deleteComment` |
| `POST`   | `/:id/like` | `requireAuth`, `apiRateLimit`  | `toggleLike`    |

### 5.7 Tags — `/api/v1/tags`

| Method   | Path              | Middleware                           | Handler           |
| -------- | ----------------- | ------------------------------------ | ----------------- |
| `GET`    | `/`               | `optionalAuth`, `apiRateLimit`       | `listTags`        |
| `GET`    | `/suggest`        | `optionalAuth`, `apiRateLimit`       | `suggestTags`     |
| `GET`    | `/pending`        | `requireAuth`, `requireAdmin`        | `listPending`     |
| `POST`   | `/find-or-create` | `requireAuth`, `apiRateLimit`        | `findOrCreateTag` |
| `POST`   | `/`               | `requireAuth`, `apiRateLimit`        | `createTag`       |
| `POST`   | `/:id/approve`    | `requireAuth`, `requireAdmin`        | `approveTag`      |
| `PUT`    | `/:id`            | `requireAuth`, `requireTagOwnership` | `updateTag`       |
| `DELETE` | `/:id`            | `requireAuth`, `requireTagOwnership` | `deleteTag`       |
| `GET`    | `/:id`            | `optionalAuth`, `apiRateLimit`       | `getTag`          |

Named routes (`/suggest`, `/pending`, `/find-or-create`) are registered
before the parameterized `/:id` route.

### 5.8 Categories — `/api/v1/tag-types`

| Method   | Path           | Middleware                                    | Handler          |
| -------- | -------------- | --------------------------------------------- | ---------------- |
| `GET`    | `/`            | `optionalAuth`, `apiRateLimit`                | `listTagTypes`   |
| `GET`    | `/:id`         | `optionalAuth`, `apiRateLimit`                | `getTagType`     |
| `POST`   | `/`            | `requireAuth`, `requireAdmin`, `apiRateLimit` | `createTagType`  |
| `PUT`    | `/:id`         | `requireAuth`, `requireAdmin`, `apiRateLimit` | `updateTagType`  |
| `DELETE` | `/:id`         | `requireAuth`, `requireAdmin`, `apiRateLimit` | `deleteTagType`  |
| `POST`   | `/:id/approve` | `requireAuth`, `requireAdmin`, `apiRateLimit` | `approveTagType` |

**Note:** `tagController.requestTagType` and `tagController.createTagType`
exist as functions but are **not routed**. The `/request` endpoint described
in earlier documentation does not exist. If you need it, wire it in
`tagTypeRoutes.ts`. This gap is listed in
[Known Gaps and Traps](#17-known-gaps-and-traps).

### 5.9 Users — `/api/v1/users`

| Method | Path                      | Middleware                     | Handler            |
| ------ | ------------------------- | ------------------------------ | ------------------ |
| `GET`  | `/me/stats`               | `requireAuth`, `apiRateLimit`  | `getMyStats`       |
| `GET`  | `/`                       | `optionalAuth`, `apiRateLimit` | `listUsers`        |
| `GET`  | `/:idOrUsername/projects` | `optionalAuth`, `apiRateLimit` | `getUserProjects`  |
| `GET`  | `/:idOrUsername/reviews`  | `optionalAuth`, `apiRateLimit` | `getUserReviews`   |
| `GET`  | `/:idOrUsername`          | `optionalAuth`, `apiRateLimit` | `getPublicProfile` |

`/me/stats` is registered first so it is not shadowed by `/:idOrUsername`.

### 5.10 Admin — `/api/v1/admin`

`router.use(requireAuth, requireAdmin)` applies to every route.

| Method | Path              | Handler                      |
| ------ | ----------------- | ---------------------------- |
| `GET`  | `/users`          | `adminController.listUsers`  |
| `POST` | `/users/:id/role` | `adminController.changeRole` |
| `POST` | `/users/:id/ban`  | `adminController.toggleBan`  |

**Note:** role changes and ban toggles are `POST`, not `PATCH`, despite what
convention might suggest. Preserve this when adding new admin routes.

### 5.11 System — `/api/v1/system`

`router.use(requireAuth, requireDeveloper)` applies to every route.

| Method | Path             | Handler                           |
| ------ | ---------------- | --------------------------------- |
| `GET`  | `/stats`         | `systemController.getSystemStats` |
| `GET`  | `/logs`          | `systemController.getLogs`        |
| `GET`  | `/logs/download` | `systemController.downloadLogs`   |
| `POST` | `/logs/clear`    | `systemController.clearLogs`      |

### 5.12 Health — `/api/v1/health`

| Method | Path        | Middleware                        | Handler                        |
| ------ | ----------- | --------------------------------- | ------------------------------ |
| `GET`  | `/`         | —                                 | Inline                         |
| `GET`  | `/detailed` | `requireAuth`, `requireDeveloper` | `healthController.healthCheck` |

### 5.13 Contact — `/api/v1/contact`

| Method | Path | Middleware                                    | Handler                          |
| ------ | ---- | --------------------------------------------- | -------------------------------- |
| `POST` | `/`  | `optionalAuth`, `sensitiveLimiter`, `noCache` | `contactController.createTicket` |

### 5.14 Tickets — `/api/v1/tickets`

| Method | Path                  | Middleware                    | Handler                |
| ------ | --------------------- | ----------------------------- | ---------------------- |
| `GET`  | `/track/:token`       | `apiRateLimit`                | `getTicketByToken`     |
| `POST` | `/track/:token/reply` | `sensitiveLimiter`            | `replyToTicketByToken` |
| `POST` | `/lookup`             | `sensitiveLimiter`            | `requestTicketLookup`  |
| `POST` | `/lookup/verify`      | `sensitiveLimiter`            | `verifyTicketLookup`   |
| `GET`  | `/my`                 | `requireAuth`, `apiRateLimit` | `listMyTickets`        |

The following are protected by
`router.use(requireAuth, requireAdmin, noCache)`:

| Method  | Path         | Handler         |
| ------- | ------------ | --------------- |
| `GET`   | `/`          | `listTickets`   |
| `GET`   | `/:id`       | `getTicket`     |
| `POST`  | `/:id/reply` | `replyToTicket` |
| `PATCH` | `/:id`       | `updateTicket`  |

### 5.15 API Manifest — `/api/_meta`

| Method | Path    | Middleware                                        | Handler                   |
| ------ | ------- | ------------------------------------------------- | ------------------------- |
| `GET`  | `/`     | `apiRateLimit`                                    | Inline (public summary)   |
| `GET`  | `/full` | `requireAuth`, `requireDeveloper`, `apiRateLimit` | Inline (full manifest)    |
| `GET`  | `/diff` | `requireAuth`, `requireDeveloper`, `apiRateLimit` | Inline (environment diff) |

---

## 6. Data Models

Eight Mongoose models are defined in `backend/src/models/`.

### `User`

| Field                                                | Type        | Notes                                                |
| ---------------------------------------------------- | ----------- | ---------------------------------------------------- |
| `name`                                               | String      | 2–60 characters.                                     |
| `username`                                           | String      | 3–20 characters; case-sensitive display value.       |
| `usernameLower`                                      | String      | Lowercase; unique index; used for lookups.           |
| `email`                                              | String      | Lowercase; unique index.                             |
| `emailVerified`                                      | Boolean     | Registration is incomplete until verified.           |
| `emailVerifiedAt`                                    | Date        | Null until verified.                                 |
| `password`                                           | String      | bcrypt hash; `select: false`.                        |
| `bio`                                                | String      | Markdown.                                            |
| `avatar`                                             | Subdocument | `url`, `filename`, `mimeType`, `size`, `uploadedAt`. |
| `pendingEmail`                                       | Subdocument | Tracks a two-step email change.                      |
| `role`                                               | Enum        | `user`, `admin`, `developer`.                        |
| `isBanned`                                           | Boolean     | Blocks login and every authenticated request.        |
| `roleChangedBy`, `roleChangedAt`, `roleChangeReason` | Audit       | Populated on role changes.                           |

**Hook:** `pre("validate")` synchronises `usernameLower` from `username`.
**Hook:** `pre("save")` rehashes `password` when modified.
**Method:** `comparePassword(candidate)` → `Promise<boolean>`.

### `Project`

Includes owner reference, title, slug (unique), GitHub metadata
subdocument, description fields, media subdocuments (images array, video,
file), aggregate statistics (`rating`, `satisfaction`, `reviewCount`,
`downloads`, `views`), tags array, status enum, and public/featured flags.

**Indexes:** owner + status + updatedAt; tags + status; rating + reviewCount;
downloads + rating.

### `Review`

One document per user per project. Compound unique index on
`{ project, user }`.

Fields: `rating` (0–5), `satisfaction` (0–100), `title`, `body`,
`isEdited`, `editedAt`, `helpfulCount`.

### `Comment`

Supports threading through `parent` and `depth`.

Fields: `project`, `user`, `body`, `parent`, `depth` (0–5), `isEdited`,
`isDeleted`, `replyCount`, `likes` (array of user IDs).

**Index:** `{ project, parent, createdAt }` for efficient threaded queries.

### `Tag`

Belongs to a `TagType`. Compound unique index on `{ slug, type }`.

Fields: `name`, `slug`, `type`, `color`, `description`, `isSystem`,
`isApproved`, `createdBy`, `usageCount`.

### `TagType` (Category)

Fields: `name`, `slug` (unique), `description`, `color`, `icon`,
`isSystem`, `isApproved`, `allowUserTags`, `maxTags`, `order`, `createdBy`.

### `Session`

Fields: `user`, `sessionId` (unique), `deviceHash`, `token`, `refreshToken`
(`select: false`), `device` subdocument, `location` subdocument, `client`
subdocument, `loginAt`, `lastActiveAt`, `expiresAt`.

**Indexes:** unique `sessionId`, unique `token`, compound
`{ user, deviceHash, expiresAt }`, TTL on `expiresAt`.

**Method:** `isExpired()` → boolean.

### `VerificationCode`

Fields: `user`, `purpose` (enum), `codeHash`, `salt`, `targetEmail`,
`attempts`, `maxAttempts`, `expiresAt`, `consumedAt`, `requestedAt`, `ip`,
`userAgent`.

**Index:** compound `{ user, purpose, consumedAt }`, TTL on `expiresAt`.

**Statics:** `generateCode()` returns `{ code, codeHash, salt }`;
`hashCode(code, salt)` returns a digest.

### `Ticket`

Fields: `ticketNumber` (unique), `name`, `email`, `subject`, `category`,
`message`, `status`, `priority`, `userId`, `messages` array, `assignedTo`,
tracking fields (`trackingTokenHash`, `trackingExpiresAt`, `trackingRevoked`),
lookup fields (`lookupOtpHash`, `lookupOtpExpiresAt`, `lookupOtpAttempts`),
`ip`, `userAgent`.

**Hook:** `pre("validate")` generates `ticketNumber` and seeds the messages
array with the initial submission.

---

## 7. Middleware Chain

The order of middleware in `backend/src/app.ts` is deliberate and should not
be rearranged without a specific reason.

```
1.  initializeEnvironment()          → validates env, resolves APP_ENV, loads flags
2.  app.set("trust proxy", 1)        → conditional on TRUST_PROXY or NODE_ENV
3.  app.disable("x-powered-by")
4.  rejectSuspiciousPaths            → blocks path traversal and null bytes
5.  securityHeaders()                → CSP, HSTS, X-Frame-Options, ...
6.  compressionMiddleware()          → compression package or native zlib
7.  express.json({ limit: "2mb" })
8.  express.urlencoded({ limit: "2mb" })
9.  cookieParser()
10. apiLimiter on "/api"             → global rate limiter
11. app.set("view engine", "ejs")
12. app.set("views", frontend/views)
13. express.static(frontend/public)  → with caching headers
14. express.static("/uploads")       → with security headers, index disabled
15. GET /sitemap.xml → 301 /sitemap
16. loadRoutes (async)               → pages + api
17. 404 handler (JSON for /api/*, HTML otherwise)
18. errorHandler                     → last
```

### Notes on the ordering

- **`initializeEnvironment()` runs first.** It validates production-critical
  configuration and throws if `JWT_SECRET` or `APP_URL` are unsuitable.
- **`rejectSuspiciousPaths` runs before routing.** Requests containing
  `\0`, `%00`, or `../` are rejected before the router sees them.
- **The API limiter is mounted on `/api` only.** It does not affect page
  requests.
- **The 404 and error handlers are registered inside the `Promise.then()`.**
  They are only attached after every route has been loaded. If route loading
  fails, the process exits.
- **`attachUserLocals` is not global.** It is applied per-route through
  `backend/src/middleware/locals.ts` where EJS templates need
  `res.locals.currentUser`.

### Adding new middleware

New global middleware must be inserted **before** the route loader (step 16).
New per-route middleware belongs in the router file, not in `app.ts`.

---

## 8. Authentication and Sessions

### Session lifecycle

A session document is created on registration, on email verification, and on
login.

```
startSession(userId, req, opts)
  → compute deviceHash from userAgent + fingerprint/deviceId
  → reuse an unexpired session with the same deviceHash, OR create a new one
  → sign access token (JWT, typ="access", sid=session.sessionId)
  → sign refresh token (JWT, typ="refresh", sid=session.sessionId)
  → store both tokens on the session document
  → return { session, access, refresh, reused }
```

Cookies are set only by the controller (`setAuthCookies` in
`authController.ts`). Neither `startSession` nor any other service touches the
response object.

### Request authentication

`requireAuth` (in `middleware/auth.ts`) performs the following on every
authenticated request:

1. Read `req.cookies.access_token`.
2. Fall back to `Authorization: Bearer ...` if the cookie is absent.
3. Verify the JWT signature and expiration.
4. Reject if `payload.typ !== "access"`.
5. Look up the session by `sessionId: payload.sid` with `expiresAt > now`.
6. Look up the user by `payload.sub`.
7. Reject if the user is banned.
8. Attach `req.user` and `req.session`.
9. Update `session.lastActiveAt` asynchronously (non-blocking).

**Session lookup is not optional.** A syntactically valid JWT is not
sufficient. The session document must exist and must not have expired. This
is what enables immediate revocation.

### Refresh flow

`POST /api/v1/auth/refresh`:

1. Read `req.cookies.refresh_token`.
2. Verify the JWT and confirm `typ === "refresh"`.
3. Look up the session by `{ sessionId, refreshToken, expiresAt > now }`.
4. Issue a new access token.
5. Update `session.token` and `session.lastActiveAt`.
6. Set a new `access_token` cookie.

**The refresh token is not rotated.** It remains valid until the session
expires. This is a deliberate trade-off; rotation would require the client to
handle in-flight requests that use the old token.

### Revocation paths

| Trigger                                           | Sessions affected                      |
| ------------------------------------------------- | -------------------------------------- |
| `POST /logout`                                    | Current session only                   |
| `POST /logout-all`                                | All sessions for the user              |
| Password change (`/api/profile/password/confirm`) | All sessions except the current one    |
| Password reset (`/api/auth/reset-password`)       | All sessions                           |
| `DELETE /api/v1/auth/sessions/:id`                | The specified session                  |
| Session expiry                                    | Enforced by query filter and TTL index |

### Email verification flow

1. `POST /register` creates the user, issues a verification code, and returns
   `verifyToken` (a signed JWT of type `email_verify`). **No session is
   issued.**
2. The user receives a 6-digit code by email.
3. `POST /verify-email` verifies the token and code, sets
   `emailVerified = true`, and issues a session.
4. If session creation fails, the email is still marked verified; the user
   can log in manually.

### Email change flow

1. `POST /api/profile/email/request` — requires the current password.
   Dispatches a code to the **current** email.
2. `POST /api/profile/email/verify-old` — verifies that code. The user's email
   is updated immediately, but `emailVerified` is set to `false`. A code is
   dispatched to the **new** email.
3. The user is redirected to `/auth/verify-email` and follows the standard
   verification flow.
4. `DELETE /api/profile/email/pending` cancels the change and reverts the email
   to its previous value if step 2 has already completed.

---

## 9. API Registry and Guards

### Purpose

The registry in `backend/src/config/apiRegistry.ts` records every API endpoint
declared through `apiGuard()`. It is consulted by:

- The manifest endpoints (`/api/_meta`, `/api/_meta/full`, `/api/_meta/diff`).
- Boot-time diagnostics that warn about declared-but-unmounted endpoints.

### `apiGuard()` usage

Every API endpoint should be wrapped:

```typescript
router.post(
  "/",
  requireAuth,
  apiRateLimit("authenticated"),
  apiGuard({
    path: "/api/v1/projects",
    method: "POST",
    visibility: "authenticated",
    description: "Create a new project.",
    tags: ["projects"],
  }),
  ctrl.createProject
);
```

The declaration has the following fields:

| Field         | Required | Description                                                  |
| ------------- | -------- | ------------------------------------------------------------ |
| `path`        | ✅        | Full path from the application root.                         |
| `method`      | ✅        | HTTP method.                                                 |
| `visibility`  | ✅        | `public`, `authenticated`, `admin`, `developer`, `internal`. |
| `environment` | —        | `dev-only`, `staging-only`, `prod-only`, `all` (default).    |
| `featureFlag` | —        | A flag name from `FEATURE_FLAGS`.                            |
| `rateLimit`   | —        | Per-endpoint rate limit override.                            |
| `description` | —        | Human-readable, used in the manifest.                        |
| `tags`        | —        | Grouping labels for the manifest.                            |

### Behaviour

- At construction time, the declaration is registered in the registry
  regardless of whether the endpoint is enabled.
- If the declaration is disabled (by environment or feature flag), the guard
  returns a 404. This hides the existence of the endpoint from unauthenticated
  scanners.
- If the endpoint is enabled, the guard is a pass-through. Authorization is
  enforced by the surrounding middleware (`requireAuth`, `requireAdmin`).

### Strict mode

`API_STRICT=true` (default in production) enables boot-time diagnostics. It
does **not** refuse to mount undeclared routes — it warns about them. The
production default for `API_STRICT` is `true`; setting it to `false` produces
a warning at startup.

### `apiRateLimit()`

Tiered limiter applied per-endpoint. It keys on the authenticated user when
available, falling back to the IP address.

| Visibility      | Default window | Default limit |
| --------------- | -------------- | ------------- |
| `public`        | 60 s           | 60            |
| `authenticated` | 60 s           | 120           |
| `admin`         | 60 s           | 240           |
| `developer`     | 60 s           | 240           |

Individual endpoints pass an explicit override:

```typescript
apiRateLimit("authenticated", { windowMs: 60 * 60_000, max: 10 })
```

---

## 10. Service Layer

Services contain business logic and must not import `express`. They accept
plain objects and return plain objects or promises. This makes them testable
in isolation.

| Service               | Responsibility                                                                      |
| --------------------- | ----------------------------------------------------------------------------------- |
| `roleService`         | Role hierarchy, `changeUserRole`, `ensureDeveloperExists`, `shouldBecomeDeveloper`. |
| `sessionService`      | `startSession`, `endSession`, `endAllSessions`, `touchSession`.                     |
| `verificationService` | `createVerificationCode`, `verifyCode`.                                             |
| `mail/`               | Transport layer, rate limiting, template rendering, `sendOtpEmail`.                 |
| `githubService`       | Repository metadata fetch with caching, rate-limit awareness, and ETags.            |
| `exploreService`      | Hot Score aggregation and home feed assembly.                                       |
| `ratingService`       | `recalculateProjectStats` after every review write.                                 |
| `fileService`         | `toPublicUrl`, `toAbsolutePath`, `deleteFile`, `deleteProjectFiles`.                |
| `spamDetection`       | Content scoring and `assertNotSpam`.                                                |
| `userStatsService`    | Aggregated per-user analytics.                                                      |
| `ticketService`       | Tracking tokens, lookup OTPs, email notifications, account linkage.                 |
| `cache`               | In-memory key-value cache with TTL.                                                 |
| `logger`              | Console interception and daily file persistence.                                    |

### Rules for service code

- No Express imports. No `req` or `res`.
- Throw `AppError` for control-flow failures; do not return sentinel values.
- Accept domain types or validated payloads, not raw request bodies.
- Log significant state transitions (role changes, password changes) using
  the standard marker format.

---

## 11. Coding Conventions

### Controllers

Every controller follows the same shape:

```typescript
import { asyncHandler } from "../utils/asyncHandler";
import { validate } from "../utils/validate";
import { Unauthorized, NotFound } from "../utils/AppError";
import { ErrorCodes } from "../utils/errorCodes";
import { someSchema } from "../validators/someValidator";
import { SomeModel } from "../models/SomeModel";

export const actionName = asyncHandler(async (req: any, res) => {
  // 1. Authorization (if not already enforced by middleware)
  if (!req.user) throw Unauthorized(ErrorCodes.UNAUTHENTICATED);

  // 2. Validation
  const data = validate(someSchema, req.body);

  // 3. Business logic (delegate to services when non-trivial)
  const result = await SomeModel.doSomething(data);

  // 4. Response
  res.json({ ok: true, result });
});
```

**Do not** wrap controllers in additional try/catch. `asyncHandler` handles
rejected promises and thrown exceptions. Express 5 also handles returned
rejected promises, but `asyncHandler` remains the project's convention.

### Error factories

```typescript
throw new AppError(400, ErrorCodes.VALIDATION_ERROR, "Message", { field: "email" });
throw Conflict(ErrorCodes.EMAIL_TAKEN);
throw Unauthorized(ErrorCodes.INVALID_CREDENTIALS);
throw Forbidden(ErrorCodes.PROJECT_NOT_OWNED);
throw NotFound(ErrorCodes.PROJECT_NOT_FOUND);
throw TooManyRequests(ErrorCodes.TOO_MANY_ATTEMPTS);
```

Never `throw new Error()`. Never let raw database errors reach the client.

### Validators

Zod schemas are the only permitted validation mechanism.

```typescript
export const createProjectSchema = z.object({
  title: z.string().trim().min(2).max(120),
  slug: z.string().trim().toLowerCase().regex(SLUG_RE).optional(),
  tags: z.array(z.string().regex(OBJECT_ID_RE)).max(20).optional(),
});

export const updateProjectSchema = createProjectSchema.partial();
```

Query schemas use `z.coerce` for numeric fields:

```typescript
export const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
```

### Frontend JavaScript

- ES5-compatible. No `import`/`export` statements. No bundler.
- Modules attach to `window` via IIFE.
- All user-supplied strings pass through `escapeHtml()` before any `innerHTML`
  interpolation.
- All fetch calls include `credentials: 'include'`.
- Errors are surfaced through `FormKit`, `openDialogError`, `confirmDialog`,
  or `toast`.

```javascript
(function () {
  'use strict';

  function escapeHtml(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  async function api(path, opts = {}) {
    const res = await fetch(path, {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      ...opts,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data.message || 'Error');
      Object.assign(err, data, { status: res.status });
      throw err;
    }
    return data;
  }

  // ... page logic
})();
```

### CSS

- Use design tokens from `styles/index.css` and `styles/themes.css`
  (`--bg`, `--text`, `--accent`, `--border`, `--radius`, `--shadow`).
- Page-specific CSS belongs in the matching subdirectory.
- Respect `prefers-reduced-motion` and `prefers-color-scheme`.

### EJS

- Escape with `<%= %>`. Use `<%- %>` only for pre-sanitised content or for
  `include()`.
- Public pages must include `seo-head` with a title, description, and
  canonical path.
- Private pages must pass `noindex: true` to `seo-head`.
- Reuse the standard partials: `header`, `footer`, `dialogError`,
  `dashboard-nav`, `dash-breadcrumb`, `dashboard-nav-items`,
  `theme-switcher`.

---

## 12. Response and Error Format

### Success

```json
{ "ok": true, "message": "Optional.", "data": { } }
```

Many endpoints return top-level fields instead of a `data` envelope for
historical reasons:

```json
{ "ok": true, "projects": [...], "pagination": {...} }
{ "ok": true, "user": {...}, "session": {...} }
```

Clients must check `ok` first.

### Error

```json
{
  "ok": false,
  "code": "USERNAME_TAKEN",
  "message": "This username is already taken.",
  "field": "username",
  "details": {
    "username": ["This username is already taken."]
  }
}
```

`field` and `details` are optional. `code` is stable and is the recommended
way for clients to branch on errors.

### Error codes

All codes are defined in `backend/src/utils/errorCodes.ts` with English
messages. New codes must be added to both the `ErrorCodes` object and the
`ErrorMessages` record.

---

## 13. Adding a Feature

Ten steps, in order. Skipping a step typically produces an inconsistent
implementation.

### 1. Model

**Location:** `backend/src/models/Xyz.ts`

Define the interface, schema, indexes, and any instance methods. Index design
matters — identify the queries the feature will run and add compound indexes
accordingly.

### 2. Validator

**Location:** `backend/src/validators/xyzValidator.ts`

One schema per operation: `createXyzSchema`, `updateXyzSchema`,
`xyzListQuerySchema`. `updateXyzSchema` is usually
`createXyzSchema.partial()`.

### 3. Error codes

**Location:** `backend/src/utils/errorCodes.ts`

Add codes with `SCREAMING_SNAKE_CASE` names and English messages.

### 4. Service (if applicable)

**Location:** `backend/src/services/xyzService.ts`

Required if the logic is reused across controllers or complex enough to test
independently. Must not import `express`.

### 5. Controller

**Location:** `backend/src/controllers/xyzController.ts`

Follow the shape in [Coding Conventions](#coding-conventions).

### 6. Route

**Location:** `backend/src/routes/api/xyzRoutes.ts` (implementation)

Declare every endpoint through `apiGuard()`. Apply `requireAuth`,
`requireAdmin`, or `requireProjectOwnership` as needed. Apply `apiRateLimit()`
with an override if the default is not appropriate.

### 7. Entry point

**Location:** `backend/src/api/v1/xyz/router.ts` (or `route.ts`)

```typescript
import xyzRoutes from "../../../routes/api/xyzRoutes";
export default xyzRoutes;
```

The loader will mount this at `/api/v1/xyz`.

### 8. Page route (if the feature has a page)

**Location:** `backend/src/pages/xyz/page.ts`

Apply `pageAuth` and, if required, `pageAdminGuard` or `pageDeveloperGuard`.
Call `attachUserLocals` when the template requires `res.locals.currentUser`.

### 9. EJS template

**Location:** `frontend/views/pages/xyz/show.ejs`

Include `seo-head`, `header`, `dialogError`, and `footer`.

### 10. Client code and CSS

**Location:** `frontend/public/js/xyz/show.js` and
`frontend/public/styles/xyz/show.css`

### Checklist

- [ ] Model with appropriate indexes.
- [ ] Zod schema for every payload and query.
- [ ] Error codes with English messages.
- [ ] Controller uses `asyncHandler` and `validate`.
- [ ] Route declared through `apiGuard()`.
- [ ] API reference in `README.md` updated.
- [ ] Page guarded with the correct role middleware.
- [ ] `noindex: true` on private pages.
- [ ] Client escapes user-supplied strings.
- [ ] `npx tsc --noEmit` passes.

---

## 14. Environment and Configuration

### Required variables

| Variable      |  Required  | Notes                                           |
| ------------- | :--------: | ----------------------------------------------- |
| `PORT`        |     ✅      | HTTP port.                                      |
| `MONGODB_URI` |     ✅      | Full connection string.                         |
| `JWT_SECRET`  |     ✅      | Minimum 64 characters in production (enforced). |
| `APP_URL`     | Production | Public domain, without a trailing slash.        |

### Environment resolution

`APP_ENV` takes precedence over `NODE_ENV`. Valid values are `development`,
`staging`, and `production`. `APP_ENV=production` requires `APP_URL` to be
set and `JWT_SECRET` to be at least 64 characters; otherwise, the process
exits at startup.

### Feature flags

`FEATURE_FLAGS` is a comma-separated list:

```env
FEATURE_FLAGS=beta-ui,new-search
```

Endpoints declared through `apiGuard()` with a `featureFlag` field are
enabled only when the flag is present.

### API strict mode

`API_STRICT` controls boot-time diagnostics. Default is `true` in production.
Setting it to `false` in production produces a startup warning.

---

## 15. CLI Scripts

All scripts run through `tsx` and use the same configuration as the
application.

| Script                        | Purpose                                           |
| ----------------------------- | ------------------------------------------------- |
| `promoteUser.ts`              | Promote or demote a user by email.                |
| `setupFirstAdmin.ts`          | Run `ensureDeveloperExists()`.                    |
| `seedDefaultData.ts`          | Seed default categories and tags.                 |
| `syncIndexes.ts`              | Synchronise MongoDB indexes across all models.    |
| `cleanupVerificationCodes.ts` | Delete expired and consumed verification codes.   |
| `testMail.ts`                 | Send a test OTP through the configured transport. |

### Usage

```bash
npx tsx backend/src/scripts/promoteUser.ts you@example.com developer "Main administrator"
npx tsx backend/src/scripts/setupFirstAdmin.ts
npx tsx backend/src/scripts/seedDefaultData.ts
npx tsx backend/src/scripts/syncIndexes.ts
npx tsx backend/src/scripts/cleanupVerificationCodes.ts
npx tsx backend/src/scripts/testMail.ts you@example.com
```

---

## 16. Common Tasks

### Change the theme colours

Edit the `--accent` variables in `frontend/public/styles/themes.css`. Each
accent palette is a distinct block selected by `html[data-accent="..."]`.

### Change the brand name

Edit `frontend/views/components/brand.ejs` and the `brandName` parameter
passed by callers. Update `<title>` tags in each EJS page.

### Add a new dashboard page

1. Create `backend/src/routes/pages/xyz.ts` (or extend
   `backend/src/routes/pages/dashboard.ts`).
2. Guard it with `pageAuth` and, if required, `pageAdminGuard` or
   `pageDeveloperGuard`.
3. Create `frontend/views/pages/dashboard/xyz.ejs`.
4. Add the navigation entry to
   `frontend/views/components/dashboard-nav-items.ejs`.
5. Create `frontend/public/js/dashboard/xyz.js`.
6. Create `frontend/public/styles/dashboard/xyz.css`.

### Add a new role

1. Extend the `role` enum in `backend/src/models/User.ts`.
2. Extend `ROLE_RANK` in `backend/src/services/roleService.ts`.
3. Add error codes to `backend/src/utils/errorCodes.ts`.
4. Add guards to `backend/src/middleware/roles.ts`.
5. Update `dashboard-nav-items.ejs` to show or hide sections.
6. Update role badges in
   `frontend/views/components/dashboard-nav.ejs` and in
   `frontend/public/styles/dashboard/dashboard-nav.css`.

### Add a new feature flag

1. Add the flag name to `FEATURE_FLAGS` in the environment.
2. Pass `featureFlag: "flagName"` to `apiGuard()` on the affected endpoints.
3. The manifest at `/api/_meta` will reflect the flag state.

### Re-sync a project with GitHub

```bash
curl -X POST http://localhost:3000/api/v1/projects/<id>/sync-github \
  -b cookies.txt
```

The endpoint requires project ownership. The cached repository metadata has a
15-minute TTL; forcing a sync bypasses the cache.

---

## 17. Known Gaps and Traps

These are situations that are easy to get wrong. Each is a real gap or
inconsistency in the current codebase.

### `tagController.requestTagType` and `createTagType` are not routed

Two controllers are defined but have no route attached:

- `tagController.requestTagType`
- `tagController.createTagType`

The `tagTypeRoutes.ts` file uses `tagController.listTagTypes`,
`getTagType`, `createTagType`, `updateTagType`, `deleteTagType`, and
`approveTagType` — but the `createTagType` in `tagController.ts` is a
different function from the one in `tagTypeController.ts`. The routes use the
`tagController` version. The `/request` endpoint does not exist.

**If you need `/request`, wire it explicitly in `tagTypeRoutes.ts`.**

### `adminRoutes` uses `POST` for mutations

Role changes and ban toggles are `POST`, not `PATCH`:

- `POST /api/v1/admin/users/:id/role`
- `POST /api/v1/admin/users/:id/ban`

Convention would suggest `PATCH`. Do not "fix" this without a coordinated
change to every frontend caller.

### Session reuse, not one session per login

`startSession()` reuses an existing session with the same `deviceHash` if it
has not expired. Logging in from the same device does not create a new
session — it refreshes the existing one. Logging in from a different device
creates a new session. This behaviour is intentional (it keeps the session
list meaningful) but is easy to misread when writing tests.

### The refresh token is not rotated

`POST /api/v1/auth/refresh` issues a new **access** token but does not issue a
new refresh token. The session's `refreshToken` field remains unchanged until
the session expires or is revoked. This is a deliberate trade-off; see
[Authentication and Sessions](#authentication-and-sessions).

### Password change preserves the current session

`confirmPasswordChange` deletes every session **except** the current one. A
user who changes their password stays logged in on the device where they
performed the change. This is not the same as "all sessions closed."

### `emailVerified` is not required for all actions

Registration completes with `emailVerified: false`. Creating a project
requires email verification (`createProject` throws `EMAIL_NOT_VERIFIED`), but
posting comments, leaving reviews, or updating the profile does not. If you
need to change this, check every action individually.

### `attachUserLocals` is not global

`res.locals.currentUser` is only populated where `attachUserLocals` is
explicitly applied. Public pages that render the header (`frontend/views/` page
templates) do not have it. If a template accesses `currentUser` on a page
without the middleware, the value will be `undefined`.

### Strict mode does not block undeclared routes

`API_STRICT=true` produces boot-time warnings for endpoints not declared
through `apiGuard()`. It does not prevent them from being mounted. If an
endpoint needs to be blocked outside the expected environment, use
`apiGuard()` with an `environment` field.

### `MAIL_MODE=log` prints OTPs to the console

This is intentional in development. It is a security risk in any environment
where the console output is captured or forwarded. Verify that
`MAIL_MODE=smtp` in production before any real users register.

### `syncIndexes.ts` may drop indexes

`syncIndexes.ts` calls Mongoose's `syncIndexes()` for every model. On models
whose indexes have drifted, this can drop and recreate them. Run it only
during a maintenance window on production, or after backing up the indexes.

### Rate limiters are in-process

Rate limiting state is held in memory. This is sufficient for a single-process
deployment. Horizontal scaling requires either sticky sessions or a shared
store; neither is currently configured.

### `sitemap.xml` is a redirect

`GET /sitemap.xml` returns a 301 to `/sitemap`. The actual sitemap is
generated at `/sitemap`. This is correct behaviour but is easy to misread if
you expect a static file.

---

## 18. Quick Reference

### Files you will touch most often

| When you need to…                  | Look at                                                                     |
| ---------------------------------- | --------------------------------------------------------------------------- |
| Add or modify an API endpoint      | `backend/src/routes/api/<name>Routes.ts`                                    |
| Register a new route namespace     | `backend/src/api/v1/<name>/router.ts`                                       |
| Add or modify a page               | `backend/src/pages/` and `frontend/views/pages/`                            |
| Add a database field               | `backend/src/models/<Model>.ts`                                             |
| Validate a new payload             | `backend/src/validators/<name>Validator.ts`                                 |
| Add an error code                  | `backend/src/utils/errorCodes.ts`                                           |
| Change the global middleware chain | `backend/src/app.ts`                                                        |
| Change the theme                   | `frontend/public/styles/themes.css`                                         |
| Change dashboard navigation        | `frontend/views/components/dashboard-nav-items.ejs`                         |
| Change role permissions            | `backend/src/middleware/roles.ts` and `backend/src/services/roleService.ts` |
| Add a CLI script                   | `backend/src/scripts/`                                                      |

### Environment variables you will set most often

| Variable       | Common value                               |
| -------------- | ------------------------------------------ |
| `PORT`         | `3000`                                     |
| `MONGODB_URI`  | `mongodb://localhost:27017/devhub`         |
| `JWT_SECRET`   | Output of `openssl rand -hex 32`           |
| `APP_URL`      | `https://devhub.example.com`               |
| `MAIL_MODE`    | `log` (development) or `smtp` (production) |
| `GITHUB_TOKEN` | Optional, but recommended for reliability  |

### Verification commands

```bash
# Type check
npx tsc --noEmit

# Build
npm run build

# Start in development
npm run dev

# Health check
curl http://localhost:3000/api/v1/health

# Manifest
curl http://localhost:3000/api/_meta

# Full manifest (requires developer session)
curl -b cookies.txt http://localhost:3000/api/_meta/full
```

### If you are unsure where to start

1. Read `backend/src/app.ts` to see what is mounted.
2. Read `backend/src/lib/loader.ts` to understand how mounting works.
3. Read the specific route file for the area you are touching.
4. Read the controller and its validator together.
5. Read the corresponding page template in `frontend/views/pages/`.

The codebase is small enough that reading these five files will give you the
context you need for almost any change.

---

**Last reviewed:** 2026
**Maintainer:** [@Sobhan-SRZA](https://github.com/Sobhan-SRZA)
**License:** BSD-3-Clause