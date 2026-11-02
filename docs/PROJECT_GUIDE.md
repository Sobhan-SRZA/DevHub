# Project Guide

> **Comprehensive technical reference for DevHub.**
> This document describes the application's features, architecture, data
> flow, and behaviour at the level of detail required to maintain or extend
> it. It is written for developers who need to understand *what* the system
> does and *how* it does it, not for end users (see `README.md`) or for AI
> agents onboarding to the project (see `docs/AI_GUIDE.md`).

---

## Table of Contents

1. [Project Identity](#1-project-identity)
2. [Feature Catalogue](#2-feature-catalogue)
3. [System Architecture](#3-system-architecture)
4. [Request Lifecycle](#4-request-lifecycle)
5. [Authentication and Sessions](#5-authentication-and-sessions)
6. [Projects](#6-projects)
7. [Reviews](#7-reviews)
8. [Comments](#8-comments)
9. [Tags and Categories](#9-tags-and-categories)
10. [Explore and Ranking](#10-explore-and-ranking)
11. [Home Feed](#11-home-feed)
12. [User Analytics](#12-user-analytics)
13. [Support Tickets](#13-support-tickets)
14. [Administration](#14-administration)
15. [Developer Console](#15-developer-console)
16. [File Uploads](#16-file-uploads)
17. [GitHub Integration](#17-github-integration)
18. [Email Subsystem](#18-email-subsystem)
19. [Frontend Architecture](#19-frontend-architecture)
20. [Theming and Presentation](#20-theming-and-presentation)
21. [Search Engine Optimisation](#21-search-engine-optimisation)
22. [Rate Limiting](#22-rate-limiting)
23. [Spam Detection](#23-spam-detection)
24. [Logging](#24-logging)
25. [Caching](#25-caching)
26. [Configuration Reference](#26-configuration-reference)
27. [Operational Procedures](#27-operational-procedures)
28. [Known Limitations](#28-known-limitations)
29. [Roadmap](#29-roadmap)

---

## 1. Project Identity

| Attribute              | Value                                                   |
| ---------------------- | ------------------------------------------------------- |
| **Name**               | DevHub                                                  |
| **Repository**         | `Sobhan-SRZA/DevHub`                                    |
| **Tagline**            | Discover. Review. Ship.                                 |
| **Purpose**            | Curation, review, and discovery of open-source projects |
| **Type**               | Server-rendered web application with a JSON API         |
| **Audience**           | Developers, project owners, and explorers               |
| **License**            | BSD 3-Clause                                            |
| **Primary maintainer** | Sobhan Rasoulzadeh Asl (Sobhan-SRZA / Mr. Sinre)        |

### Positioning

DevHub sits between three well-known products without being a substitute for
any of them:

| Product            | DevHub's Relationship                                                                                                                      |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| **GitHub**         | Not a replacement for hosting. GitHub repositories remain the canonical source; DevHub surfaces curated metadata and community assessment. |
| **Product Hunt**   | Shares the discovery model but focuses on software quality rather than launch timing.                                                      |
| **Stack Overflow** | Provides structured feedback on projects rather than answers to coding questions.                                                          |

### Core principles

- **Quality over popularity.** The discovery algorithm weights verified
  engagement more heavily than passive signals.
- **Reversibility.** Destructive actions require explicit confirmation.
  Deletions preserve hierarchy where replies exist. Role and email changes
  carry an audit trail.
- **Security by default.** Email verification is mandatory before project
  creation. Every request is validated. Every session is revocable.

---

## 2. Feature Catalogue

The following features are fully implemented in the current codebase.

### 2.1 Authentication

- Registration with mandatory email verification (six-digit OTP)
- Login by email address or username
- Password change requiring the current password and a confirmation OTP
- Password recovery via OTP
- Two-step email change with rollback
- Username change with uniqueness enforcement regardless of casing
- Session management (list, revoke, sign out everywhere)
- Device fingerprinting and geolocation per session
- Banned-account detection on every request

### 2.2 Projects

- Full lifecycle: create, edit, delete, archive
- Image gallery (up to 10), demo video, downloadable archive
- Rich text descriptions in Markdown with a sanitised HTML subset
- Automatic GitHub synchronisation of public metadata
- Tagging from a governed taxonomy
- Draft, published, and archived states, plus a separate visibility flag
- View and download counters
- Featured flag for home-page curation

### 2.3 Reviews

- Rating (0–5) and satisfaction (0–100)
- One review per user per project
- Edit and delete by the author
- Aggregate rating, satisfaction, and count recalculated on every write
- Star distribution histogram
- Helpfulness counter

### 2.4 Comments

- Threaded replies up to five levels
- Likes
- Soft deletion that preserves replies
- Edit tracking
- Authentication required to post

### 2.5 Tags and Categories

- Two-level taxonomy: categories contain tags
- Ten seeded categories with predefined tags
- User-created tags auto-approved (GitHub model)
- System categories protected from deletion
- Per-category configuration: user-tag permission, maximum tag count,
  colour, icon, ordering

### 2.6 Explore

- Hot Score algorithm with configurable decay
- Six sort modes and four time windows
- Category, tag, and text filtering
- Paginated with five-minute server-side caching

### 2.7 Home Feed

- Pre-assembled sections: trending, featured, latest, top-rated, most-downloaded
- Platform statistics: projects, users, tags, downloads
- Five-minute cache

### 2.8 User Analytics

- Profile completeness score
- Community rank with percentile
- Activity timeline over selectable windows
- Recent activity feed
- Achievement milestones

### 2.9 Directories

- Public user directory with search and sort
- Public project directory with search and sort
- Public profile pages with aggregated statistics

### 2.10 Support Tickets

- Public contact form creating a tracked ticket
- Tracking tokens scoped to a single ticket, hashed at rest
- Email-based lookup with OTP verification
- Staff replies with email notification
- Status and priority management
- Assignment to staff
- Automatic account linkage when the ticket email matches a registered user

### 2.11 Administration

- User listing with search and role filter
- Role changes with audit reason
- Ban and unban
- Category approval, editing, and deletion
- Tag approval, editing, and deletion
- Ticket management

### 2.12 Developer Console

- System statistics: process, memory, CPU, OS, database
- Log viewer with filtering, searching, and download
- Detailed health check
- API manifest endpoints

### 2.13 Presentation

- Three display modes: system, light, dark
- Six accent palettes
- Persisted user preferences
- Collapsible dashboard sidebar with keyboard shortcut
- Global search with keyboard shortcut
- Interactive breadcrumb with dropdown menu
- Consistent dialog, confirmation, and toast system

---

## 3. System Architecture

### 3.1 Process model

The application runs as a **single Node.js process** serving both HTML pages
and JSON API endpoints from the same Express instance. There is no separate
API server, no worker process, and no background job queue.

```
┌───────────────────────────────────────────────────────────────┐
│                        Node.js Process                        │
│                                                               │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │                   Express Application                    │  │
│  │                                                          │  │
│  │  Security → Compression → Parsers → Rate limiter         │  │
│  │  → Static → Route loader → Controllers → Services        │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────┐   │
│  │  Logger      │  │  In-memory   │  │  Mail transport   │   │
│  │  (daily file)│  │  cache       │  │  (log | smtp)     │   │
│  └──────────────┘  └──────────────┘  └───────────────────┘   │
└───────────────────────────────────────────────────────────────┘
          │                    │                    │
          ▼                    ▼                    ▼
    ┌──────────┐        ┌────────────┐       ┌─────────────┐
    │ MongoDB  │        │ GitHub API │       │ SMTP server │
    └──────────┘        └────────────┘       └─────────────┘
```

### 3.2 Layered responsibilities

| Layer                  | Responsibility                                   | Location                                     |
| ---------------------- | ------------------------------------------------ | -------------------------------------------- |
| **Entry points**       | Process startup, Express assembly                | `backend/src/index.ts`, `backend/src/app.ts` |
| **Route entry points** | Re-export routers to be auto-mounted             | `backend/src/api/`, `backend/src/pages/`     |
| **Routers**            | Endpoint declaration, middleware composition     | `backend/src/routes/`                        |
| **Controllers**        | Request parsing, orchestration, response shaping | `backend/src/controllers/`                   |
| **Services**           | Business logic, external calls, aggregation      | `backend/src/services/`                      |
| **Models**             | Schema, indexes, hooks, methods                  | `backend/src/models/`                        |
| **Middleware**         | Cross-cutting concerns                           | `backend/src/middleware/`                    |
| **Validators**         | Input schemas                                    | `backend/src/validators/`                    |
| **Utilities**          | Pure helpers, error classes, tokens              | `backend/src/utils/`                         |
| **Configuration**      | Environment, database, upload, registry          | `backend/src/config/`                        |

### 3.3 Dependency direction

Dependencies flow downward, never upward:

```
Route → Middleware → Controller → Service → Model → MongoDB
```

- Controllers may call services and models directly.
- Services may call models and other services.
- Models may call only MongoDB.
- **No service imports `express`.**
- **No model imports a service.**

### 3.4 External dependencies

| Service            | Purpose             | Failure behaviour                                                                                    |
| ------------------ | ------------------- | ---------------------------------------------------------------------------------------------------- |
| **MongoDB**        | Persistent storage  | Process exits at startup if unreachable.                                                             |
| **GitHub API**     | Repository metadata | Cached; failures degrade gracefully to the last cached value.                                        |
| **SMTP server**    | Email delivery      | Verification codes are not delivered, but the account is created; the user may request another code. |
| **GeoIP provider** | Session geolocation | Failures return IP-only location.                                                                    |

---

## 4. Request Lifecycle

Every HTTP request passes through the same sequence of middleware before
reaching a controller. The order is significant.

### 4.1 Global middleware

Registered in `backend/src/app.ts`:

| Order | Middleware                             | Purpose                                                              |
| ----- | -------------------------------------- | -------------------------------------------------------------------- |
| 1     | `initializeEnvironment()`              | Resolves `APP_ENV`, validates production config, loads feature flags |
| 2     | `trust proxy`                          | Enabled when `TRUST_PROXY=1` or `NODE_ENV=production`                |
| 3     | `x-powered-by` removal                 | Removes a fingerprinting header                                      |
| 4     | `rejectSuspiciousPaths`                | Rejects `\0`, `%00`, and `../` before routing                        |
| 5     | `securityHeaders()`                    | CSP, HSTS, X-Frame-Options, Referrer-Policy, Permissions-Policy      |
| 6     | `compressionMiddleware()`              | Response compression                                                 |
| 7     | `express.json({ limit: "2mb" })`       | JSON body parsing                                                    |
| 8     | `express.urlencoded({ limit: "2mb" })` | Form body parsing                                                    |
| 9     | `cookieParser()`                       | Cookie parsing                                                       |
| 10    | `apiLimiter` on `/api`                 | Global API rate limiter                                              |
| 11    | EJS view engine setup                  | Templates at `frontend/views`                                        |
| 12    | `express.static("/public")`            | Frontend assets with cache headers                                   |
| 13    | `express.static("/uploads")`           | Uploaded files with hardened headers                                 |
| 14    | `GET /sitemap.xml` redirect            | 301 to `/sitemap`                                                    |
| 15    | Route loader                           | Mounts `pages/` and `api/`                                           |
| 16    | 404 handler                            | JSON for `/api/*`, HTML otherwise                                    |
| 17    | `errorHandler`                         | Centralised error translation                                        |

### 4.2 Route-level middleware

Individual routers apply additional middleware in a consistent order:

```
router.<method>(
  path,
  <auth>          requireAuth / optionalAuth / requireAdmin / requireDeveloper
  <ownership>     requireProjectOwnership / requireTagOwnership / loadProject
  <cache>         noCache
  <rate limit>    apiRateLimit(visibility, override?)
  <guard>         apiGuard({ path, method, visibility, ... })
  <upload>        mwUploadImages / mwUploadVideo / mwUploadZip / mwUploadAvatar
  <handler>       Controller function
)
```

**Order rationale:**

- Authentication before ownership: ownership requires `req.user`.
- Ownership before rate limiting: ownership short-circuits with 404, which
  should not consume the user's quota for legitimate access.
- Rate limiting before the guard: guards short-circuit disabled endpoints,
  and calls to disabled endpoints should still count against quota.
- Guards before uploads: an upload to a disabled endpoint must not write
  files to disk.

### 4.3 Controller execution

Every controller handler is wrapped in `asyncHandler`, which:

1. Executes the handler.
2. Catches synchronous throws and forwards to `next(err)`.
3. Catches rejected promises and forwards to `next(err)`.
4. Skips forwarding if `res.headersSent` is true, preventing double-response
   errors.

### 4.4 Error propagation

Errors thrown by controllers reach `errorHandler`, which translates:

| Error type                    | Response                                            |
| ----------------------------- | --------------------------------------------------- |
| `AppError`                    | Its `statusCode` and serialized body                |
| `ZodError`                    | 400 `VALIDATION_ERROR` with per-field details       |
| MongoDB duplicate key (11000) | 409 `USERNAME_TAKEN` or `EMAIL_TAKEN`               |
| Mongoose `ValidationError`    | 400 `VALIDATION_ERROR` with per-field details       |
| Mongoose `CastError`          | 400 `VALIDATION_ERROR` with the offending field     |
| `JsonWebTokenError`           | 401 `INVALID_TOKEN`                                 |
| `TokenExpiredError`           | 401 `SESSION_EXPIRED`                               |
| `ECONNREFUSED`, `ETIMEDOUT`   | 503 `NETWORK_ERROR`                                 |
| Unhandled                     | 500 `INTERNAL_ERROR` (message hidden in production) |

---

## 5. Authentication and Sessions

### 5.1 Account creation

Registration creates the user document with `emailVerified: false` and
immediately issues a six-digit verification code. **No session is issued at
registration.** The response contains a signed `verifyToken` and the
verification email is dispatched asynchronously.

Registration completes only after `POST /api/v1/auth/verify-email` succeeds.
At that point, the user's `emailVerified` flag is set and a session is created.

The first registered user receives the `developer` role. This is enforced by
`shouldBecomeDeveloper()` in `roleService.ts`, which returns `true` when no
developer account exists.

### 5.2 Session model

A session document stores:

| Field                                  | Purpose                                               |
| -------------------------------------- | ----------------------------------------------------- |
| `sessionId`                            | Random 32-character hex; embedded in the JWT as `sid` |
| `deviceHash`                           | SHA-256 of `userAgent + "                             | " + (fingerprint or deviceId or "")` |
| `token`                                | Current access token                                  |
| `refreshToken`                         | Current refresh token (`select: false`)               |
| `device`                               | Parsed User-Agent (type, OS, browser, engine)         |
| `location`                             | IP, country, region, city, ISP (from GeoIP)           |
| `client`                               | Fingerprint, deviceId, MAC address (if provided)      |
| `loginAt`, `lastActiveAt`, `expiresAt` | Timestamps                                            |

### 5.3 Session creation and reuse

`startSession()` in `sessionService.ts` performs the following:

1. Build metadata from the request (User-Agent parsing and GeoIP lookup in
   parallel, each independently tolerant of failure).
2. Compute `deviceHash`.
3. Look for an existing session with the same `user` and `deviceHash` that
   has not expired.
4. If found, **reuse** the session ID and update the metadata, timestamps, and
   tokens. Return `{ reused: true }`.
5. If not found, create a new session with a fresh `sessionId`.
6. Sign a new access token and a new refresh token with the same `sid`.
7. Persist `token` and `refreshToken` on the session.

**Reuse is intentional.** Logging in from the same device does not create a
new session — it refreshes the existing one. Logging in from a different
device creates a new session. This keeps the session list meaningful and
prevents users from accumulating dozens of sessions over time.

### 5.4 Token structure

Access tokens, refresh tokens, and the two verification tokens share a
common structure:

```json
{ "sub": "<userId>", "sid": "<sessionId>", "typ": "access" | "refresh", "iat": ..., "exp": ... }
```

Verification tokens differ:

| Token type       | Payload               | Lifetime                          | Issued by                |
| ---------------- | --------------------- | --------------------------------- | ------------------------ |
| `access`         | `sub`, `sid`, `typ`   | `JWT_EXPIRES_IN` (default 7 days) | `signAccessToken`        |
| `refresh`        | `sub`, `sid`, `typ`   | Fixed 30 days                     | `signRefreshToken`       |
| `email_verify`   | `sub`, `email`, `typ` | 1 hour                            | `signEmailVerifyToken`   |
| `password_reset` | `sub`, `email`, `typ` | 15 minutes                        | `signPasswordResetToken` |

The `typ` claim is checked by `verifyToken`-based middleware. A refresh token
presented as an access token is rejected by `requireAuth`.

### 5.5 Request authentication

`requireAuth` (in `middleware/auth.ts`):

1. Reads `req.cookies.access_token`.
2. Falls back to `Authorization: Bearer <token>` if the cookie is absent.
3. Verifies the JWT signature and expiration.
4. Confirms `payload.typ === "access"`.
5. Looks up the session by `{ sessionId: payload.sid, expiresAt: { $gt: now } }`.
6. Looks up the user by `payload.sub` with `-password` projection.
7. Rejects if the user is banned.
8. Attaches `req.user` and `req.session`.
9. Updates `session.lastActiveAt` asynchronously (non-blocking).

**The session lookup is mandatory.** A syntactically valid JWT is insufficient.
The session document must exist and must not have expired. This is the
mechanism that enables immediate revocation.

### 5.6 Refresh flow

`POST /api/v1/auth/refresh`:

1. Reads `req.cookies.refresh_token`.
2. Verifies the JWT and confirms `typ === "refresh"`.
3. Looks up the session by `{ sessionId, refreshToken, expiresAt > now }`.
4. Signs a new access token.
5. Updates `session.token` and `session.lastActiveAt`.
6. Returns the new access token and sets a fresh `access_token` cookie.

**The refresh token is not rotated.** The existing refresh token remains valid
until the session expires or is revoked. Rotation was considered but rejected:
it complicates concurrent requests during a token refresh, and the security
benefit is marginal when the session itself is stored server-side and can be
revoked on demand.

### 5.7 Revocation paths

| Trigger                            | Sessions deleted                                              |
| ---------------------------------- | ------------------------------------------------------------- |
| `POST /api/v1/auth/logout`         | Current session only                                          |
| `POST /api/v1/auth/logout-all`     | All sessions for the user                                     |
| Password change                    | All sessions **except the current one**                       |
| Password reset                     | All sessions                                                  |
| `DELETE /api/v1/auth/sessions/:id` | The specified session                                         |
| Account ban                        | All sessions (enforced via `isBanned` check on every request) |

**The current session is preserved on password change.** This is intentional:
a user who changes their password on a laptop should not be logged out of that
laptop. Every other device loses access.

### 5.8 Email verification flow

```
POST /api/v1/auth/register
  ↓ User created (emailVerified: false), OTP dispatched
  ↓ verifyToken returned in response
  ↓ No session

User opens /auth/verify-email and enters the code

POST /api/v1/auth/verify-email { verifyToken, code }
  ↓ Token verified, code verified
  ↓ emailVerified = true
  ↓ Session created
  ↓ Access + refresh cookies set
  ↓ Redirect to /dashboard
```

If session creation fails (for example, database error), the email is still
marked verified. The user can log in manually with their existing password.

### 5.9 Email change flow

Three states, enforced by the `pendingEmail` subdocument on the user.

**State A — Request**

```
POST /api/profile/email/request { newEmail, password }
  → Password verified
  → OTP dispatched to the CURRENT email
  → pendingEmail = { newEmail, previousEmail, oldVerified: false, expiresAt }
```

**State B — Verify old email**

```
POST /api/profile/email/verify-old { code }
  → OTP from the CURRENT email verified
  → New email availability rechecked
  → user.email = newEmail
  → user.emailVerified = false
  → OTP dispatched to the NEW email
  → pendingEmail.oldVerified = true
  → verifyToken returned for /auth/verify-email
```

**State C — Verify new email**

```
POST /api/v1/auth/verify-email { verifyToken, code }
  → OTP from the NEW email verified
  → user.emailVerified = true
  → pendingEmail = null
```

**Rollback.** `DELETE /api/profile/email/pending` reverts the change:

- If `oldVerified === false`, the pending request is discarded.
- If `oldVerified === true`, the user's email is restored to
  `pendingEmail.previousEmail` and `emailVerified` is set to `true`.

Pending verification codes for `change_email_old` and `verify_email` purposes
are deleted on cancellation.

### 5.10 Password change flow

Two steps: request and confirm.

**Request**

```
POST /api/profile/password/request { currentPassword, newPassword, confirmPassword }
  → Current password verified
  → New password meets policy (8+ characters, mixed case, digit)
  → New password differs from current password
  → OTP dispatched to the CURRENT email
```

**Confirm**

```
POST /api/profile/password/confirm { code, newPassword, confirmPassword }
  → OTP verified
  → user.password = newPassword (rehashed by pre-save hook)
  → All OTHER sessions deleted
  → Current session preserved
```

### 5.11 Password reset flow

```
POST /api/v1/auth/forgot-password { email }
  → If user exists, OTP dispatched
  → resetToken signed (15-minute TTL)
  → Response is uniform whether or not the user exists

POST /api/v1/auth/reset-password { resetToken, code, newPassword, confirmPassword }
  → Token verified, code verified
  → New password rehashed
  → ALL sessions deleted
```

---

## 6. Projects

### 6.1 Project structure

A project document contains:

- **Identity** — owner, title, slug (unique), status, visibility, featured flag
- **Descriptions** — short description (≤500 characters), full description
  (Markdown, unlimited)
- **Media** — images array (≤10), demo video, downloadable archive
- **GitHub** — URL, parsed repository identifier, metadata snapshot, last
  sync timestamp, auto-sync flag
- **Statistics** — rating, satisfaction, review count, downloads, views
- **Tags** — array of tag references (≤20)

### 6.2 Creation

`POST /api/v1/projects` requires:

- Authenticated session
- `emailVerified === true` (otherwise 403 `EMAIL_NOT_VERIFIED`)
- Valid payload per `createProjectSchema`
- Unique slug (generated from title if not provided)
- Unique GitHub repository (no two projects may link the same repository)
- All referenced tags must exist
- Both descriptions pass spam detection

On success, an initial GitHub sync is attempted synchronously. If the sync
fails, the project is still created; the response includes the project but
without metadata. A warning is logged.

### 6.3 Slug management

Slugs are generated from the title with the following transformation:

```
lowercase → replace non-alphanumeric with "-" → collapse hyphens → trim → truncate to 80
```

An empty slug falls back to `project-<timestamp>`.

Slugs are unique. `updateProject` regenerates the slug when the title changes
unless an explicit slug is provided. The uniqueness check excludes the current
project.

### 6.4 Status and visibility

Two orthogonal fields:

| Field      | Values                           | Effect                             |
| ---------- | -------------------------------- | ---------------------------------- |
| `status`   | `draft`, `published`, `archived` | Affects public listings and search |
| `isPublic` | `true`, `false`                  | Independent access control         |

**Access rules:**

- `published` + `isPublic: true` → visible to everyone
- `published` + `isPublic: false` → visible to owner, admins, and developers
- `draft` or `archived` → visible to owner, admins, and developers regardless
  of `isPublic`

`loadProject` enforces these rules before any mutation.

### 6.5 Media management

| Media type | Storage path                           | Size limit | Count limit |
| ---------- | -------------------------------------- | ---------- | ----------- |
| Images     | `uploads/projects/images/<projectId>/` | 5 MB each  | 10          |
| Video      | `uploads/projects/videos/<projectId>/` | 200 MB     | 1           |
| Archive    | `uploads/projects/files/<projectId>/`  | 500 MB     | 1           |

Filenames are generated as `<timestamp>-<12-random-bytes>.<ext>`. The original
filename is preserved in the document for display purposes but is not used for
storage.

The first image by `order` is the cover. Reordering changes which image is the
cover without re-uploading.

**Image reorder.** `PATCH /api/v1/projects/:id/images/order` accepts an array
of image IDs in the desired order. Missing IDs retain their existing order.
IDs not belonging to the project are ignored.

### 6.6 Deletion

`DELETE /api/v1/projects/:id`:

1. Decrements usage counts for all associated tags.
2. Deletes all uploaded files for the project (images, video, archive).
3. Deletes all associated reviews and comments.
4. Deletes the project document.

This is a hard delete. There is no soft-delete path for projects.

### 6.7 Download

`GET /api/v1/projects/:idOrSlug/download`:

1. Increments the project-level `downloads` counter.
2. Increments the file-level `downloads` counter.
3. Sets `Content-Disposition: attachment; filename*=UTF-8''<encoded>`.
4. Redirects to the file's public URL.

The endpoint does not require authentication. It is rate-limited to 20
requests per minute per IP.

---

## 7. Reviews

### 7.1 Model

Each review belongs to exactly one project and one user. The compound unique
index on `{ project, user }` enforces this at the database level.

Fields: `rating` (0–5, may be fractional), `satisfaction` (0–100),
`title` (≤100 characters), `body` (≤3000 characters), `isEdited`, `editedAt`,
`helpfulCount`.

### 7.2 Constraints

- **One review per user per project.** Attempting to submit a second review
  returns 409 `REVIEW_ALREADY_EXISTS`.
- **Owners cannot review their own projects.** Attempting returns 403
  `CANNOT_REVIEW_OWN`.
- **Only the author may edit or delete.** Update and delete operations look up
  the review by `{ project, user }`, not by ID, which prevents a user from
  modifying another user's review even if they know its ID.

### 7.3 Aggregation

Every create, update, or delete triggers `recalculateProjectStats` in
`ratingService.ts`, which recomputes:

- `rating` — average of all `rating` values, rounded to one decimal place
- `satisfaction` — average of all `satisfaction` values, rounded to nearest integer
- `reviewCount` — total number of reviews

These values are stored on the project document. Aggregation happens via a
single MongoDB `$group` per write.

### 7.4 Listing

`GET /api/v1/projects/:idOrSlug/reviews` returns:

- Paginated list of reviews with populated user information
- Star distribution histogram
- Summary (average rating, average satisfaction, total count)
- `myReview` — the current user's review for this project, if any

The distribution is computed by a separate aggregation in the same request.
It reports counts per integer star value; fractional ratings are floored for
the purposes of the histogram.

### 7.5 Helpfulness

`POST /api/v1/projects/:idOrSlug/reviews/:id/helpful` increments
`helpfulCount`. It does not track who marked a review as helpful, so the same
user may increment the count multiple times. This is a known limitation;
tracking individual helpfulness votes would require an additional collection.

---

## 8. Comments

### 8.1 Threading model

Comments form a tree with a maximum depth of five levels:

- Level 0: root comments
- Levels 1–4: replies
- Level 5: cannot receive further replies

Each comment stores its `parent` (null for root) and `depth` (0 for root,
`parent.depth + 1` for replies).

### 8.2 Listing

`GET /api/v1/projects/:idOrSlug/comments`:

- Without `parentId`: returns paginated root comments, each with its direct
  replies attached as a nested array.
- With `parentId`: returns all direct replies to that parent.

Replies are fetched in a single batched query per page, not per root comment.
The grouping happens in memory after the query.

### 8.3 Deletion semantics

Comments with replies are **soft-deleted**:

- `isDeleted` is set to `true`
- `body` is replaced with `"[This comment has been deleted]"`
- `deletedAt` is set to the current timestamp
- The document remains, preserving the reply hierarchy

Comments without replies are **hard-deleted**:

- The document is removed
- The parent's `replyCount` is decremented

This asymmetry ensures that deleting a root comment does not orphan dozens of
replies, while deleting a leaf comment does not leave empty documents behind.

### 8.4 Likes

`POST /api/v1/projects/:idOrSlug/comments/:id/like` is a toggle:

- If the current user is already in `likes`, they are removed
- Otherwise, they are added
- The response includes `liked` (boolean) and `likesCount` (number)

Likes are stored as an array of user IDs on the comment document. This does
not scale indefinitely — a comment with thousands of likes becomes unwieldy.
For the current scale, it is sufficient.

### 8.5 IDOR protection

`assertCommentBelongsToProject` in `commentController.ts` verifies that the
comment identified by `req.params.id` belongs to the project identified by
`req.params.idOrSlug`. Without this check, a caller could mutate a comment
from another project by crafting a URL with a mismatched project and comment
ID.

Every mutating comment endpoint calls this check first.

---

## 9. Tags and Categories

### 9.1 Two-level taxonomy

```
Category (TagType)
  ├── Tag
  ├── Tag
  └── Tag
```

A category represents a thematic group such as *Programming Language* or
*DevOps*. A tag is a concrete value within a category such as *TypeScript* or
*Kubernetes*.

### 9.2 Category configuration

| Field                         | Purpose                                                     |
| ----------------------------- | ----------------------------------------------------------- |
| `name`, `slug`, `description` | Identity                                                    |
| `color`, `icon`, `order`      | Presentation                                                |
| `isSystem`                    | System categories cannot be deleted through the API         |
| `isApproved`                  | Unapproved categories are invisible to the public           |
| `allowUserTags`               | Whether non-administrators may create tags in this category |
| `maxTags`                     | Optional ceiling on the number of tags in the category      |

### 9.3 Seeded taxonomy

`seedDefaultData.ts` creates ten categories on first run:

| Slug                   | Name                    | Allow user tags |
| ---------------------- | ----------------------- | :-------------: |
| `programming-language` | Programming Language    |       No        |
| `framework`            | Framework               |       Yes       |
| `database`             | Database                |       Yes       |
| `seo`                  | SEO                     |       Yes       |
| `devops`               | DevOps                  |       Yes       |
| `ai`                   | Artificial Intelligence |       Yes       |
| `mobile`               | Mobile Development      |       Yes       |
| `security`             | Security                |       Yes       |
| `design`               | Design                  |       Yes       |
| `general`              | General                 |       Yes       |

Each category is seeded with a predefined set of tags. The seed is idempotent;
existing records are not duplicated.

### 9.4 User-created tags

`POST /api/v1/tags/find-or-create` resolves a tag by name within a category,
creating it if it does not exist:

- If `type` is provided, the tag is looked up within that category.
- If `type` is absent, the `general` category is used (created on first use if
  missing).
- If the category does not permit user tags (`allowUserTags: false`), the
  request is rejected unless the caller is an administrator or developer.
- If the category has reached `maxTags`, the request is rejected.
- New tags are created with `isApproved: true` — user tags are auto-approved,
  following the GitHub model.

If a tag with the same slug already exists in the category, the existing tag
is returned with `created: false`. This is safe to call repeatedly.

### 9.5 Usage counting

Each project that references a tag increments that tag's `usageCount`. On
project deletion, the count is decremented. If a project removes a tag, the
removed tag's count is decremented.

Tag deletion is blocked when `usageCount > 0` or when any project references
the tag. The check uses `Project.countDocuments({ tags: tag._id })` rather than
relying solely on the stored counter, because the counter is susceptible to
drift if a write fails partway through.

### 9.6 Pending content

`GET /api/v1/tags/pending` (admin+) returns unapproved tags and categories.
This endpoint is used by the administration panel to review user-submitted
content.

Categories submitted for approval are not visible in public listings until
approved. Unapproved tags are not associated with a category that permits them
unless the category itself is approved.

**Current gap:** The `/api/v1/tag-types/request` endpoint described in older
documentation does not exist in the current codebase. The controller function
`tagController.requestTagType` is defined but no route references it. If
category requests are needed, the route must be wired explicitly in
`tagTypeRoutes.ts`.

---

## 10. Explore and Ranking

### 10.1 Hot Score

The explore feed ranks projects by a time-decayed score inspired by Hacker
News.

**Base score:**

```
points =  1.0 × stars
       +  2.5 × forks
       +  0.3 × downloads
       +  0.01 × views
       +  5.0 × rating
       +  4.0 × reviewCount
       + 10 if images exist
       + 10 if a demo video exists
       +  5 if a downloadable file exists
```

**Decayed score:**

```
ageHours = (now - createdAt) / 3_600_000
hotScore = points / (ageHours + 2) ^ gravity
```

**Gravity by window:**

| Window | Gravity | Effect                                           |
| ------ | :-----: | ------------------------------------------------ |
| `24h`  |   1.5   | Steep decay; only very recent projects rank well |
| `7d`   |   1.8   | Balanced; default for `trending`                 |
| `30d`  |   2.0   | Sharper decay over a longer period               |
| `all`  |   0.0   | No decay; cumulative ranking                     |

The `+2` offset in the denominator prevents division by zero and reduces the
extreme scores assigned to projects created seconds ago.

### 10.2 Implementation

The ranking is computed entirely in MongoDB using an aggregation pipeline.
The pipeline:

1. Matches projects by `status: "published"` and `isPublic: true`.
2. Applies optional tag, tag-type, and text filters.
3. Computes `_ageHours` and `_points` in the pipeline.
4. Computes `_hotScore` using the gravity constant for the requested window.
5. Sorts by `_hotScore` descending, then `createdAt` descending as a tiebreaker.
6. Applies pagination.
7. Populates owner and tags after the pipeline completes.

For non-Hot-Score sorts (`top-rated`, `top-downloaded`, `new`), the pipeline is
simplified to a direct sort.

### 10.3 Sort modes

| Sort             | Ranked by                         | Default window |
| ---------------- | --------------------------------- | -------------- |
| `trending`       | Hot Score                         | `7d`           |
| `hot`            | Hot Score                         | `24h`          |
| `top-rated`      | `rating` desc, `reviewCount` desc | —              |
| `top-downloaded` | `downloads` desc                  | —              |
| `new`            | `createdAt` desc                  | —              |
| `top`            | `rating` desc, `reviewCount` desc | —              |

### 10.4 Caching

The complete explore result is cached for five minutes per parameter
combination. Cache keys are JSON-stringified query objects. The response
includes `cached: true` when served from cache.

Cache is in-memory and per-process. It is not shared across instances and does
not survive a restart. Cache invalidation is by TTL only — creating or deleting
a project does not proactively clear cache entries. This is acceptable for the
current scale; a Redis-backed cache with tag-based invalidation is planned.

---

## 11. Home Feed

### 11.1 Structure

`GET /api/v1/projects/home-feed` returns:

```json
{
  "sections": {
    "trending":     { "title": "...", "subtitle": "...", "projects": [...] },
    "featured":     { ... },
    "newProjects":  { ... },
    "topRated":     { ... },
    "topDownloaded":{ ... }
  },
  "stats": {
    "projects": 1234,
    "users": 5678,
    "tags": 90,
    "downloads": 123456
  }
}
```

### 11.2 Section sources

| Section         | Source                                                                     | Limit |
| --------------- | -------------------------------------------------------------------------- | ----- |
| `trending`      | Explore with `sort: "trending"`, `window: "7d"`                            | 8     |
| `featured`      | Projects with `featured: true`, sorted by `featuredOrder` then `updatedAt` | 6     |
| `newProjects`   | Explore with `sort: "new"`                                                 | 6     |
| `topRated`      | Explore with `sort: "top-rated"`                                           | 6     |
| `topDownloaded` | Explore with `sort: "top-downloaded"`                                      | 6     |

### 11.3 Platform statistics

Four aggregate counters are computed in parallel:

- `projects`: published, public projects
- `users`: total user count (including banned)
- `tags`: approved tags
- `downloads`: sum across all published, public projects

### 11.4 Caching

The response is cached for five minutes under the key `home:feeds`. Cache
behaviour is identical to the explore feed: in-memory, TTL-based, per-process.

---

## 12. User Analytics

### 12.1 Endpoint

`GET /api/v1/users/me/stats?range=<7d|30d|90d|1y>` (authenticated).

### 12.2 Response

```json
{
  "ok": true,
  "range": "30d",
  "stats": {
    "user": {
      "id": "...",
      "name": "...",
      "username": "...",
      "joinedAt": "...",
      "profileCompleteness": 72,
      "rank": { "position": 34, "total": 1200, "percentile": 97 }
    },
    "summary": {
      "projects": { "total": 5, "published": 3, "drafts": 1, "archived": 1 },
      "downloads": { "total": 450 },
      "stars": { "total": 120 },
      "views": { "total": 3400 },
      "reviews": { "received": 12, "averageRating": 4.25 },
      "comments": { "sent": 8, "received": 23 },
      "likes": { "receivedOnProjects": 0, "receivedOnComments": 15 }
    },
    "timeline": [ { "date": "2026-01-01", "projects": 0, "reviewsReceived": 1, "commentsReceived": 0, "likesReceived": 0 }, ... ],
    "recentActivity": [ ... ],
    "milestones": [ ... ]
  }
}
```

### 12.3 Profile completeness

A score out of 100, computed from:

| Criterion                      | Points |
| ------------------------------ | :----: |
| Name present                   |   10   |
| Username present               |   10   |
| Email verified                 |   15   |
| Bio present and ≥20 characters |   20   |
| Avatar present                 |   25   |
| At least one published project |   20   |

### 12.4 Community rank

Computed by aggregating every user's projects:

```
score = publishedProjectCount × 10 + totalStars + (totalDownloads / 10)
```

Users are sorted by score descending. The current user's position determines
their rank; percentile is calculated as
`(totalUsers - position) / (totalUsers - 1) × 100`.

### 12.5 Timeline

Daily buckets are computed for four event types over the selected range:

- Projects created
- Reviews received on the user's projects
- Comments received on the user's projects
- Likes received on the user's comments

The response contains one entry per day, including days with zero events, so
the client can plot a continuous line without gap-filling.

**Note:** Views and downloads are cumulative on the project document and have
no per-day breakdown. Historical daily view and download data would require a
snapshot table, which is not implemented.

### 12.6 Milestones

Six milestones are tracked:

| Key                 | Label                        | Achieved when      |
| ------------------- | ---------------------------- | ------------------ |
| `first_project`     | Published your first project | `published >= 1`   |
| `first_review`      | Received your first review   | `reviewCount >= 1` |
| `first_star`        | Earned a GitHub star         | `stars >= 1`       |
| `ten_stars`         | Earned 10 stars              | `stars >= 10`      |
| `hundred_downloads` | Reached 100 downloads        | `downloads >= 100` |
| `five_projects`     | Published five projects      | `published >= 5`   |

Achievement timestamps are populated only where available from existing
documents; the current implementation returns `null` for several milestones
because the historical moment of achievement is not recorded.

---

## 13. Support Tickets

### 13.1 Ticket creation

`POST /api/v1/contact` creates a ticket from the public contact form.

**Rate limits:**

- One ticket per email address every 2 minutes
- One ticket per IP address every 5 minutes

**Priority inference:**

| Category        | Priority |
| --------------- | -------- |
| `security`      | `urgent` |
| `bug`           | `high`   |
| Everything else | `normal` |

**Ticket number generation:** `TKT-<YYYYMM>-<time-base36><random>` with a
unique index as a safety net against collisions.

**Tracking token:** 32 random bytes, hex-encoded. The raw token is included
in the confirmation email; only its SHA-256 hash is stored on the ticket.

### 13.2 Tracking

`GET /api/v1/tickets/track/:token` resolves the ticket by hashing the raw
token and comparing to `trackingTokenHash`. Tokens expire after 30 days and
can be revoked by setting `trackingRevoked: true`.

Users can reply via `POST /api/v1/tickets/track/:token/reply`. Replies reopen
resolved or closed tickets.

### 13.3 Email-based lookup

For users who have lost their tracking email:

1. `POST /api/v1/tickets/lookup { email }` — issues a six-digit OTP to the
   address. Response is uniform regardless of whether any tickets exist.
2. `POST /api/v1/tickets/lookup/verify { email, code }` — verifies the OTP and
   returns the list of tickets, each with a freshly issued tracking token.

**Lookup OTP parameters:**

| Parameter     | Value                               |
| ------------- | ----------------------------------- |
| Length        | 6 digits                            |
| Hash input    | `email + ":" + code`                |
| Storage       | SHA-256 hash on the ticket document |
| TTL           | 15 minutes                          |
| Attempt limit | 5 per code                          |

The OTP is stored on **every** ticket with the matching email. This means the
same code works across the user's tickets and is invalidated on any of them
after use.

### 13.4 Account linkage

`linkTicketsToUser(userId, email)` is called on registration and on login. It
links any tickets whose `email` matches the user's email and whose `userId` is
`null`. This allows users to see tickets they submitted before registering.

### 13.5 Staff workflow

Admin endpoints:

- `GET /api/v1/tickets` — paginated list with filters
- `GET /api/v1/tickets/:id` — full thread
- `POST /api/v1/tickets/:id/reply` — post a reply, dispatch email to the author
- `PATCH /api/v1/tickets/:id` — update status, priority, or assignee

Replies from staff reopen resolved or closed tickets and assign the ticket to
the responding staff member if it is not already assigned.

### 13.6 Message threading

Messages are stored as a subdocument array on the ticket, with `author`
(`"user"` or `"staff"`), `authorId`, `authorName`, `body`, and `createdAt`.
The initial submission is stored as the first message.

---

## 14. Administration

### 14.1 Access

All admin endpoints are protected by `requireAuth` + `requireAdmin`.
The `requireAdmin` guard accepts both `admin` and `developer` roles.

### 14.2 User management

**Listing** (`GET /api/v1/admin/users`):

- Supports search across name, username, and email
- Supports role filter
- Returns paginated results with `name`, `username`, `email`, `role`,
  `avatar`, `createdAt`, `isBanned`

**Role change** (`POST /api/v1/admin/users/:id/role`):

- Rules are enforced by `changeUserRole` in `roleService.ts`:
  - Users cannot change their own role.
  - Only developers may assign the `developer` role.
  - Administrators cannot modify developer-level accounts.
- The change is recorded with `roleChangedBy`, `roleChangedAt`, and
  `roleChangeReason`.

**Ban toggle** (`POST /api/v1/admin/users/:id/ban`):

- Users cannot ban themselves.
- Only developers may ban developer accounts.
- Banned users are rejected on login and on every authenticated request.

### 14.3 Category management

- `GET /api/v1/tag-types` — public listing of approved categories
- `POST /api/v1/tag-types` — create a category (admin)
- `PUT /api/v1/tag-types/:id` — update a category (admin)
- `DELETE /api/v1/tag-types/:id` — delete an empty category (admin)
- `POST /api/v1/tag-types/:id/approve` — approve a pending category (admin)

System categories (`isSystem: true`) cannot be deleted.

### 14.4 Tag management

- `GET /api/v1/tags/pending` — list unapproved tags and categories (admin)
- `POST /api/v1/tags/:id/approve` — approve a tag (admin)
- `PUT /api/v1/tags/:id` — update a tag (owner or admin)
- `DELETE /api/v1/tags/:id` — delete an unused tag (owner or admin)

Tag deletion is blocked while any project references the tag.

---

## 15. Developer Console

Access requires the `developer` role specifically (not just admin).

### 15.1 System statistics

`GET /api/v1/system/stats` returns:

- **Process** — PID, uptime, Node.js version, platform, architecture,
  environment, working directory, and version metadata for Node, V8, and
  OpenSSL
- **Memory** — RSS, heap total, heap used, external, array buffers, and
  system-level totals and free memory
- **CPU** — core count, model, speed, and load averages
- **OS** — platform, release, hostname, type
- **Database** — connection status, name, host, port, collection count,
  collection names, document count, data size, storage size, index count,
  average document size
- **Logs** — buffer size and available log files

### 15.2 Log viewer

`GET /api/v1/system/logs` returns entries from either the in-memory buffer
(`file=live`, the default) or a specific daily log file (`file=app-YYYY-MM-DD.log`).

Query parameters:

- `limit` — capped at 1000, default 200
- `level` — `debug`, `info`, `warn`, `error`, or empty for all
- `search` — case-insensitive substring match on the message
- `file` — specific file name or `live`

The response includes:

- `entries` — the filtered entries
- `stats` — per-level counts in the in-memory buffer
- `files` — available log files
- `source` — the file the entries were read from

### 15.3 Log download

`GET /api/v1/system/logs/download?file=<name>`:

- Validates the filename against `^app-\d{4}-\d{2}-\d{2}\.log$`
- Uses `path.basename` to prevent traversal
- Streams the file with `res.download`

### 15.4 Log clearing

`POST /api/v1/system/logs/clear` empties the in-memory buffer. It does **not**
delete daily log files; those must be removed manually from the filesystem.

### 15.5 Health checks

- `GET /api/v1/health` — public liveness probe. Returns `{ "status": "ok" }`.
- `GET /api/v1/health/detailed` — developer-only readiness probe. Returns
  uptime, Node.js version, memory usage, database connection status, and
  environment.

### 15.6 API manifest

- `GET /api/_meta` — public summary. Lists enabled public endpoints.
- `GET /api/_meta/full` — complete manifest including disabled endpoints and
  the reasons for their exclusion (developer only).
- `GET /api/_meta/diff?target=<env>` — compares the current surface against a
  target environment (developer only).

The manifest is populated by declarations registered through `apiGuard()`. It
reflects the current runtime configuration, including feature flags and
environment restrictions.

---

## 16. File Uploads

### 16.1 Storage layout

```
backend/uploads/
├── avatars/
│   └── <timestamp>-<random>.jpg
└── projects/
    ├── images/
    │   └── <projectId>/
    │       └── <timestamp>-<random>.jpg
    ├── videos/
    │   └── <projectId>/
    │       └── <timestamp>-<random>.mp4
    └── files/
        └── <projectId>/
            └── <timestamp>-<random>.zip
```

Uploads are stored outside the public web root. They are served through a
dedicated middleware at `/uploads` with security headers applied.

### 16.2 Validation pipeline

1. **Multer** parses the multipart request and writes the file to disk with a
   generated filename.
2. **File filter** rejects files whose MIME type is not in the category
   allowlist.
3. **Size limits** are enforced by Multer; oversized files are rejected before
   being fully written.
4. **Count limits** are enforced by the controller; excess files trigger
   cleanup of already-uploaded files.

### 16.3 Cleanup on failure

If the controller rejects the upload (for example, because adding the new
images would exceed the ten-image limit), the uploaded files are deleted
before the error response is returned.

**Known gap:** If a database write fails after the file has been written but
before the controller completes, the file remains on disk. A background
cleanup process that removes orphaned files is not implemented.

### 16.4 Serving

Files are served from `/uploads` with the following headers:

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Content-Disposition: attachment` for archives, HTML, and SVG
- `Content-Type: application/octet-stream` for HTML and SVG

These headers prevent uploaded content from executing as a web page.

### 16.5 Deletion

`deleteFile(publicUrl)` in `fileService.ts`:

1. Converts the public URL to an absolute path.
2. Verifies the path is within the upload root (path traversal check).
3. Deletes the file.

Failures are logged but do not throw, so cleanup of one file does not prevent
cleanup of others.

---

## 17. GitHub Integration

### 17.1 Repository link

A project may be linked to a GitHub repository by providing `githubUrl` at
creation or update. The URL is parsed by `parseGitHubUrl`, which accepts:

- `https://github.com/<owner>/<repo>`
- `https://github.com/<owner>/<repo>.git`
- `git@github.com:<owner>/<repo>.git`
- `<owner>/<repo>`

The parsed repository identifier is stored as `<owner>/<repo>`. Duplicate
repository links are rejected.

### 17.2 Synchronised metadata

On sync, the following fields are populated:

| Field                                      | Source                                        |
| ------------------------------------------ | --------------------------------------------- |
| `fullName`                                 | Repository full name                          |
| `description`                              | Repository description                        |
| `homepage`                                 | Repository homepage                           |
| `language`                                 | Primary language                              |
| `stars`                                    | Stargazer count                               |
| `watchers`                                 | Subscriber count                              |
| `forks`                                    | Fork count                                    |
| `openIssues`                               | Open issue count                              |
| `downloads`                                | Sum of asset downloads across recent releases |
| `size`                                     | Repository size (KB)                          |
| `license`                                  | SPDX identifier                               |
| `topics`                                   | Repository topics                             |
| `defaultBranch`                            | Default branch name                           |
| `isArchived`                               | Archived flag                                 |
| `isFork`                                   | Fork flag                                     |
| `createdAtGh`, `updatedAtGh`, `pushedAtGh` | Timestamps                                    |

### 17.3 Sync policy

`shouldResync(lastSyncedAt, maxAgeHours)` returns `true` when the cached data is
older than the threshold (default 6 hours, configurable via
`GITHUB_SYNC_MAX_AGE_HOURS`).

Sync is triggered:

- At project creation, if a repository is linked
- At project update, if the repository link changes
- On explicit `POST /api/v1/projects/:id/sync-github`
- On `GET /api/v1/projects/:idOrSlug` when automatic sync is enabled and the
  cache is stale

Sync failures on `GET` do not block the response. The stale data is returned
and a warning is logged.

### 17.4 Rate limiting and caching

The GitHub client in `githubService.ts` implements:

- **In-memory cache** — repository info cached for 15 minutes; download
  statistics for 1 hour
- **ETag support** — `If-None-Match` headers; 304 responses do not consume quota
- **Concurrency cap** — a counting semaphore limits simultaneous requests to 3
- **Request deduplication** — concurrent callers for the same repository share
  one in-flight request
- **Rate-limit awareness** — remaining quota and reset time are read from
  response headers; requests pause proactively when quota is low
- **Retry policy** — up to 3 retries with exponential backoff for transient
  failures and 5xx responses
- **Timeout** — 8 seconds per request

### 17.5 Authentication

Without `GITHUB_TOKEN`, GitHub enforces 60 requests per hour per IP. With a
token, 5,000. Public repositories require no scopes; private repositories
require the `repo` scope.

The client never logs the token, even at debug level.

---

## 18. Email Subsystem

### 18.1 Structure

The email system is abstracted behind a transport layer:

```
services/mail/
├── config.ts           → environment-based configuration
├── mailService.ts      → orchestrator with rate limiting
├── rateLimiter.ts      → per-recipient sliding window
├── types.ts            → interfaces
├── utils.ts            → address formatting and HTML escaping
├── transports/
│   ├── logTransport.ts → console output
│   └── smtpTransport.ts→ Nodemailer
└── templates/
    ├── otpTemplate.ts
    ├── sendOtpEmail.ts
    └── ticketEmails.ts
```

### 18.2 Modes

| Mode   | Behaviour                                                                    |
| ------ | ---------------------------------------------------------------------------- |
| `log`  | Messages are written to the console with boxed formatting. No email is sent. |
| `smtp` | Messages are delivered through the configured SMTP server.                   |

The transport is selected per message based on `MAIL_MODE`. Switching modes
requires only an environment change and a restart.

### 18.3 SMTP configuration

- TLS 1.2 minimum (enforced by Nodemailer's `tls.minVersion`)
- Certificate validation enabled by default; disabled only when
  `SMTP_ALLOW_INSECURE=true` is explicitly set
- Connection pooling with up to 3 connections and 100 messages per connection
- Configurable connection, greeting, and socket timeouts
- Optional debug logging via `MAIL_DEBUG=true`

### 18.4 Rate limiting

The mail service enforces a per-recipient rate limit of **5 messages per
minute**. This is independent of HTTP rate limiting; it prevents a single
compromised account from flooding a victim's inbox.

When the limit is exceeded, the caller receives a 429 `TOO_MANY_ATTEMPTS`
response with a `Retry-After` hint.

### 18.5 Templates

Three template families exist:

**OTP template** — used for:

- Email verification (`verify_email`)
- Password change (`change_password`)
- Email change, old address (`change_email_old`)
- Email change, new address (`change_email_new`)
- Two-factor authentication (`login_2fa`)
- Password recovery (`reset_password`)

Each purpose has a distinct subject line, heading, and emoji.

**Ticket templates** — used for:

- Creation confirmation
- Staff reply notification

**Lookup template** — used by the email-based ticket retrieval flow.

All templates produce HTML with a plain-text fallback. User-supplied values
are escaped before interpolation.

### 18.6 Failure handling

When an OTP email fails to send:

- In `createVerificationCode`, the verification record is deleted and the
  error is re-thrown. This prevents an unusable active code from remaining in
  the database.
- In `register`, the failure is logged but does not prevent registration. The
  user can request another code from the verification page.

When a ticket email fails to send:

- The failure is logged. The ticket remains valid; the user can use email
  lookup to retrieve it.

When SMTP verification fails at startup:

- If `MAIL_FAIL_FAST=true`, the process exits.
- Otherwise, the failure is logged and the application continues. Email
  delivery will fail on first use.

---

## 19. Frontend Architecture

### 19.1 Rendering model

Pages are rendered as EJS templates on the server. The browser receives
complete HTML. Client-side JavaScript adds interactivity to specific
pages; it does not render the page.

This is a deliberate constraint. Server rendering provides:

- Reliable SEO without additional infrastructure
- Fast first paint
- Simple deployment (no build step for the frontend)

The trade-off is that client-side interactivity is more manual than in a
framework-driven application.

### 19.2 Module structure

Every page-specific script follows the same pattern:

```javascript
(function () {
  'use strict';

  // 1. Utilities
  function escapeHtml(s) { ... }

  async function api(path, opts = {}) { ... }

  // 2. State
  const state = { ... };

  // 3. DOM references
  const $ = (sel) => document.querySelector(sel);

  // 4. Render functions
  function render(data) { ... }

  // 5. Event handlers
  function bind() { ... }

  // 6. Initialization
  load();
})();
```

Modules are **ES5-compatible IIFEs**. No `import` or `export`. No bundler. The
module attaches to `window` only when it must be callable from another module
(for example, `window.FormKit`).

### 19.3 Shared components

| Component          | File                               | Provides                                                    |
| ------------------ | ---------------------------------- | ----------------------------------------------------------- |
| **FormKit**        | `js/form-errors.js`                | Form validation, field errors, fetch wrapper, loading state |
| **Dialog system**  | `js/dialog-error.js`               | `openDialogError`, `confirmDialog`, `toast`                 |
| **MarkdownEditor** | `js/components/markdown-editor.js` | Editor with live preview and sanitisation                   |
| **TagPicker**      | `js/components/tag-picker.js`      | Two-level tag selection with inline creation                |
| **userChip**       | `js/components/user-chip.js`       | Renders a user avatar and name as a link                    |

### 19.4 Form handling pattern

Every form uses `FormKit.attach`:

```javascript
FormKit.attach('#myForm', {
  validate(values) {
    const errors = {};
    if (!values.title) errors.title = 'Title is required.';
    return errors;
  },
  submit(values) {
    return FormKit.postJSON('/api/v1/projects', values);
  },
  onSuccess(data) {
    toast('Created.', 'success');
    location.href = '/dashboard/projects';
  },
});
```

`FormKit` handles:

- Native constraint validation
- Custom validation returning a field-to-message map
- Field-level error rendering with a shake animation
- Form-level banner for errors without a specific field
- Loading state on the submit button
- Server error extraction from `details`, `fields`, `errors`, `field`, or `code`

### 19.5 XSS prevention

All user-supplied strings are escaped before `innerHTML` interpolation:

```javascript
function escapeHtml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
```

The Markdown renderer produces HTML that is passed through `sanitizeHtml`
before insertion. The sanitiser:

- Allows a fixed set of tags
- Removes dangerous tags entirely (script, style, iframe, object, embed, form,
  meta, link, base, svg, math)
- Removes event handler attributes
- Removes the `style` attribute
- Rejects `javascript:`, `vbscript:`, and `data:` (except `data:image/`) URLs
- Adds `rel="noopener noreferrer nofollow"` to external links
- Adds `loading="lazy"` to images

### 19.6 Fetch wrapper

Every client-side request uses a consistent fetch helper:

```javascript
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
```

The `credentials: 'include'` option is required for cookies to be sent. Omitting
it causes every authenticated request to fail with 401.

---

## 20. Theming and Presentation

### 20.1 Theme system

Three modes: `system`, `light`, `dark`. Stored in `localStorage` under
`dh-mode`. Applied by setting `data-mode` on `<html>`.

In `system` mode, the effective mode is determined by
`window.matchMedia('(prefers-color-scheme: light)')` and updated reactively
when the OS preference changes.

Six accent palettes: `blue`, `violet`, `emerald`, `amber`, `rose`, `cyan`.
Stored in `localStorage` under `dh-accent`. Applied by setting
`data-accent` on `<html>`.

**Flash prevention.** An inline script in `seo-head.ejs` reads the stored
preferences and applies them to `<html>` before the first paint. This prevents
a visible flash of the wrong theme while JavaScript loads.

### 20.2 Design tokens

All colours, radii, shadows, and spacing are defined as CSS custom properties
in `frontend/public/styles/index.css` and `frontend/public/styles/themes.css`.
Hardcoded colours are used only for semantic status indicators (success,
warning, danger) where the colour carries meaning.

Theme-specific tokens are set by `html[data-mode="light"]` and
`html[data-mode="dark"]` blocks. Accent tokens are set by
`html[data-accent="*"]` blocks.

### 20.3 Layout system

The dashboard uses a CSS grid layout:

```
.dash-layout {
  display: grid;
  grid-template-columns: var(--sidebar-width) 1fr;
  grid-template-rows: auto 1fr;
  grid-template-areas:
    "sidebar breadcrumb"
    "sidebar main";
}
```

On screens narrower than 900 px, the sidebar is hidden and the layout collapses
to a single column. The sidebar is accessible through the mobile drawer, which
is part of the global header.

### 20.4 Responsive breakpoints

| Breakpoint   | Width       | Changes                                            |
| ------------ | ----------- | -------------------------------------------------- |
| Desktop      | ≥ 1024 px   | Full sidebar, three-column project grids           |
| Tablet       | 768–1023 px | Two-column grids, condensed header                 |
| Mobile       | < 768 px    | Single column, drawer navigation, condensed header |
| Small mobile | < 420 px    | Additional font and spacing reductions             |

### 20.5 Accessibility

- Focus rings are visible on all interactive elements
- Colour contrast targets WCAG AA
- `prefers-reduced-motion` is respected throughout
- All images include `alt` text (uploaded images fall back to the filename)
- Modal dialogs trap focus and restore it on close
- The interactive breadcrumb menu is keyboard navigable (arrow keys, Home, End,
  Escape)

---

## 21. Search Engine Optimisation

### 21.1 Metadata

Every public page includes:

- `<title>` with the page name and brand
- `<meta name="description">` with a page-specific summary
- `<meta name="keywords">` with relevant terms
- `<link rel="canonical">` pointing to the canonical URL
- Open Graph tags (type, title, description, URL, image, locale)
- Twitter Card tags (summary_large_image)
- Robots directives

Authentication and dashboard pages set `noindex: true`, which emits
`noindex, nofollow`.

### 21.2 JSON-LD

Structured data is emitted where it improves discoverability:

| Page       | Schema                                                                             |
| ---------- | ---------------------------------------------------------------------------------- |
| Home       | `WebSite` with `SearchAction`                                                      |
| Project    | `SoftwareApplication` with `aggregateRating`, `author`, and `interactionStatistic` |
| User       | `Person`                                                                           |
| About      | `AboutPage` with `mainEntity` of type `Organization`                               |
| Users list | `CollectionPage`                                                                   |

### 21.3 Sitemap

`GET /sitemap` generates an XML sitemap containing:

- Static pages (home, explore, projects)
- All published public projects (up to 5,000)
- All non-banned users with a username (up to 2,000)

`GET /sitemap.xml` redirects to `/sitemap` with a 301.

The sitemap is cached for one hour via `Cache-Control`.

### 21.4 Robots.txt

Served from `frontend/public/robots.txt`:

```
User-agent: *
Allow: /
Disallow: /dashboard
Disallow: /api/
Disallow: /auth/
Sitemap: /sitemap
```

### 21.5 Canonical URL construction

`APP_URL` is used when set. Otherwise, the protocol and host are derived from
the request headers (`X-Forwarded-Proto`, `X-Forwarded-Host`, or `Host`). The
canonical path is the `req.originalUrl` without the query string, unless an
explicit `canonicalPath` is provided by the page.

---

## 22. Rate Limiting

Three independent limiter families are active.

### 22.1 Global limiters

Implemented in `middleware/security.ts`:

| Limiter            | Window | Limit      | Applied to                                      |
| ------------------ | ------ | ---------- | ----------------------------------------------- |
| `apiLimiter`       | 15 min | 400 per IP | All `/api` routes                               |
| `authLimiter`      | 15 min | 30 per IP  | Register, login, refresh                        |
| `sensitiveLimiter` | 1 hour | 10 per IP  | Verification, reset, contact, ticket operations |

### 22.2 Per-endpoint limiters

Implemented in `middleware/apiRateLimit.ts`, applied through `apiGuard()`:

| Visibility      | Default window | Default limit | Key           |
| --------------- | -------------- | ------------- | ------------- |
| `public`        | 60 s           | 60            | IP            |
| `authenticated` | 60 s           | 120           | User ID or IP |
| `admin`         | 60 s           | 240           | User ID or IP |
| `developer`     | 60 s           | 240           | User ID or IP |

Per-endpoint overrides exist for expensive operations:

| Endpoint                  | Override    |
| ------------------------- | ----------- |
| Project creation          | 10 / hour   |
| All project uploads       | 30 / hour   |
| Username change           | 3 / hour    |
| Avatar upload and removal | 3 / hour    |
| Email change request      | 5 / hour    |
| Email verification        | 10 / 15 min |
| Password change request   | 5 / hour    |
| Password confirmation     | 10 / 15 min |
| Review submission         | 10 / hour   |
| Review update and delete  | 20 / hour   |
| Comment creation          | 15 / minute |
| Comment update and delete | 20 / minute |
| Comment likes             | 60 / minute |
| Tag find-or-create        | 20 / minute |
| Tag creation              | 10 / minute |

### 22.3 Email limiter

Implemented in `services/mail/rateLimiter.ts`:

| Scope                 | Window | Limit      |
| --------------------- | ------ | ---------- |
| Per recipient address | 60 s   | 5 messages |

This limiter is independent of HTTP rate limiting and applies to all email
sent by the application, including ticket notifications.

### 22.4 Ticket rate limits

Implemented inline in `contactController.ts`:

| Scope     | Window                   |
| --------- | ------------------------ |
| Per email | One ticket per 2 minutes |
| Per IP    | One ticket per 5 minutes |

### 22.5 Limitations

Rate limiting state is in-memory. This is sufficient for a single-process
deployment. Horizontal scaling requires either:

- Sticky sessions at the load balancer
- A shared store (Redis) for `express-rate-limit`

Neither is currently configured.

---

## 23. Spam Detection

### 23.1 Purpose

`services/spamDetection.ts` scores user-submitted content and rejects it
above a threshold. It is applied to:

- Project short and full descriptions
- User biography
- Review titles and bodies

### 23.2 Rules

| Rule                 | Weight | Trigger                                                              |
| -------------------- | :----: | -------------------------------------------------------------------- |
| Too short            |   10   | Content shorter than `minLength`                                     |
| Repeated characters  | 10–40  | Runs of the same character (thresholds at 8, 15, 30)                 |
| Repeated words       | 10–35  | High ratio of repeated words in long content                         |
| Too many links       | 20–35  | URL count exceeds `maxLinks` or double `maxLinks`                    |
| URL shorteners       |  8–25  | Use of known shortener domains                                       |
| Excessive uppercase  | 12–25  | High ratio of uppercase Latin letters                                |
| Suspicious phrases   |  8–25  | Matches against English and Persian promotional patterns             |
| High-risk promotion  |   20   | Multiple high-risk phrases plus at least one URL                     |
| HTML injection       |   50   | `<script>`, `<iframe>`, `javascript:`, event handlers                |
| Invisible characters |   15   | Zero-width or direction-override characters embedded in text         |
| Duplicate content    |   50   | Same normalized content submitted to the same field by the same user |

### 23.3 Thresholds

| Threshold         | Value | Effect                                          |
| ----------------- | :---: | ----------------------------------------------- |
| Spam rejection    |  50   | Request rejected with `SPAM_DETECTED`           |
| Warning threshold |  30   | Content accepted, warnings included in response |

Warnings are returned to the client so the frontend can display a non-blocking
notice. Rejections return a 400 with details about which rules triggered.

### 23.4 Table-aware analysis

Content with tables (Markdown pipe tables, tab-separated data, HTML table
elements) is analysed for repeated-word patterns with table rows excluded.
This prevents legitimate tabular data from triggering repetition rules.

### 23.5 Duplicate content detection

Normalized content is hashed (SHA-256) and cached per user per field for 24
hours. A repeat submission of the same content to the same field within that
window triggers the duplicate rule.

The cache is in-memory and per-process. It does not survive a restart and is
not shared across instances.

---

## 24. Logging

### 24.1 Mechanism

`services/logger.ts` intercepts `console.log`, `console.warn`,
`console.error`, and `console.debug`. Each call:

1. Formats the arguments into a single message.
2. Appends the entry to an in-memory buffer (2,000 entries maximum).
3. Appends the entry to the daily log file at `logs/app-YYYY-MM-DD.log`.
4. Calls the original console method (output is not suppressed).

### 24.2 File format

Each line is:

```
[<ISO timestamp>] [<LEVEL>] <message>
```

The parser in `readFile` reverses this format. Lines that do not match the
pattern are preserved as plain text with `level: "info"` and no timestamp.

### 24.3 Sensitive data

The following are never logged:

- Passwords (plaintext or hash)
- Access tokens, refresh tokens, or any portion of a JWT
- `Authorization` or `Cookie` header values
- OTP codes, except in `MAIL_MODE=log`
- Full request bodies

This is enforced by review, not by automated redaction. Contributors adding
log statements must verify that their message does not include sensitive
content.

### 24.4 Log markers

Convention uses emoji markers for greppability:

| Marker                  | Purpose                     |
| ----------------------- | --------------------------- |
| `🔴 [UNHANDLED ERROR]`   | Uncaught error or rejection |
| `🟨 [FormKit]`           | Client-side warning         |
| `🟦 [FormKit]`           | Client-side debug           |
| `📧 [VERIFICATION CODE]` | OTP dispatched in log mode  |
| `🔐 [ROLE CHANGE]`       | Role modification           |
| `🔒 [PASSWORD CHANGED]`  | Password change             |
| `🔄 [EMAIL CHANGED]`     | Email change                |
| `✅ [EMAIL VERIFIED]`    | Email verification          |
| `[MAIL]`                | Mail service events         |
| `[TICKET]`              | Ticket lifecycle events     |

### 24.5 Limitations

- Log rotation is by filename (daily). Old files are not automatically deleted.
- The in-memory buffer is per-process; it is empty after a restart.
- Log files are not structured JSON; parsing requires the regex pattern in
  `logger.readFile`.

---

## 25. Caching

### 25.1 In-memory cache

`services/cache.ts` provides a simple key-value store with TTL:

```typescript
cacheSet(key, value, ttlSeconds)
cacheGet<T>(key): T | null
cacheDel(key)
cacheClearPrefix(prefix)
```

Expired entries are removed lazily on access and proactively every ten minutes.

### 25.2 Cache usage

| Key                    | TTL      | Set by                 |
| ---------------------- | -------- | ---------------------- |
| `explore:<json>`       | 5 min    | `exploreController`    |
| `home:feeds`           | 5 min    | `homeFeeds` controller |
| GitHub repository info | 15 min   | `githubService`        |
| GitHub download stats  | 1 hour   | `githubService`        |
| Duplicate-content hash | 24 hours | `spamDetection`        |

### 25.3 Limitations

- Cache is per-process. Multiple instances have independent caches.
- Cache does not survive a restart.
- Invalidation is by TTL only. There is no mechanism to invalidate on write.
  For example, creating a new project does not clear the explore cache; the
  project appears after the TTL expires.

This is acceptable for the current scale. A Redis-backed cache with explicit
invalidation is planned.

---

## 26. Configuration Reference

### 26.1 Required variables

| Variable      | Notes                                                |
| ------------- | ---------------------------------------------------- |
| `PORT`        | HTTP port                                            |
| `MONGODB_URI` | Full connection string                               |
| `JWT_SECRET`  | Minimum 64 characters in production                  |
| `APP_URL`     | Required in production; must not contain `localhost` |

### 26.2 Optional variables

| Variable                    | Default                 | Purpose                                |
| --------------------------- | ----------------------- | -------------------------------------- |
| `APP_ENV`                   | Derived from `NODE_ENV` | `development`, `staging`, `production` |
| `NODE_ENV`                  | `development`           | Standard Node.js environment           |
| `TRUST_PROXY`               | Unset                   | Set to `1` behind a reverse proxy      |
| `FEATURE_FLAGS`             | Empty                   | Comma-separated list                   |
| `API_STRICT`                | `true` in production    | Boot-time diagnostics                  |
| `JWT_EXPIRES_IN`            | `7d`                    | Access token lifetime                  |
| `DEVELOPER_EMAIL`           | Unset                   | Bootstraps the developer account       |
| `GITHUB_TOKEN`              | Unset                   | Raises GitHub quota                    |
| `GITHUB_SYNC_MAX_AGE_HOURS` | `6`                     | Sync staleness threshold               |
| `MAIL_MODE`                 | `log`                   | `log` or `smtp`                        |
| `MAIL_FROM_NAME`            | `App`                   | Sender display name                    |
| `MAIL_FROM_ADDRESS`         | `noreply@localhost`     | Sender address                         |
| `MAIL_REPLY_TO`             | Unset                   | Reply-to address                       |
| `MAIL_HELO_NAME`            | Unset                   | SMTP HELO hostname                     |
| `MAIL_FAIL_FAST`            | `false`                 | Exit if SMTP verification fails        |
| `MAIL_DEBUG`                | `false`                 | SMTP debug output                      |
| `SMTP_HOST`                 | Required in SMTP mode   | Server hostname                        |
| `SMTP_PORT`                 | Required in SMTP mode   | Server port                            |
| `SMTP_USER`                 | Required in SMTP mode   | Authentication user                    |
| `SMTP_PASS`                 | Required in SMTP mode   | Authentication password                |
| `SMTP_SECURE`               | Inferred from port      | Force implicit TLS                     |
| `SMTP_TIMEOUT_MS`           | `15000`                 | Connection timeout                     |
| `SMTP_ALLOW_INSECURE`       | `false`                 | Disable certificate validation         |

### 26.3 Configuration validation

At startup:

1. `config/env.ts` exits the process if `MONGODB_URI`, `JWT_SECRET`, or `PORT`
   are missing.
2. `config/environment.ts` exits the process in production if:
   - `APP_URL` is unset or contains `localhost`
   - `JWT_SECRET` is shorter than 64 characters
3. Warnings are emitted when:
   - `APP_ENV=production` but `NODE_ENV` is not `production`
   - `API_STRICT=false` in production
   - `SMTP_ALLOW_INSECURE=true`

---

## 27. Operational Procedures

### 27.1 First deployment

```bash
# 1. Clone and install
git clone https://github.com/Sobhan-SRZA/DevHub.git
cd DevHub
npm install

# 2. Configure environment
cp example.env .env
# Edit .env: MONGODB_URI, JWT_SECRET, APP_URL, MAIL_MODE=smtp, SMTP_*

# 3. Build
npm run build

# 4. Seed taxonomy
npx tsx backend/src/scripts/seedDefaultData.ts

# 5. Bootstrap developer account
npx tsx backend/src/scripts/setupFirstAdmin.ts

# 6. Start
npm start
```

### 27.2 Routine maintenance

| Task                      | Frequency            | Command                                                   |
| ------------------------- | -------------------- | --------------------------------------------------------- |
| Verification code cleanup | Weekly               | `npx tsx backend/src/scripts/cleanupVerificationCodes.ts` |
| Index synchronisation     | After schema changes | `npx tsx backend/src/scripts/syncIndexes.ts`              |
| Log file cleanup          | Monthly              | Manual (no automated script)                              |
| Backup verification       | Weekly               | Verify MongoDB backups restore successfully               |

### 27.3 Deploying a new version

```bash
# 1. Fetch and pull
git fetch upstream
git pull upstream main

# 2. Install any new dependencies
npm install

# 3. Type check
npx tsc --noEmit

# 4. Build
npm run build

# 5. Synchronise indexes if the schema changed
npx tsx backend/src/scripts/syncIndexes.ts

# 6. Restart the process
# (e.g., systemctl restart devhub, or pm2 restart devhub)
```

The process handles `SIGTERM` by closing the mail transport and exiting
gracefully. Ensure the process manager gives it at least 30 seconds before
sending `SIGKILL`.

### 27.4 Monitoring

Recommended probes:

- **Liveness**: `GET /api/v1/health` — expects `{ "status": "ok" }`
- **Readiness**: `GET /api/v1/health/detailed` — check `database.connected`
- **Disk usage**: monitor `backend/uploads/` and `logs/` growth
- **Error rate**: monitor `logs/app-*.log` for `[error]` entries

### 27.5 Backup

Required state:

- MongoDB database (all collections)
- `backend/uploads/` directory
- `.env` file (for restoring the same configuration)

The `logs/` directory is optional and may be excluded from backups.

---

## 28. Known Limitations

The following limitations are acknowledged in the current version.

### Architectural

| Limitation                               | Impact                                                                                  |
| ---------------------------------------- | --------------------------------------------------------------------------------------- |
| Single-process deployment                | Rate limiting and caching are per-process; horizontal scaling requires a shared store.  |
| In-memory caching                        | Cache is lost on restart; no cross-instance invalidation.                               |
| No background job queue                  | Long-running operations (email, GitHub sync) block the request that triggers them.      |
| No snapshot table for historical metrics | Daily view and download timelines are not available; only cumulative counts are stored. |

### Security

| Limitation                               | Impact                                                  |
| ---------------------------------------- | ------------------------------------------------------- |
| `'unsafe-inline'` in CSP `script-src`    | Weakens XSS protection where inline scripts are used.   |
| No magic-byte validation on uploads      | A file with a spoofed MIME type may pass the allowlist. |
| No antivirus scanning on uploads         | Malicious files may be stored and redistributed.        |
| No 2FA (TOTP)                            | Accounts are protected by a single factor.              |
| No IP or User-Agent binding for sessions | Stolen tokens remain usable until expiry or revocation. |
| No CSP reporting endpoint                | CSP violations are not collected.                       |
| No database-backed audit log             | Administrative actions are logged to the console only.  |

### Functional

| Limitation                                            | Impact                                                                         |
| ----------------------------------------------------- | ------------------------------------------------------------------------------ |
| `/api/v1/tag-types/request` not wired                 | Users cannot request new categories through the API.                           |
| Helpful votes are not deduplicated                    | The same user can increment `helpfulCount` multiple times.                     |
| Search is regex-based                                 | Not suitable for large datasets; no full-text search.                          |
| No notification system                                | Users must return to the site to see activity.                                 |
| No follow or subscription                             | No way to be notified of new content from a user.                              |
| No activity feed on profiles                          | Only the dashboard analytics show activity.                                    |
| Comments reload fully after mutation                  | No optimistic updates.                                                         |
| Image reordering requires a full reload in some cases | The client sends the order but does not always reflect it without re-fetching. |

### Operational

| Limitation                                     | Impact                                                                                            |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Log rotation does not delete old files         | Disk usage grows indefinitely unless manually managed.                                            |
| No automated database cleanup                  | Expired sessions and verification codes are cleaned by TTL, but other collections may accumulate. |
| `syncIndexes.ts` may drop and recreate indexes | Should not be run on production without a maintenance window.                                     |

---

## 29. Roadmap

The roadmap distinguishes between planned work and aspirational features.
Planned work is part of the project's near-term commitments. Aspirational
features are noted for visibility but not scheduled.

### 29.1 Version 1.1 — Community foundations

- Follow and unfollow users
- Notification system (in-app inbox and email digest)
- Activity feed on user profiles
- Login history in the security page
- Tighter rate limiting across authentication endpoints
- CSP reporting endpoint

### 29.2 Version 1.2 — Depth and scale

- Full-text search (MongoDB text index or Elasticsearch)
- Live comment updates over Server-Sent Events
- Complete admin panel UI
- Audit log in the database
- User preferences (locale, notification channels)
- Redis-backed caching and rate limiting

### 29.3 Version 2.0 — Ecosystem

- Public, versioned REST API with token authentication
- Two-factor authentication via TOTP
- GraphQL endpoint
- Webhooks for project events
- GitHub Action integration
- Mobile application
- Plugin system for custom content formats

### 29.4 Explicitly not planned

The following are intentionally out of scope to preserve focus:

- A social network (feed, direct messages)
- A hosting platform for repositories
- A freelancing marketplace
- A payment system
- A general-purpose chat
- A blog platform

---

**Last reviewed:** 2026
**Maintainer:** [@Sobhan-SRZA](https://github.com/Sobhan-SRZA)
**License:** BSD-3-Clause