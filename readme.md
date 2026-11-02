<div align="center">

<img src="./frontend/public/assets/logo.svg" alt="DevHub" width="88" height="88" />

# DevHub

**Discover. Review. Ship.**

A community-driven platform for discovering, reviewing, and sharing
open-source projects — built on real ratings and honest feedback,
not star counts alone.

[![License](https://img.shields.io/badge/License-BSD%203--Clause-blue.svg)](./LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-20%2B-339933)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5%2B-3178c6)](https://www.typescriptlang.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-7%2B-47A248)](https://www.mongodb.com/)
[![Express](https://img.shields.io/badge/Express-5.x-000000)](https://expressjs.com/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](./CONTRIBUTING.md)

[Overview](#overview) · [Features](#features) · [Architecture](#architecture) · [Getting Started](#getting-started) · [API](#api-reference) · [Security](#security) · [Roadmap](#roadmap)

</div>

---

## Table of Contents

1. [Overview](#overview)
2. [The Problem](#the-problem)
3. [Features](#features)
4. [Technology Stack](#technology-stack)
5. [Architecture](#architecture)
6. [Project Structure](#project-structure)
7. [Getting Started](#getting-started)
8. [Environment Variables](#environment-variables)
9. [Roles and Permissions](#roles-and-permissions)
10. [API Reference](#api-reference)
11. [Response Format](#response-format)
12. [Security](#security)
13. [The Hot Score Algorithm](#the-hot-score-algorithm)
14. [GitHub Integration](#github-integration)
15. [Email System](#email-system)
16. [Rate Limiting](#rate-limiting)
17. [SEO and Metadata](#seo-and-metadata)
18. [Command-Line Scripts](#command-line-scripts)
19. [Docker Support](#docker-support)
20. [Deployment Notes](#deployment-notes)
21. [Roadmap](#roadmap)
22. [Contributing](#contributing)
23. [License](#license)
24. [Acknowledgements](#acknowledgements)

---

## Overview

**DevHub** is an open-source platform where developers publish, review, and
discover software projects. It is neither a repository host nor a social
network. It is a **curation layer** on top of the existing open-source
ecosystem: projects remain on their own repositories, while DevHub provides
structured discovery, real user feedback, and a professional project page.

Three principles guide the design:

- **Quality over popularity.** A single honest review outweighs a hundred
  passive upvotes.
- **Everything reversible.** Destructive actions require confirmation;
  deletions are soft where hierarchy matters; email and role changes carry
  an audit trail.
- **Security by default.** Email verification is mandatory, OTPs are
  hashed, sessions are revocable, and every request is validated.

The platform is designed for three primary audiences:

| Audience           | Need                                                                  |
| ------------------ | --------------------------------------------------------------------- |
| **Developers**     | Find existing solutions and compare them fairly before starting work. |
| **Project owners** | Receive structured feedback and gain real visibility.                 |
| **Explorers**      | Discover high-quality tools curated by the community.                 |

---

## The Problem

### Discovery is skewed by stars
A star count reflects historical attention, not current usefulness. Abandoned
repositories regularly outrank active, well-maintained alternatives. DevHub
surfaces signals that reflect **actual usability**: user ratings, satisfaction
percentages, and detailed written reviews.

### Feedback is buried in the wrong place
Issues and pull requests are built for code, not for product feedback. User
experience observations end up scattered across technical threads. DevHub
provides a dedicated, structured space for reviews and threaded discussion.

### Project information is fragmented
Screenshots live on one platform, demos on another, downloads somewhere else,
and documentation in a fourth location. DevHub consolidates the gallery, demo
video, downloadable archive, and Markdown documentation into a single,
SEO-optimised project page.

---

## Features

### Authentication and Account Security

| Capability                                     | Details                                                                                             |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Registration with mandatory email verification | 6-digit OTP delivered to the provided address.                                                      |
| Login                                          | Accepts either an email address or a username.                                                      |
| Session management                             | List active devices, revoke individual sessions, or sign out everywhere.                            |
| Password recovery                              | OTP-based reset with 15-minute expiry.                                                              |
| Password change                                | Requires the current password and a confirmation OTP. All other sessions are revoked automatically. |
| Two-step email change                          | Verifies ownership of the previous address **and** the new address, allowing rollback.              |
| Username change                                | Enforces uniqueness regardless of casing.                                                           |
| Profile management                             | Display name, biography (Markdown), and avatar.                                                     |
| Device fingerprinting                          | Sessions are keyed by a hash of the User-Agent and client fingerprint.                              |
| Geolocation                                    | Approximate city, region, and ISP are recorded per session.                                         |

### Projects

- **Full lifecycle management** — create, edit, delete, and archive.
- **Media support** — up to 10 images (5 MB each), one demo video (200 MB),
  and one downloadable archive (500 MB).
- **Rich descriptions** — Markdown and a constrained subset of HTML, sanitised
  on the client and rendered through a whitelist.
- **Automatic GitHub synchronisation** — stars, forks, watchers, open issues,
  primary language, licence, topics, and release download totals are kept in
  sync. A background policy triggers a refresh when the cached snapshot
  becomes stale.
- **Status control** — `draft`, `published`, or `archived`, plus a separate
  public/private flag.
- **Slug generation** — URL-friendly slugs are derived from the title and
  enforced unique.
- **Tagging** — up to 20 tags per project, drawn from a governed taxonomy
  (see below).
- **View and download counters** — incremented independently of external
  metrics.
- **Featured flag** — manual curation for the home feed.

### Reviews

- **Rating** — from 0 to 5, in half-star increments.
- **Satisfaction** — from 0 to 100 percent, distinct from rating.
- **Optional title and body** — up to 100 and 3,000 characters respectively.
- **One review per user per project** — enforced by a unique compound index.
- **Ownership restriction** — project owners cannot review their own work.
- **Aggregates** — average rating, average satisfaction, and review count are
  recalculated on every write.
- **Helpfulness counter** — a lightweight signal for surfacing useful reviews.
- **Star distribution** — a five-bucket histogram is returned alongside the
  paginated list.

### Comments

- **Threaded replies** — up to five levels of nesting, enforced both in the
  schema and the controller.
- **Likes** — one toggle endpoint per comment.
- **Soft deletion** — comments with replies retain their document and body is
  replaced with a placeholder; leaf comments are hard-deleted and their
  parent's reply counter is decremented.
- **Authentication required** — anonymous visitors can read but not post.
- **Edit tracking** — modified comments carry `isEdited` and `editedAt`.

### Tags and Categories

DevHub uses a governed two-level taxonomy:

- **Categories** (`TagType`) — a controlled set of thematic groups such as
  *Programming Language*, *Framework*, *Database*, *DevOps*, *AI*, *Security*,
  *Design*, and so on. Categories may be system-defined or submitted by
  users pending administrative approval.
- **Tags** — concrete values within a category. System tags are seeded on
  bootstrap; user-created tags are auto-approved, following the GitHub model.

Each category controls:

| Field                    | Purpose                                                        |
| ------------------------ | -------------------------------------------------------------- |
| `allowUserTags`          | Whether non-administrators may create tags inside it.          |
| `maxTags`                | An optional ceiling on the number of tags.                     |
| `isSystem`               | Marks categories that cannot be deleted through the API.       |
| `isApproved`             | Pending categories are invisible to the public until approved. |
| `color`, `icon`, `order` | Presentation metadata.                                         |

### Explore

The explore feed is driven by a **Hot Score** algorithm (see
[The Hot Score Algorithm](#the-hot-score-algorithm)) and offers:

- **Sort modes** — `trending`, `hot`, `top`, `new`, `top-rated`,
  `top-downloaded`.
- **Time windows** — `24h`, `7d`, `30d`, `all`, affecting the decay curve.
- **Filters** — by category, tag type, and free-text search.
- **Pagination** with configurable page size.
- **Five-minute server-side cache** for the aggregated result.

### Home Feed

The landing page is populated by a single endpoint that returns pre-assembled
sections:

- Trending (last seven days)
- Featured (manually curated)
- Latest (most recently published)
- Top-rated
- Most-downloaded
- Platform statistics (projects, users, tags, downloads)

The response is cached for five minutes.

### User Analytics

Each authenticated user has access to a personal analytics panel exposing:

- **Profile completeness** — a 0–100 score computed from identity fields,
  biography, avatar, email verification, and published projects.
- **Community rank** — position and percentile by an engagement composite.
- **Activity timeline** — daily buckets of projects, reviews, comments, and
  likes over a selectable window (`7d`, `30d`, `90d`, `1y`).
- **Recent activity feed** — the latest events across the user's projects.
- **Milestones** — earned and pending achievements such as first review,
  first star, ten stars, first hundred downloads, and five published projects.

### Public Directory

- **User directory** with search (name, username), sort (newest, alphabetical,
  most projects), and pagination.
- **Public profile pages** at `/users/:username` showing biography, statistics,
  published projects, and reviews received on the user's work.
- **Project directory** at `/projects` with search, sort, and pagination.

### Administration

The admin console provides:

- **User management** — paginated listing with search and role filter, role
  changes with an optional audit reason, and ban/unban toggles.
- **Category moderation** — approve or reject user-submitted categories, edit
  existing ones, and manage their metadata.
- **Tag moderation** — approve, edit, or delete tags; tag deletion is blocked
  while the tag remains in use.
- **Ticket management** — respond to support tickets, update status and
  priority, and assign tickets to staff.

### Developer Console

Restricted to the `developer` role:

- **System statistics** — process, memory, CPU, OS, and database metrics.
- **Log viewer** — filtered and searchable view over the in-memory buffer and
  daily log files, with download and clear actions.
- **Detailed health check** — exposed at `/api/v1/health/detailed`.
- **API manifest** — `/api/_meta/full` exposes the complete registry including
  disabled endpoints, and `/api/_meta/diff` compares the current surface
  against a target environment.

### Support Tickets

- **Public contact form** → creates a tracked ticket, applies per-email and
  per-IP rate limits, and sends a confirmation email with a tracking link.
- **Tracking tokens** — scoped to a single ticket, valid for 30 days, stored
  only as a SHA-256 hash, and revocable.
- **Email-based lookup** — a 6-digit OTP unlocks a list of tickets associated
  with the address. Attempts are limited to five per code, and the OTP expires
  after 15 minutes.
- **Conversations** — both users and staff can append messages. Replies reopen
  resolved or closed tickets.
- **Staff responses** trigger an email notification to the ticket author.
- **Account linkage** — tickets submitted before registration are linked to
  the account once the email matches.

### User Interface and Theming

- **Three display modes** — `system`, `light`, and `dark`. The system mode
  follows the OS preference and reacts to changes in real time.
- **Six accent palettes** — blue, violet, emerald, amber, rose, and cyan,
  applied through a CSS custom-property layer.
- **Persisted preferences** — stored in `localStorage` and applied before the
  first paint to eliminate a flash of unstyled content.
- **Collapsible dashboard sidebar** — with a `Ctrl+B` shortcut and persisted
  state.
- **Global search** — accessible from any page with `Ctrl+K` or `/`.
- **Interactive breadcrumb** — with a dropdown menu mirroring the dashboard
  navigation.
- **Consistent modal system** — dialogs, confirmation prompts, and toasts
  share a single API exposed on `window`.

### Developer Experience

- **Declarative API registry** — every endpoint may be declared through
  `apiGuard()`, which enforces environment gating, feature flags, and visibility
  rules while registering the endpoint for the manifest.
- **Tiered rate limiting** — per-visibility quotas applied per endpoint.
- **Structured error handling** — a single `AppError` class with typed error
  codes and English messages.
- **Automatic route discovery** — a loader walks the `api/` and `pages/`
  directories, mounting each route module without manual wiring.
- **Boot-time diagnostics** — undeclared routes are flagged at startup when
  strict mode is active.

---

## Technology Stack

| Layer            | Technology                       | Version     |
| ---------------- | -------------------------------- | ----------- |
| Runtime          | Node.js                          | 20 or later |
| Framework        | Express                          | 5.x         |
| Language         | TypeScript                       | 5 or later  |
| Database         | MongoDB                          | 7 or later  |
| ODM              | Mongoose                         | 9.x         |
| Templating       | EJS                              | 7.x         |
| Authentication   | JSON Web Tokens (HS256)          | 9.x         |
| Password hashing | bcrypt                           | 6.x         |
| Validation       | Zod                              | 4.x         |
| File uploads     | Multer                           | 2.x         |
| Email            | Nodemailer                       | 10.x        |
| Rate limiting    | express-rate-limit               | 8.x         |
| Frontend         | Vanilla JavaScript + Modular CSS | —           |

---

## Architecture

DevHub is a **server-rendered application** with a thin client-side layer.
Pages are delivered as EJS templates; interactive behaviour is added by small,
isolated ES5-compatible modules loaded per route.

```
┌──────────────────────────────────────────────────────────────┐
│                         Browser                              │
│  EJS-rendered HTML · Modular CSS · Per-page JavaScript       │
└──────────────────────────┬───────────────────────────────────┘
                           │  HTTPS  (JWT in HttpOnly cookies)
┌──────────────────────────▼───────────────────────────────────┐
│                     Express Application                      │
│                                                              │
│  Security headers → Compression → Rate limiter → Body parser │
│  → Route loader → Controllers → Services → Mongoose          │
└──────────────────────────┬───────────────────────────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
┌───────▼──────┐  ┌────────▼────────┐  ┌──────▼───────┐
│   MongoDB    │  │  GitHub REST    │  │ SMTP / Log   │
│  (Mongoose)  │  │  (public API)   │  │  (Nodemailer)│
└──────────────┘  └─────────────────┘  └──────────────┘
```

**Key architectural decisions:**

- **Sessions live in MongoDB**, not in the JWT alone. Every request validates
  the session document, which allows immediate revocation.
- **Routes are declared, not listed.** The registry records each endpoint's
  visibility, environment, and feature flag so that the exposed surface can be
  audited.
- **Uploads are stored on disk**, outside the `public/` directory, and served
  through a dedicated, header-hardened static middleware.
- **External services are treated as unreliable.** GitHub and GeoIP calls are
  cached, retried with exponential backoff, and degraded gracefully when they
  fail.

---

## Project Structure

```
devhub/
├── backend/
│   └── src/
│       ├── api/            → declarative route entry points (auto-mounted)
│       ├── config/         → environment, database, upload, API registry
│       ├── controllers/    → request handlers
│       ├── lib/            → route loader
│       ├── middleware/     → auth, roles, ownership, security, errors
│       ├── models/         → Mongoose schemas
│       ├── pages/          → HTML route entry points (auto-mounted)
│       ├── routes/         → concrete router implementations
│       ├── scripts/        → CLI utilities
│       ├── services/       → business logic (mail, GitHub, explore, …)
│       ├── types/          → shared TypeScript types
│       ├── utils/          → helpers, error factories, token utilities
│       ├── validators/     → Zod schemas
│       ├── app.ts          → Express application assembly
│       └── index.ts        → process entry point
│
├── frontend/
│   ├── public/
│   │   ├── assets/         → logo and static images
│   │   ├── js/             → client-side modules
│   │   └── styles/         → modular CSS
│   └── views/
│       ├── components/     → EJS partials (header, footer, dialogs, …)
│       └── pages/          → full page templates
│
├── docs/                   → project documentation
├── docker-compose.yml      → local MongoDB + Mongo Express
├── example.env             → environment template
├── nodemon.json            → development watcher configuration
├── package.json
└── tsconfig.json
```

---

## Getting Started

### Prerequisites

- **Node.js** version 20 or later
- **MongoDB** version 7 or later, running locally or reachable over the network
  (MongoDB Atlas works out of the box)
- **npm** or **pnpm**

### 1. Clone the repository

```bash
git clone https://github.com/Sobhan-SRZA/DevHub.git
cd DevHub
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure the environment

```bash
cp example.env .env
```

At minimum, edit `.env` and set:

```env
MONGODB_URI=mongodb://localhost:27017/devhub
JWT_SECRET=<at least 32 random characters>
```

Generate a strong secret with:

```bash
openssl rand -hex 32
```

Every variable is documented in [Environment Variables](#environment-variables).

### 4. Start MongoDB

If you do not already have a MongoDB instance running, the included
`docker-compose.yml` will start one along with a browser-based administration
interface:

```bash
docker compose up -d
```

This exposes:

- MongoDB on `localhost:27017`
- Mongo Express (web UI) on `http://localhost:8081`

### 5. Start the application

```bash
# Development — TypeScript executed directly with nodemon and tsx
npm run dev

# Production
npm run build
npm start
```

The server listens on `http://localhost:3000` by default.

### 6. Seed the default taxonomy

On first start, the application automatically seeds the default categories and
tags. To run the seed explicitly:

```bash
npx tsx backend/src/scripts/seedDefaultData.ts
```

### 7. Create the first developer account

The first registered user automatically receives the `developer` role. You can
also designate an account explicitly:

```env
DEVELOPER_EMAIL=you@example.com
```

On startup, `ensureDeveloperExists()` promotes that account if it exists. For
manual promotion:

```bash
npx tsx backend/src/scripts/promoteUser.ts you@example.com developer "Main administrator"
```

### 8. Verify the installation

```bash
curl http://localhost:3000/api/v1/health
# → { "status": "ok" }
```

Then open `http://localhost:3000` and complete the registration flow. You will
receive a 6-digit code; in `MAIL_MODE=log`, the code is written to the console.

---

## Environment Variables

The following variables are recognised. Required variables must be present at
boot or the process will exit.

### Server

| Variable        |  Required  | Default        | Description                                                                                          |
| --------------- | :--------: | -------------- | ---------------------------------------------------------------------------------------------------- |
| `PORT`          |     ✅      | —              | HTTP port.                                                                                           |
| `APP_URL`       | production | —              | Public URL, without a trailing slash. Used for canonical URLs, Open Graph metadata, and the sitemap. |
| `APP_ENV`       |     —      | `development`  | One of `development`, `staging`, `production`. Overrides `NODE_ENV` for API filtering.               |
| `TRUST_PROXY`   |     —      | —              | Set to `1` when behind a reverse proxy so client IPs are identified correctly.                       |
| `FEATURE_FLAGS` |     —      | —              | Comma-separated feature flags (e.g. `beta-ui,new-search`).                                           |
| `API_STRICT`    |     —      | `true` in prod | When `true`, undeclared endpoints are flagged at boot.                                               |

### Authentication

| Variable         | Required | Default | Description                                                 |
| ---------------- | :------: | ------- | ----------------------------------------------------------- |
| `JWT_SECRET`     |    ✅     | —       | Signing key. Minimum 64 characters in production.           |
| `JWT_EXPIRES_IN` |    —     | `7d`    | Access token lifetime. Refresh tokens are fixed at 30 days. |

### Database

| Variable      | Required | Description                                                            |
| ------------- | :------: | ---------------------------------------------------------------------- |
| `MONGODB_URI` |    ✅     | Full MongoDB connection string, including credentials when applicable. |

### Roles

| Variable          | Required | Description                                                                    |
| ----------------- | :------: | ------------------------------------------------------------------------------ |
| `DEVELOPER_EMAIL` |    —     | If set and the account exists, it is promoted to `developer` during bootstrap. |

### GitHub

| Variable                    |  Required   | Description                                                                                                                                                            |
| --------------------------- | :---------: | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GITHUB_TOKEN`              | recommended | Personal access token. Raises the hourly quota from 60 to 5,000 requests. No scope is required for public repositories; the `repo` scope is required for private ones. |
| `GITHUB_SYNC_MAX_AGE_HOURS` |      —      | Maximum staleness before a project re-syncs automatically. Defaults to 6 hours.                                                                                        |

### Email

| Variable            | Required | Default             | Description                                                             |
| ------------------- | :------: | ------------------- | ----------------------------------------------------------------------- |
| `MAIL_MODE`         |    —     | `log`               | `log` writes messages to the console; `smtp` delivers through a server. |
| `MAIL_FROM_NAME`    |    —     | `App`               | Display name for outgoing mail.                                         |
| `MAIL_FROM_ADDRESS` |    —     | `noreply@localhost` | Sender address.                                                         |
| `MAIL_REPLY_TO`     |    —     | —                   | Optional reply-to address.                                              |
| `MAIL_HELO_NAME`    |    —     | —                   | Optional HELO/EHLO hostname.                                            |
| `MAIL_FAIL_FAST`    |    —     | `false`             | Terminate startup if SMTP initialisation fails.                         |
| `MAIL_DEBUG`        |    —     | `false`             | Verbose SMTP diagnostics.                                               |

### SMTP (when `MAIL_MODE=smtp`)

| Variable              | Required | Description                                                       |
| --------------------- | :------: | ----------------------------------------------------------------- |
| `SMTP_HOST`           |    ✅     | Server hostname.                                                  |
| `SMTP_PORT`           |    ✅     | Port. `465` enables implicit TLS; other ports negotiate STARTTLS. |
| `SMTP_USER`           |    ✅     | Authentication user.                                              |
| `SMTP_PASS`           |    ✅     | Authentication password.                                          |
| `SMTP_SECURE`         |    —     | Force TLS. Inferred from the port when unset.                     |
| `SMTP_TIMEOUT_MS`     |    —     | Connection and greeting timeout. Defaults to 15,000.              |
| `SMTP_ALLOW_INSECURE` |    —     | Development only. Disables certificate validation.                |

---

## Roles and Permissions

DevHub implements three hierarchical roles. A role inherits every capability
of the roles below it.

```
user  →  admin  →  developer
```

| Capability                         | user  | admin | developer |
| ---------------------------------- | :---: | :---: | :-------: |
| Create and edit own projects       |   ✅   |   ✅   |     ✅     |
| Create tags                        |   ✅   |   ✅   |     ✅     |
| Request a new category             |   ✅   |   ✅   |     ✅     |
| Approve categories                 |   ❌   |   ✅   |     ✅     |
| Approve tags created by others     |   ❌   |   ✅   |     ✅     |
| Manage users                       |   ❌   |   ✅   |     ✅     |
| Change role: `user` ↔ `admin`      |   ❌   |   ✅   |     ✅     |
| Change role → `developer`          |   ❌   |   ❌   |     ✅     |
| Ban and unban users                |   ❌   |   ✅   |     ✅     |
| Access system diagnostics and logs |   ❌   |   ❌   |     ✅     |
| Access ticket management           |   ❌   |   ✅   |     ✅     |

**Bootstrap behaviour:**

1. The first user to complete registration becomes `developer`.
2. If `DEVELOPER_EMAIL` matches an existing account during startup, that
   account is promoted to `developer`.
3. Otherwise, the earliest registered user is promoted during bootstrap.
4. After the initial bootstrap, roles may only be changed through the admin
   interface or the `promoteUser` CLI script.

Administrators cannot modify developer accounts or assign the `developer` role.
No user may change their own role.

---

## API Reference

All JSON endpoints live under `/api`. The vast majority of application
endpoints are namespaced under `/api/v1`.

### Base URLs

| Group      | Prefix                                | Authentication    |
| ---------- | ------------------------------------- | ----------------- |
| Auth       | `/api/v1/auth`                        | —                 |
| Profile    | `/api/profile`                        | Required          |
| Projects   | `/api/v1/projects`                    | Optional          |
| Reviews    | `/api/v1/projects/:idOrSlug/reviews`  | Optional          |
| Comments   | `/api/v1/projects/:idOrSlug/comments` | Optional          |
| Tags       | `/api/v1/tags`                        | —                 |
| Categories | `/api/v1/tag-types`                   | —                 |
| Users      | `/api/v1/users`                       | —                 |
| Admin      | `/api/v1/admin`                       | `admin` or higher |
| System     | `/api/v1/system`                      | `developer`       |
| Tickets    | `/api/v1/tickets`                     | Mixed             |
| Contact    | `/api/v1/contact`                     | —                 |
| Health     | `/api/v1/health`                      | —                 |
| Manifest   | `/api/_meta`                          | —                 |

### Authentication Endpoints

| Method   | Path                                 | Description                                         |
| -------- | ------------------------------------ | --------------------------------------------------- |
| `POST`   | `/api/v1/auth/register`              | Create an account and dispatch a verification code. |
| `POST`   | `/api/v1/auth/verify-email`          | Verify the address and issue a session.             |
| `POST`   | `/api/v1/auth/resend-verification`   | Resend the verification code.                       |
| `POST`   | `/api/v1/auth/login`                 | Authenticate with an email or username.             |
| `POST`   | `/api/v1/auth/refresh`               | Exchange a refresh token for a new access token.    |
| `POST`   | `/api/v1/auth/logout`                | Terminate the current session.                      |
| `POST`   | `/api/v1/auth/logout-all`            | Terminate every session for the account.            |
| `POST`   | `/api/v1/auth/forgot-password`       | Begin password recovery.                            |
| `POST`   | `/api/v1/auth/reset-password`        | Complete password recovery.                         |
| `POST`   | `/api/v1/auth/resend-password-reset` | Resend the recovery code.                           |
| `GET`    | `/api/v1/auth/me`                    | Return the current user and session.                |
| `GET`    | `/api/v1/auth/sessions`              | List active sessions.                               |
| `DELETE` | `/api/v1/auth/sessions/:id`          | Revoke a specific session.                          |

### Project Endpoints

| Method   | Path                                   | Description                                         |
| -------- | -------------------------------------- | --------------------------------------------------- |
| `GET`    | `/api/v1/projects`                     | Paginated list with search, filtering, and sorting. |
| `GET`    | `/api/v1/projects/explore`             | Discovery feed, ranked by Hot Score.                |
| `GET`    | `/api/v1/projects/home-feed`           | Home page sections and platform statistics.         |
| `GET`    | `/api/v1/projects/:idOrSlug`           | Single project by ID or slug.                       |
| `POST`   | `/api/v1/projects`                     | Create a project.                                   |
| `PUT`    | `/api/v1/projects/:id`                 | Update a project (owner only).                      |
| `DELETE` | `/api/v1/projects/:id`                 | Delete a project (owner only).                      |
| `POST`   | `/api/v1/projects/:id/sync-github`     | Manually synchronise with GitHub.                   |
| `PATCH`  | `/api/v1/projects/:id/status`          | Change the publication status.                      |
| `POST`   | `/api/v1/projects/:id/images`          | Upload images.                                      |
| `DELETE` | `/api/v1/projects/:id/images/:imageId` | Remove an image.                                    |
| `PATCH`  | `/api/v1/projects/:id/images/order`    | Reorder images.                                     |
| `POST`   | `/api/v1/projects/:id/video`           | Upload the demo video.                              |
| `DELETE` | `/api/v1/projects/:id/video`           | Remove the demo video.                              |
| `POST`   | `/api/v1/projects/:id/file`            | Upload the downloadable archive.                    |
| `DELETE` | `/api/v1/projects/:id/file`            | Remove the archive.                                 |
| `GET`    | `/api/v1/projects/:idOrSlug/download`  | Increment counters and redirect to the file.        |

### Review Endpoints

| Method   | Path                                             | Description                                                 |
| -------- | ------------------------------------------------ | ----------------------------------------------------------- |
| `GET`    | `/api/v1/projects/:idOrSlug/reviews`             | List reviews with distribution and the caller's own review. |
| `GET`    | `/api/v1/projects/:idOrSlug/reviews/me`          | Return only the caller's review.                            |
| `POST`   | `/api/v1/projects/:idOrSlug/reviews`             | Submit a review.                                            |
| `PUT`    | `/api/v1/projects/:idOrSlug/reviews`             | Update the caller's review.                                 |
| `DELETE` | `/api/v1/projects/:idOrSlug/reviews`             | Delete the caller's review.                                 |
| `POST`   | `/api/v1/projects/:idOrSlug/reviews/:id/helpful` | Mark a review as helpful.                                   |

### Comment Endpoints

| Method   | Path                                           | Description                                   |
| -------- | ---------------------------------------------- | --------------------------------------------- |
| `GET`    | `/api/v1/projects/:idOrSlug/comments`          | List comments, optionally filtered by parent. |
| `POST`   | `/api/v1/projects/:idOrSlug/comments`          | Create a comment or reply.                    |
| `PUT`    | `/api/v1/projects/:idOrSlug/comments/:id`      | Edit a comment (author only).                 |
| `DELETE` | `/api/v1/projects/:idOrSlug/comments/:id`      | Delete a comment (author only).               |
| `POST`   | `/api/v1/projects/:idOrSlug/comments/:id/like` | Toggle a like.                                |

### Tag and Category Endpoints

| Method   | Path                            | Description                               |
| -------- | ------------------------------- | ----------------------------------------- |
| `GET`    | `/api/v1/tags`                  | List tags.                                |
| `GET`    | `/api/v1/tags/suggest`          | Autocomplete.                             |
| `GET`    | `/api/v1/tags/:id`              | Retrieve a tag.                           |
| `POST`   | `/api/v1/tags/find-or-create`   | Resolve a tag by name or create it.       |
| `POST`   | `/api/v1/tags`                  | Create a tag.                             |
| `PUT`    | `/api/v1/tags/:id`              | Update a tag.                             |
| `DELETE` | `/api/v1/tags/:id`              | Delete an unused tag.                     |
| `GET`    | `/api/v1/tags/pending`          | List pending tags and categories (admin). |
| `POST`   | `/api/v1/tags/:id/approve`      | Approve a tag (admin).                    |
| `GET`    | `/api/v1/tag-types`             | List categories.                          |
| `GET`    | `/api/v1/tag-types/:id`         | Retrieve a category with its tags.        |
| `POST`   | `/api/v1/tag-types`             | Create a category (admin).                |
| `POST`   | `/api/v1/tag-types/request`     | Request a new category.                   |
| `PUT`    | `/api/v1/tag-types/:id`         | Update a category (admin).                |
| `DELETE` | `/api/v1/tag-types/:id`         | Delete an empty category (admin).         |
| `POST`   | `/api/v1/tag-types/:id/approve` | Approve a pending category (admin).       |

### User Endpoints

| Method | Path                                   | Description                               |
| ------ | -------------------------------------- | ----------------------------------------- |
| `GET`  | `/api/v1/users`                        | Paginated directory.                      |
| `GET`  | `/api/v1/users/:idOrUsername`          | Public profile with aggregate statistics. |
| `GET`  | `/api/v1/users/:idOrUsername/projects` | Projects published by the user.           |
| `GET`  | `/api/v1/users/:idOrUsername/reviews`  | Reviews received on the user's projects.  |
| `GET`  | `/api/v1/users/me/stats`               | Personal analytics for the caller.        |

### Administrative Endpoints

| Method  | Path                           | Description                             |
| ------- | ------------------------------ | --------------------------------------- |
| `GET`   | `/api/v1/admin/users`          | List users with search and role filter. |
| `POST`  | `/api/v1/admin/users/:id/role` | Change a user's role.                   |
| `POST`  | `/api/v1/admin/users/:id/ban`  | Toggle a user's ban status.             |
| `GET`   | `/api/v1/tickets`              | List tickets.                           |
| `GET`   | `/api/v1/tickets/:id`          | Retrieve a ticket thread.               |
| `POST`  | `/api/v1/tickets/:id/reply`    | Post a staff reply.                     |
| `PATCH` | `/api/v1/tickets/:id`          | Update status, priority, or assignee.   |

### Ticket Endpoints (Public)

| Method | Path                                 | Description                           |
| ------ | ------------------------------------ | ------------------------------------- |
| `GET`  | `/api/v1/tickets/track/:token`       | Retrieve a ticket via tracking token. |
| `POST` | `/api/v1/tickets/track/:token/reply` | Reply to a ticket via tracking token. |
| `POST` | `/api/v1/tickets/lookup`             | Request an email-based lookup code.   |
| `POST` | `/api/v1/tickets/lookup/verify`      | Verify the code and list tickets.     |
| `GET`  | `/api/v1/tickets/my`                 | List the caller's tickets.            |

### System and Diagnostic Endpoints

| Method | Path                           | Description                                 |
| ------ | ------------------------------ | ------------------------------------------- |
| `GET`  | `/api/v1/health`               | Liveness probe.                             |
| `GET`  | `/api/v1/health/detailed`      | Detailed health check (developer).          |
| `GET`  | `/api/v1/system/stats`         | Process, memory, CPU, and database metrics. |
| `GET`  | `/api/v1/system/logs`          | Query log entries.                          |
| `GET`  | `/api/v1/system/logs/download` | Download a log file.                        |
| `POST` | `/api/v1/system/logs/clear`    | Clear the in-memory buffer.                 |
| `GET`  | `/api/_meta`                   | Public API summary.                         |
| `GET`  | `/api/_meta/full`              | Complete manifest (developer).              |
| `GET`  | `/api/_meta/diff`              | Environment diff (developer).               |

### Request Examples

```bash
# Register a new account
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Alex Morgan",
    "username": "alexmorgan",
    "email": "alex@example.com",
    "password": "securePass123",
    "confirmPassword": "securePass123",
    "terms": true
  }'

# Authenticate
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{ "identifier": "alexmorgan", "password": "securePass123" }'

# List trending projects
curl "http://localhost:3000/api/v1/projects/explore?sort=trending&window=7d&limit=20"

# Retrieve a project by slug
curl http://localhost:3000/api/v1/projects/my-awesome-app

# Create a project (authenticated via cookie)
curl -X POST http://localhost:3000/api/v1/projects \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "title": "My Awesome App",
    "shortDescription": "A tool for organising tasks.",
    "fullDescription": "Detailed description in Markdown.",
    "status": "published",
    "isPublic": true
  }'
```

---

## Response Format

Every JSON endpoint returns one of two shapes.

**Success:**

```json
{
  "ok": true,
  "message": "Optional human-readable message.",
  "data": { }
}
```

Some endpoints return top-level fields instead of a `data` envelope for
backwards compatibility (for example `{ "ok": true, "projects": [...] }`).
Clients should check `ok` first.

**Error:**

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

`code` is a stable, machine-readable identifier. `field` and `details` are
optional and appear only when relevant.

---

## Security

DevHub implements a defence-in-depth approach. The table below summarises the
primary controls; the full policy, including reporting procedures, is documented
in [`SECURITY.md`](./SECURITY.md).

### Authentication and Sessions

| Control            | Implementation                                                                                          |
| ------------------ | ------------------------------------------------------------------------------------------------------- |
| Password hashing   | bcrypt with 12 rounds and a per-hash salt.                                                              |
| Password policy    | Minimum 8 characters for resets; requires mixed case and digits.                                        |
| Access tokens      | HS256 JWTs, default lifetime of 7 days, cookie `HttpOnly`.                                              |
| Refresh tokens     | 30-day lifetime, stored only as a hash on the session document.                                         |
| Token typing       | `typ` claim distinguishes access, refresh, email verification, and password reset tokens.               |
| Refresh rotation   | Every refresh call issues a fresh access token and updates session activity.                            |
| Session revocation | Individual sessions can be revoked; password changes revoke all others.                                 |
| OTP storage        | SHA-256 hash with a per-record salt. The plaintext code is never persisted.                             |
| OTP TTL            | 10 minutes for verification, 15 minutes for password reset.                                             |
| OTP attempt limit  | Five attempts per code, after which the code is deleted.                                                |
| OTP cooldown       | 60 seconds between code requests.                                                                       |
| Anti-enumeration   | Uniform responses for existing and non-existing accounts on login, password recovery, and email lookup. |

### Cookies

```typescript
const cookieOptions = {
  httpOnly: true,                                      // Inaccessible to JavaScript
  secure: process.env.NODE_ENV === "production",       // HTTPS only in production
  sameSite: "lax",                                     // Cross-site mitigation
  path: "/",
};
```

### Input Validation

Every input passes through a Zod schema before reaching a controller. The
following rules are enforced throughout:

| Field              | Rule                                                                                            |
| ------------------ | ----------------------------------------------------------------------------------------------- |
| Username           | `[a-zA-Z0-9_.-]{3,20}`                                                                          |
| Email              | RFC-compatible regex, lowercased, max 254 characters                                            |
| Password           | Minimum 6 characters with at least one letter and one digit (registration); stricter for resets |
| MongoDB identifier | `/^[a-f\d]{24}$/i`                                                                              |
| Slug               | `/^[a-z0-9-]{2,80}$/`                                                                           |
| Colour             | `/^#[0-9a-fA-F]{6}$/`                                                                           |

Validation failures raise a structured `VALIDATION_ERROR` with per-field
details.

### Upload Security

| Control             | Implementation                                                                                                             |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Storage location    | Outside the public web root; served through a dedicated middleware.                                                        |
| Filename generation | Timestamp plus 12 random bytes, preserving only the original extension.                                                    |
| MIME allowlist      | Images (`jpeg`, `png`, `webp`, `gif`), video (`mp4`, `webm`, `quicktime`), archives (`zip`, `rar`, `7z`, `tar`, `gz`).     |
| Size limits         | Images 5 MB, video 200 MB, archive 500 MB.                                                                                 |
| Count limits        | Ten images, one video, one archive per project.                                                                            |
| Response headers    | `X-Content-Type-Options: nosniff` on all uploads; HTML and SVG files are forced to download as `application/octet-stream`. |

### HTTP Security Headers

Applied by a custom middleware equivalent to Helmet:

- `Content-Security-Policy` restricting sources to the same origin
- `Strict-Transport-Security` in production (`max-age=15552000`)
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy` disabling camera, microphone, geolocation, payment, and USB
- `X-Powered-By` removed

### Additional Controls

- **Path traversal** — rejected at the middleware layer; file access is
  constrained with `path.basename` and prefix resolution.
- **HTML sanitisation** — Markdown rendering passes through a whitelist-based
  sanitiser that strips event handlers, `javascript:` URLs, and unsafe tags.
- **Rate limiting** — tiered by endpoint visibility (see below).
- **Logging hygiene** — passwords, tokens, OTPs, and cookies are never written
  to logs.
- **Constant-time comparisons** — used for OTP verification and token
  validation.

---

## The Hot Score Algorithm

The discover feed ranks projects using a Hacker News-inspired score with
configurable time decay.

### Point Calculation

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

Each coefficient reflects the relative value of the signal. Forks, for
example, indicate active reuse and are weighted more heavily than stars.

### Time Decay

```
ageHours  = (now - createdAt) / 3,600,000
hotScore  = points / (ageHours + 2) ^ gravity
```

The gravity constant depends on the requested window:

| Window | Gravity | Interpretation                          |
| ------ | :-----: | --------------------------------------- |
| `24h`  |   1.5   | Steep decay; emphasises fresh projects. |
| `7d`   |   1.8   | Balanced; the default for `trending`.   |
| `30d`  |   2.0   | Sharper decay over a longer window.     |
| `all`  |   0.0   | No decay; pure cumulative ranking.      |

The `+2` offset in the denominator prevents division by zero and moderates the
first few hours of a project's life.

### Implementation

The ranking is computed entirely within MongoDB using an aggregation pipeline,
so the application only retrieves the requested page. Results are cached for
five minutes per parameter combination.

---

## GitHub Integration

When a project is linked to a GitHub repository, DevHub maintains a snapshot of
public metadata and refreshes it on a schedule.

### Synchronised Fields

- Full repository name and description
- Primary language and SPDX licence identifier
- Stars, watchers, forks, and open issues
- Topic list and default branch
- Archived and forked flags
- Repository creation, update, and push timestamps
- Total downloads across the most recent releases

### Behaviour

- **Cache** — repository metadata is cached for 15 minutes; download statistics
  for one hour.
- **ETag support** — conditional requests are used so that unchanged responses
  do not consume quota.
- **Rate-limit awareness** — remaining quota and reset time are read from
  response headers. When the quota falls below a safety margin, the client
  waits for the reset window before continuing.
- **Concurrency control** — a counting semaphore limits simultaneous requests
  to three. Concurrent callers requesting the same repository share a single
  in-flight request.
- **Retries** — transient failures are retried up to three times with
  exponential backoff. `Retry-After` headers are honoured.
- **Graceful degradation** — download statistics default to zero when the
  releases collection cannot be fetched; metadata retrieval is never blocked
  by a failure in the auxiliary call.

### Authentication

Without a `GITHUB_TOKEN`, GitHub enforces a quota of 60 requests per hour per
IP address. Setting a token raises the limit to 5,000. Public repositories
require no scopes; private repository synchronisation requires the `repo`
scope.

---

## Email System

The email subsystem is abstracted behind a transport layer that can be swapped
without touching callers.

### Modes

| Mode   | Behaviour                                                  | Use Case                 |
| ------ | ---------------------------------------------------------- | ------------------------ |
| `log`  | Messages are written to the console with boxed formatting. | Development and testing. |
| `smtp` | Messages are delivered through a configured SMTP server.   | Production.              |

### Transports

Both transports share the same interface, so switching modes requires only an
environment change. The SMTP transport:

- Uses a connection pool with up to three connections.
- Enforces TLS 1.2 or later and validates certificates by default.
- Configures connection, greeting, and socket timeouts.
- Reuses connections across messages and closes the pool on shutdown.

### Rate Limiting

Each recipient address is independently limited to five messages per minute.
Exceeding the limit returns a structured `TOO_MANY_ATTEMPTS` error with a
`Retry-After` hint.

### Templates

- **OTP template** — used for email verification, password change, email change,
  two-factor authentication, and password recovery. Each purpose has its own
  subject line, description, and emoji marker.
- **Ticket templates** — creation confirmation and staff reply notifications.
- **Lookup template** — used by the email-based ticket retrieval flow.

All templates are HTML with plain-text fallbacks. User-supplied values are
escaped before interpolation.

---

## Rate Limiting

DevHub applies rate limiting at multiple layers.

### Global Limiter

Applied to every `/api/*` request:

| Window     |        Limit        |
| ---------- | :-----------------: |
| 15 minutes | 400 requests per IP |

### Authentication Limiter

Applied to `/register`, `/login`, and `/refresh`:

| Window     |       Limit        |
| ---------- | :----------------: |
| 15 minutes | 30 requests per IP |

### Sensitive Limiter

Applied to email verification, password reset, contact submission, and ticket
operations:

| Window |       Limit        |
| ------ | :----------------: |
| 1 hour | 10 requests per IP |

### Tiered API Limiter

Endpoints declared through `apiGuard()` inherit a limiter based on their
visibility. Each endpoint receives its own limiter instance, so quotas do not
bleed between endpoints.

| Visibility      | Window | Limit | Key                        |
| --------------- | :----: | :---: | -------------------------- |
| `public`        |  60 s  |  60   | IP                         |
| `authenticated` |  60 s  |  120  | User ID (falls back to IP) |
| `admin`         |  60 s  |  240  | User ID                    |
| `developer`     |  60 s  |  240  | User ID                    |

Individual endpoints may override these defaults. For example, uploads are
limited to 30 per hour per user, username changes to 3 per hour, and email
changes to 5 per hour.

### Email Limiter

Applied inside the mail service, independently of HTTP rate limiting:

| Scope                 | Window |   Limit    |
| --------------------- | :----: | :--------: |
| Per recipient address |  60 s  | 5 messages |

---

## SEO and Metadata

Every public page is rendered with a complete metadata head:

- **Title and description** with per-page overrides.
- **Canonical URL** derived from `APP_URL` when set, or from the request host
  otherwise.
- **Open Graph tags** — type, title, description, URL, image, and locale.
- **Twitter Card** — `summary_large_image` with title, description, and image.
- **Robots directives** — `index, follow` for public pages; `noindex, nofollow`
  for authentication and dashboard routes.
- **JSON-LD** — structured data is emitted where relevant:
  - `WebSite` on the home page
  - `SoftwareApplication` on project pages, including aggregate rating,
    author, and interaction counters
  - `Person` on user profiles
  - `AboutPage`, `CollectionPage`, and `FAQPage` where appropriate.
- **Sitemap** — dynamically generated at `/sitemap` and redirected from
  `/sitemap.xml`. Includes static pages, all published projects, and user
  profiles.
- **Robots.txt** — served from the public directory with appropriate
  disallow rules.

### Performance

- Fonts are loaded asynchronously with a `<noscript>` fallback.
- Critical CSS is loaded synchronously; page-specific CSS is declared per
  route.
- Static assets receive a `Cache-Control` header of one week in production,
  with `stale-while-revalidate`.
- Uploads are served with `X-Content-Type-Options: nosniff` and are configured
  to download rather than render when they are HTML or SVG.

---

## Command-Line Scripts

All scripts are TypeScript modules executed through `tsx`. They connect to the
database using the same configuration as the application.

### Promote a User

```bash
npx tsx backend/src/scripts/promoteUser.ts <email> <role> [reason]
```

**Arguments:**

- `email` — the account to modify.
- `role` — one of `user`, `admin`, `developer`.
- `reason` — optional audit note.

### Bootstrap the First Administrator

```bash
npx tsx backend/src/scripts/setupFirstAdmin.ts
```

Runs `ensureDeveloperExists()`, which promotes `DEVELOPER_EMAIL` if configured,
or the earliest registered user otherwise.

### Seed Default Taxonomy

```bash
npx tsx backend/src/scripts/seedDefaultData.ts
```

Creates the ten default categories and their associated tags. Existing records
are preserved.

### Synchronise Indexes

```bash
npx tsx backend/src/scripts/syncIndexes.ts
```

Ensures all Mongoose-defined indexes exist and removes legacy TTL indexes when
their configuration has changed.

### Clean Up Verification Codes

```bash
npx tsx backend/src/scripts/cleanupVerificationCodes.ts
```

Removes expired and consumed verification codes. Safe to run periodically, for
example as a cron job.

### Test Email Delivery

```bash
npx tsx backend/src/scripts/testMail.ts you@example.com
```

Sends a test OTP using the configured transport. In `smtp` mode, the SMTP
connection is verified first.

---

## Docker Support

The repository includes a `docker-compose.yml` for local development. It does
not containerise the application itself; it provides the dependencies the
application needs.

```yaml
services:
  mongo:
    image: mongo:7
    ports:
      - "27017:27017"
    volumes:
      - mongodata:/data/db

  mongo-express:
    image: mongo-express:1.0.2
    depends_on:
      - mongo
    ports:
      - "8081:8081"
    environment:
      ME_CONFIG_MONGODB_URL: mongodb://mongo:27017/
      ME_CONFIG_BASICAUTH: "false"
```

Start the services:

```bash
docker compose up -d
```

Stop them:

```bash
docker compose down
```

---

## Deployment Notes

### Required Configuration

Before deploying to production:

1. Set `APP_URL` to the public domain.
2. Set `JWT_SECRET` to at least 64 random characters.
3. Set `MAIL_MODE` to `smtp` and configure the SMTP section.
4. Set `NODE_ENV=production` and `APP_ENV=production`.
5. Set `TRUST_PROXY=1` if behind a reverse proxy.
6. Set `GITHUB_TOKEN` to raise the API quota.
7. Run `npm run build` and start with `npm start`.

### Reverse Proxy

The application is designed to run behind Nginx or a comparable reverse proxy.
Enable `TRUST_PROXY=1` so that client IPs used for rate limiting and session
metadata are correct.

### Database

MongoDB should be configured with authentication enabled. The connection
string in `MONGODB_URI` should include the credentials and the appropriate
`authSource`. Enable regular backups; the session and verification collections
include TTL indexes that rely on MongoDB's TTL monitor running normally.

### Process Management

Run the application under a process manager such as systemd, PM2, or Docker.
The process handles `SIGTERM` by closing the mail transport and exiting
gracefully, so restart cycles do not leave connections open.

### Health Checks

Use `GET /api/v1/health` for liveness probes. The endpoint returns
`{ "status": "ok" }` as soon as the HTTP server is accepting connections.
For readiness, use `GET /api/v1/health/detailed` and check the
`database.connected` field.

---

## Roadmap

### Version 1.1 — Community Growth

- [ ] Follow and unfollow users
- [ ] Notification system (in-app inbox and email digest)
- [ ] Activity feed on user profiles
- [ ] Refined rate limiting for authentication endpoints
- [ ] CSP reporting endpoint

### Version 1.2 — Scale and Depth

- [ ] Full-text search (MongoDB text index or Elasticsearch)
- [ ] Live comment updates over Server-Sent Events
- [ ] Comprehensive admin panel UI
- [ ] User preferences (locale, notification channels)
- [ ] Audit log for administrative actions

### Version 2.0 — Ecosystem

- [ ] Public, versioned REST API
- [ ] Two-factor authentication via TOTP
- [ ] GraphQL endpoint
- [ ] Webhooks for project events
- [ ] GitHub Action integration
- [ ] Mobile application
- [ ] Plugin system for custom content formats

---

## Contributing

Contributions are welcome through pull requests and issues.

### Workflow

```bash
# 1. Fork the repository
# 2. Create a feature branch
git checkout -b feature/descriptive-name

# 3. Commit with a conventional message
git commit -m "feat: add descriptive feature"

# 4. Push to the branch
git push origin feature/descriptive-name

# 5. Open a pull request
```

### Guidelines

- Match the existing code style: strict TypeScript, Zod validation, and
  structured error handling.
- Add or update tests where applicable.
- Do not introduce breaking changes to existing endpoints.
- Update `README.md` and `docs/` where behaviour changes.

Refer to [`CONTRIBUTING.md`](./CONTRIBUTING.md) for the complete guide.

---

## License

Distributed under the **BSD 3-Clause License**.

```
BSD 3-Clause License

Copyright (c) 2026 Sobhan Rasoulzadeh Asl (Sobhan-SRZA / Mr. Sinre)
All rights reserved.
```

See [`LICENSE`](./LICENSE) for the full text.

---

## Acknowledgements

DevHub is built on the shoulders of the open-source community. The design was
informed by:

- **[GitHub](https://github.com)** — for the tagging taxonomy and review model
- **[Hacker News](https://news.ycombinator.com)** — for the Hot Score ranking
  approach
- **[Product Hunt](https://www.producthunt.com)** — for the discovery UX
- **[OWASP](https://owasp.org)** — for the authentication and session guidance

The project relies on the excellent work of the Express, Mongoose, Zod,
Nodemailer, bcrypt, and TypeScript communities.

---

<div align="center">

**If you find DevHub useful, consider giving the repository a star.**

Maintained by [Sobhan-SRZA](https://github.com/Sobhan-SRZA).

</div>