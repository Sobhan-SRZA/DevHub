# Development TODO

> **Active work tracking for DevHub.**
> This document lists what is planned, what is in progress, what is
> deliberately deferred, and what is accepted as a known limitation. It is
> the authoritative reference for "what should we build next?" and "why
> have we not built X yet?"

The document is maintained by the project maintainer. Community contributors
are welcome to open issues referencing items here, or to propose additions.

---

## Table of Contents

- [How to Read This Document](#how-to-read-this-document)
- [Release Status](#release-status)
- [Release Blockers (v1.0 → v1.1)](#release-blockers-v10--v11)
- [Functional Gaps](#functional-gaps)
- [Documented Limitations](#documented-limitations)
- [Feature Backlog](#feature-backlog)
- [Page and Route Audit](#page-and-route-audit)
- [Testing Plan](#testing-plan)
- [Deployment Readiness](#deployment-readiness)
- [Release Checklist](#release-checklist)
- [Suggested Work Order](#suggested-work-order)
- [Decision Log](#decision-log)

---

## How to Read This Document

Each item has:

- **Severity** — how urgently it should be addressed.
- **Effort** — rough estimate in working days.
- **Status** — current state.
- **Notes** — context, constraints, and reasoning.

### Severity levels

| Level        | Meaning                                                                 |
| ------------ | ----------------------------------------------------------------------- |
| **Blocker**  | Must be resolved before the next release can be tagged.                 |
| **High**     | Should be resolved in the next release. Omission is a visible gap.      |
| **Medium**   | Should be resolved within two releases. Omission is a known limitation. |
| **Low**      | Nice to have. May be deferred indefinitely without impact.              |
| **Accepted** | Deliberately not fixed. Documented as a known limitation.               |

### Effort levels

| Level  | Meaning                             |
| ------ | ----------------------------------- |
| **S**  | Under one day.                      |
| **M**  | One to three days.                  |
| **L**  | Three to seven days.                |
| **XL** | Over one week. Requires scheduling. |

---

## Release Status

| Version        | Status                                | Target                                                              |
| -------------- | ------------------------------------- | ------------------------------------------------------------------- |
| **v1.0** (MVP) | Feature-complete. No release tag yet. | Blocked by items in [Release Blockers](#release-blockers-v10--v11). |
| **v1.1**       | Planning.                             | After v1.0.                                                         |
| **v1.2**       | Not started.                          | After v1.1.                                                         |
| **v2.0**       | Not started.                          | After v1.2.                                                         |

The v1.0 codebase is deployed on a staging environment and is functional for
internal use. It has not been tagged as a release because the items in the
Release Blockers section have not been completed.

---

## Release Blockers (v1.0 → v1.1)

These items must be resolved before a v1.0 release tag is created. They are
distinct from functional work — most are process and infrastructure items that
ensure the release can be reproduced, verified, and supported.

### B1. Create a Dockerfile for the application

| Attribute | Value         |
| --------- | ------------- |
| Severity  | Blocker       |
| Effort    | S (4–6 hours) |
| Status    | Not started   |

The `docker-compose.yml` in the repository provides MongoDB and Mongo Express
only. The application itself must be run from the host with `npm start`.
A production deployment cannot reasonably depend on manual host setup.

**Acceptance criteria:**

- Multi-stage Dockerfile (build stage with `npm ci` and `tsc`, runtime stage
  with only production dependencies).
- Runs as a non-root user.
- Exposes `PORT` from the environment.
- Health check via `GET /api/v1/health`.
- Image size under 300 MB.

**Notes:** The current `docker-compose.yml` should be extended with an `app`
service that builds from this Dockerfile, so that `docker compose up` starts
the full stack.

### B2. Add continuous integration

| Attribute | Value         |
| --------- | ------------- |
| Severity  | Blocker       |
| Effort    | S (3–5 hours) |
| Status    | Not started   |

There is no automated verification that a pull request compiles, type-checks,
or builds. Every merge depends on manual verification by the maintainer.

**Acceptance criteria:**

- GitHub Actions workflow triggered on pull request and on push to `main`.
- Steps: `npm ci`, `npx tsc --noEmit`, `npm run build`.
- Fails on any step failure.
- Adds a status badge to `README.md`.

**Notes:** Test execution is not part of this step because no tests exist yet
(see [Testing Plan](#testing-plan)). The workflow will be extended when tests
are added.

### B3. Complete `.env.example`

| Attribute | Value              |
| --------- | ------------------ |
| Severity  | Blocker            |
| Effort    | S (2 hours)        |
| Status    | Partially complete |

The `example.env` file exists but does not cover every variable documented in
`PROJECT_GUIDE.md` (Section 26). Missing variables include
`GITHUB_SYNC_MAX_AGE_HOURS`, `MAIL_HELO_NAME`, `SMTP_SECURE`,
`SMTP_TIMEOUT_MS`, and `SMTP_ALLOW_INSECURE`.

**Acceptance criteria:**

- Every variable in `PROJECT_GUIDE.md` Section 26.2 is present.
- Each variable has a comment explaining its purpose.
- Production-critical variables are marked as required.
- A short comment at the top explains how to generate `JWT_SECRET`.

### B4. Establish a staging deployment

| Attribute | Value        |
| --------- | ------------ |
| Severity  | Blocker      |
| Effort    | M (2–3 days) |
| Status    | Not started  |

The application has been tested locally, but no deployment has been verified
under production-like conditions.

**Acceptance criteria:**

- A staging server accessible at a public URL.
- `MAIL_MODE=smtp` with a real SMTP provider.
- `NODE_ENV=production`, `APP_ENV=production`.
- `APP_URL` set to the public URL.
- `JWT_SECRET` at least 64 characters.
- `TRUST_PROXY=1` if behind a reverse proxy.
- All flows from the Release Checklist verified manually.

**Notes:** This is the most expensive blocker. If a staging deployment is not
feasible for cost reasons, the alternative is to document the deployment
procedure and note that it has been verified on a local production-mode
instance. This is not equivalent but is defensible.

### B5. Write a CHANGELOG and create the v1.0 tag

| Attribute | Value       |
| --------- | ----------- |
| Severity  | Blocker     |
| Effort    | S (1 day)   |
| Status    | Not started |

**Acceptance criteria:**

- `CHANGELOG.md` following [Keep a Changelog](https://keepachangelog.com/).
- v1.0.0 entry listing all features, known limitations, and configuration
  requirements.
- `git tag v1.0.0` on the commit that will be released.
- GitHub Release created with the same content.

### B6. Write a CONTRIBUTING guide

| Attribute | Value      |
| --------- | ---------- |
| Severity  | Blocker    |
| Effort    | —          |
| Status    | ✅ Complete |

`CONTRIBUTING.md` exists and describes the workflow, coding standards, and
pull request process.

### B7. Write a security policy

| Attribute | Value      |
| --------- | ---------- |
| Severity  | Blocker    |
| Effort    | —          |
| Status    | ✅ Complete |

`SECURITY.md` exists and describes supported versions, reporting channels,
scope, and disclosure timeline.

---

## Functional Gaps

These are functional gaps in the current implementation. They are not release
blockers in the strict sense, but they represent incomplete implementations
that users will notice.

### F1. Wire the category request endpoint

| Attribute | Value        |
| --------- | ------------ |
| Severity  | High         |
| Effort    | S (half day) |
| Status    | Not started  |

`tagController.requestTagType` is defined but no route references it. The
endpoint described in older documentation (`POST /api/v1/tag-types/request`)
does not exist in `tagTypeRoutes.ts`.

**Acceptance criteria:**

- `POST /api/v1/tag-types/request` is registered in `tagTypeRoutes.ts`.
- Wrapped in `apiGuard()`, `requireAuth`, and appropriate rate limit.
- Creates an unapproved `TagType` with `createdBy` set to the caller.
- Returns the created category with a message about pending approval.
- Frontend exposes the request flow from the tag picker.

### F2. Clean up orphaned uploads

| Attribute | Value        |
| --------- | ------------ |
| Severity  | High         |
| Effort    | M (1–2 days) |
| Status    | Not started  |

If a database write fails after a file is written to disk (for example, a
validation error on `Project.save()` after an image has been uploaded), the
file remains on disk and is never referenced. Over time these orphans
accumulate.

**Acceptance criteria:**

- A script (`scripts/cleanupOrphanedUploads.ts`) that compares files in
  `backend/uploads/` against file references in the `Project` collection.
- Reports orphans without deleting them by default.
- Accepts a `--delete` flag to remove confirmed orphans.
- Logs the operation.

### F3. Deduplicate helpfulness votes

| Attribute | Value        |
| --------- | ------------ |
| Severity  | High         |
| Effort    | M (1–2 days) |
| Status    | Not started  |

`POST /api/v1/projects/:idOrSlug/reviews/:id/helpful` increments
`helpfulCount` without tracking who marked the review. The same user can
increment the count multiple times.

**Acceptance criteria:**

- Add a `helpfulVotes: ObjectId[]` field to the `Review` model.
- Add a unique compound index on `{ _id, helpfulVotes }` — or enforce
  uniqueness in the controller.
- Reject repeat votes from the same user (either silently or with a 409).
- Migrate existing `helpfulCount` values to the new structure, or reset the
  counter.

**Notes:** This changes the shape of an existing endpoint response. Coordinate
with the frontend.

### F4. Recover soft-deleted comments

| Attribute | Value        |
| --------- | ------------ |
| Severity  | Medium       |
| Effort    | S (half day) |
| Status    | Not started  |

Soft-deleted comments (comments with replies that have been deleted) cannot be
recovered through the API. An administrator must access the database directly.

**Acceptance criteria:**

- `POST /api/v1/admin/comments/:id/restore` endpoint (admin only).
- Sets `isDeleted: false`, `deletedAt: null`, restores `body` from a new
  `originalBody` field (add this field to the model).
- Rate-limited like other admin endpoints.

**Notes:** This requires adding `originalBody` to the model, which is a schema
change.

### F5. Prevent duplicate project titles

| Attribute | Value        |
| --------- | ------------ |
| Severity  | Medium       |
| Effort    | S (half day) |
| Status    | Not started  |

Two projects can have the same title as long as their slugs differ. This is
not usually a problem, but it can create confusing search results.

**Acceptance criteria:**

- Warn (do not reject) when a new project's title matches an existing project
  by the same owner. Different owners can have projects with the same title.
- Warning surfaced in the frontend as a non-blocking notice.

**Notes:** A hard rejection would be wrong — a developer may have a legitimate
reason to have two projects with similar titles. Warning is the right
behavior.

### F6. Fix the `me/stats` route shadowing risk

| Attribute | Value                      |
| --------- | -------------------------- |
| Severity  | Low                        |
| Effort    | S (2 hours)                |
| Status    | Reviewed, no change needed |

`/api/v1/users/me/stats` is registered before `/:idOrUsername`. This works
correctly today. If future code reorders the routes, `/me/stats` would be
shadowed by `/:idOrUsername` where `idOrUsername = "me"`.

**Acceptance criteria:**

- Add a comment in `userRoutes.ts` explaining why the order matters.
- Consider adding an integration test that would catch the regression.

**Notes:** No code change is strictly required. This is preventive.

### F7. Add `sitemap` health monitoring

| Attribute | Value       |
| --------- | ----------- |
| Severity  | Low         |
| Effort    | S (2 hours) |
| Status    | Not started |

`GET /sitemap` generates the sitemap on every request without caching
persistence beyond `Cache-Control: public, max-age=3600`. If the generation
fails, there is no monitoring signal.

**Acceptance criteria:**

- Return a 200 with an empty `<urlset>` on failure rather than a 500.
- Log the failure at `error` level so it appears in the log viewer.

---

## Documented Limitations

These items are **accepted** limitations. They are not planned for v1.0 and
should not be treated as bugs. Each is documented in `PROJECT_GUIDE.md`
Section 28 or `SECURITY.md`.

### L1. `'unsafe-inline'` in CSP `script-src`

| Attribute   | Value    |
| ----------- | -------- |
| Severity    | Accepted |
| Planned fix | v1.1     |

The CSP includes `'unsafe-inline'` in `script-src` and `style-src` because
pages use inline `<script>` blocks (primarily in `seo-head.ejs` for theme
initialisation and in some dashboard pages).

**Why not fixed now:** Removing `'unsafe-inline'` requires extracting every
inline script into a separate file and updating the CSP to use a nonce or
hash. This is a multi-file refactor that would delay v1.0.

**Planned approach for v1.1:**

- Extract inline theme-initialisation script into a separate file loaded
  synchronously in `<head>`.
- Extract the remaining inline scripts in dashboard pages.
- Switch CSP to `script-src 'self'` and `style-src 'self'` with hashes for
  the few inline styles that remain.

### L2. No magic-byte validation on uploads

| Attribute   | Value    |
| ----------- | -------- |
| Severity    | Accepted |
| Planned fix | v1.1     |

File uploads are validated by MIME type, which is provided by the client and
can be spoofed. A file with the bytes of an executable and the MIME type of
`image/jpeg` will pass validation.

**Why not fixed now:** The MIME allowlist is already reasonably narrow
(images, video, archives). An attacker who can upload a malicious file must
also convince a user to download and execute it. The practical risk is low
for the current audience.

**Planned approach for v1.1:**

- Add `file-type` package.
- After Multer writes the file to disk, read the first bytes and verify the
  detected type matches the declared MIME.
- Reject and delete on mismatch.

### L3. No antivirus scanning on uploads

| Attribute   | Value    |
| ----------- | -------- |
| Severity    | Accepted |
| Planned fix | v1.2     |

Uploaded files are not scanned for malware. A user who downloads an uploaded
archive is trusting the uploader.

**Why not fixed now:** Antivirus scanning requires a running ClamAV instance
or an equivalent service. This is an infrastructure dependency that not every
deployment can support.

**Planned approach for v1.2:**

- Integrate with ClamAV via `clamscan` package.
- Scan on upload; reject and delete on detection.
- Document the ClamAV requirement in deployment notes.
- Make scanning opt-in via `CLAMAV_ENABLED=true`.

### L4. Single-process rate limiting and caching

| Attribute   | Value    |
| ----------- | -------- |
| Severity    | Accepted |
| Planned fix | v1.2     |

Rate limiters and the in-memory cache are per-process. Multiple instances do
not share state. Under a load balancer, an attacker can bypass rate limits by
rotating requests across instances.

**Why not fixed now:** The project is not deployed under a load balancer.
Single-process operation is sufficient for the current scale.

**Planned approach for v1.2:**

- Add Redis as an optional dependency.
- Configure `express-rate-limit` with a Redis store when `REDIS_URL` is set.
- Move the cache module to a Redis-backed implementation behind a feature
  flag.
- Document the deployment model (single-process vs multi-process).

### L5. No background job queue

| Attribute   | Value    |
| ----------- | -------- |
| Severity    | Accepted |
| Planned fix | v1.2     |

Long-running operations (email delivery, GitHub sync) block the request that
triggers them. A slow SMTP server slows down registration.

**Why not fixed now:** Adding a job queue requires a queue implementation
(BullMQ, or a minimal in-process alternative), a worker process, and a
migration of existing blocking calls. The current blocking behavior is
acceptable at the current scale.

**Planned approach for v1.2:**

- Add BullMQ with Redis.
- Move email delivery to a worker.
- Move GitHub sync to a worker.
- Provide an in-process fallback for deployments that do not have Redis.

### L6. No session IP binding

| Attribute   | Value       |
| ----------- | ----------- |
| Severity    | Accepted    |
| Planned fix | Not planned |

Sessions are not bound to the IP address from which they were created. A
stolen session token can be used from any IP address until the session is
revoked or expires.

**Why not fixed:** IP binding breaks mobile users whose IP changes frequently
(for example, switching between Wi-Fi and cellular) and users behind CGNAT
where the entire network shares an IP. The device hash provides some
correlation but is not enforced as a validation check.

**Alternatives:**

- Bind to a coarse region rather than exact IP. Planned for v2.0.
- Bind to the device fingerprint with periodic verification. Planned for
  v1.2.

### L7. Refresh tokens are not rotated

| Attribute   | Value       |
| ----------- | ----------- |
| Severity    | Accepted    |
| Planned fix | Not planned |

`POST /api/v1/auth/refresh` issues a new access token but does not issue a new
refresh token. The existing refresh token remains valid until the session
expires or is revoked.

**Why not fixed:** Refresh token rotation introduces race conditions with
concurrent requests (two requests both attempting to refresh with the same
token will conflict). The security benefit is marginal when the session is
stored server-side and can be revoked immediately.

**Alternatives:**

- Accept the current behavior and document it. This is the chosen approach.
- Implement rotation with a grace period and single-use enforcement. This is
  significantly more complex and is not planned.

### L8. No two-factor authentication

| Attribute   | Value    |
| ----------- | -------- |
| Severity    | Accepted |
| Planned fix | v2.0     |

Accounts are protected by a single factor (password). A compromised password
gives full account access.

**Why not fixed now:** TOTP implementation requires additional UI, additional
storage (encrypted secrets), and additional flows (setup, verification,
recovery). It is not a v1.0 concern.

**Planned approach for v2.0:**

- Add `otplib` or `speakeasy`.
- Store TOTP secrets encrypted with a per-user key.
- Enforce at login when enabled.
- Generate recovery codes.

### L9. No audit log in the database

| Attribute   | Value    |
| ----------- | -------- |
| Severity    | Accepted |
| Planned fix | v1.2     |

Administrative actions (role changes, bans, ticket updates) are logged to the
console and daily log file but not to a queryable database collection.

**Why not fixed now:** A database-backed audit log requires a new model, new
indexes, and a query interface. The current log files are sufficient for
debugging, but not for compliance.

**Planned approach for v1.2:**

- Add an `AuditLog` model with `actor`, `action`, `target`, `before`,
  `after`, `timestamp`, `ip`.
- Write from every admin controller.
- Provide a filterable UI in the admin panel.

### L10. No notification system

| Attribute   | Value    |
| ----------- | -------- |
| Severity    | Accepted |
| Planned fix | v1.1     |

Users are not notified when their projects receive reviews, when their
comments receive replies, or when their tickets receive staff responses
(except by email for tickets).

**Why not fixed now:** A notification system is a v1.1 feature, planned as a
unit with follow and activity feed.

---

## Feature Backlog

Items are grouped by target version. Items move to the top of the list as the
version approaches.

### v1.1 — Community foundations

| ID     | Feature                                        | Effort | Status                 |
| ------ | ---------------------------------------------- | ------ | ---------------------- |
| F-1.1  | Follow and unfollow users                      | M      | Planned                |
| F-1.2  | Notification system (in-app inbox)             | L      | Planned                |
| F-1.3  | Email digest for notifications                 | M      | Planned                |
| F-1.4  | Activity feed on user profiles                 | M      | Planned                |
| F-1.5  | Login history in security page                 | S      | Planned                |
| F-1.6  | CAPTCHA on registration (conditional)          | S      | Planned                |
| F-1.7  | CSP reporting endpoint                         | S      | Planned                |
| F-1.8  | Extract inline scripts, remove `unsafe-inline` | M      | Planned                |
| F-1.9  | Magic-byte validation for uploads              | S      | Planned                |
| F-1.10 | Wire `/tag-types/request` endpoint             | S      | Planned (see F1 above) |
| F-1.11 | Helpfulness vote deduplication                 | M      | Planned (see F3 above) |
| F-1.12 | Cleanup script for orphaned uploads            | M      | Planned (see F2 above) |

### v1.2 — Depth and scale

| ID     | Feature                                              | Effort | Status                 |
| ------ | ---------------------------------------------------- | ------ | ---------------------- |
| F-2.1  | Full-text search (MongoDB text index)                | L      | Planned                |
| F-2.2  | Live comment updates (SSE)                           | L      | Planned                |
| F-2.3  | Complete admin panel UI                              | L      | Planned                |
| F-2.4  | Audit log in the database                            | M      | Planned                |
| F-2.5  | User preferences (locale, notifications)             | M      | Planned                |
| F-2.6  | Redis-backed rate limiting and caching               | M      | Planned                |
| F-2.7  | Background job queue for email and GitHub sync       | L      | Planned                |
| F-2.8  | Antivirus scanning on uploads                        | M      | Planned                |
| F-2.9  | Soft-deleted comment recovery                        | S      | Planned (see F4 above) |
| F-2.10 | Device fingerprint verification on sensitive actions | M      | Planned                |
| F-2.11 | Coarse region binding for sessions                   | S      | Planned                |

### v2.0 — Ecosystem

| ID    | Feature                                   | Effort | Status     |
| ----- | ----------------------------------------- | ------ | ---------- |
| F-3.1 | Public REST API with token authentication | XL     | Planned    |
| F-3.2 | Two-factor authentication (TOTP)          | L      | Planned    |
| F-3.3 | GraphQL endpoint                          | XL     | Planned    |
| F-3.4 | Webhooks for project events               | M      | Planned    |
| F-3.5 | GitHub Action integration                 | M      | Planned    |
| F-3.6 | Mobile application                        | XL     | Not scoped |
| F-3.7 | Plugin system for custom content formats  | XL     | Not scoped |

### Deferred indefinitely

| Feature                         | Reason                                                                                                      |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| OAuth login (Google, GitHub)    | Adds dependencies and identity-provider trust; not aligned with the current email-verification-first model. |
| Direct messaging                | Out of scope (see `GOALS.md` Section 9.2).                                                                  |
| Paid listings                   | Out of scope (see `GOALS.md` Section 9.3).                                                                  |
| Multi-tenancy                   | The current architecture assumes a single deployment per instance.                                          |
| Real-time collaborative editing | Not applicable to the current feature set.                                                                  |

---

## Page and Route Audit

A current inventory of pages and routes, with status.

### Pages that exist and function correctly

| Path                     | Template                            | Authentication |
| ------------------------ | ----------------------------------- | -------------- |
| `/`                      | `pages/index.ejs`                   | Public         |
| `/explore`               | `pages/explore.ejs`                 | Public         |
| `/projects`              | `pages/projects/list.ejs`           | Public         |
| `/projects/:idOrSlug`    | `pages/projects/show.ejs`           | Public         |
| `/users`                 | `pages/users/list.ejs`              | Public         |
| `/users/:idOrUsername`   | `pages/users/show.ejs`              | Public         |
| `/about`                 | `pages/about.ejs`                   | Public         |
| `/contact`               | `pages/contact.ejs`                 | Public         |
| `/legal/privacy`         | `pages/legal/privacy.ejs`           | Public         |
| `/legal/terms`           | `pages/legal/terms.ejs`             | Public         |
| `/tickets/track/:token`  | `pages/tickets/track.ejs`           | Public (token) |
| `/tickets/lookup`        | `pages/tickets/lookup.ejs`          | Public         |
| `/auth/login`            | `pages/auth/login.ejs`              | Guest          |
| `/auth/register`         | `pages/auth/register.ejs`           | Guest          |
| `/auth/forgot-password`  | `pages/auth/forgot-password.ejs`    | Guest          |
| `/auth/reset-password`   | `pages/auth/reset-password.ejs`     | Guest          |
| `/auth/verify-email`     | `pages/auth/verify-email.ejs`       | Public         |
| `/dashboard`             | `pages/dashboard/home.ejs`          | Auth           |
| `/dashboard/projects`    | `pages/dashboard/projects.ejs`      | Auth           |
| `/dashboard/profile`     | `pages/dashboard/profile.ejs`       | Auth           |
| `/dashboard/security`    | `pages/dashboard/security.ejs`      | Auth           |
| `/dashboard/settings`    | `pages/dashboard/settings.ejs`      | Auth           |
| `/dashboard/my-tickets`  | `pages/dashboard/my-tickets.ejs`    | Auth           |
| `/dashboard/users`       | `pages/dashboard/users.ejs`         | Admin          |
| `/dashboard/tags`        | `pages/dashboard/tags.ejs`          | Admin          |
| `/dashboard/tag-types`   | `pages/dashboard/tag-types.ejs`     | Admin          |
| `/dashboard/tickets`     | `pages/dashboard/tickets.ejs`       | Admin          |
| `/dashboard/tickets/:id` | `pages/dashboard/ticket-detail.ejs` | Admin          |
| `/dashboard/system`      | `pages/dashboard/system.ejs`        | Developer      |
| `/dashboard/logs`        | `pages/dashboard/logs.ejs`          | Developer      |
| `/404`                   | `pages/404.ejs`                     | Error          |

### Pages that do not exist (by design or as gaps)

| Path          | Status  | Reasoning                                                                                                                        |
| ------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `/tags`       | Missing | A public tag listing would be useful. Currently, tags are only reachable through the project filter. Backlog: v1.1.              |
| `/tags/:slug` | Missing | A public tag page would duplicate `/projects?tag=<id>`. Consider whether to add a dedicated page or redirect. Backlog: v1.1.     |
| `/faq`        | Missing | Not linked from any page. Would help onboarding. Backlog: v1.2.                                                                  |
| `/changelog`  | Missing | Release notes are published as GitHub Releases. A dedicated page is redundant. Deferred indefinitely.                            |
| `/roadmap`    | Missing | The roadmap is documented in `docs/GOALS.md` and this file. A public page would be a curated view. Backlog: v1.2.                |
| `/blog`       | Missing | Out of scope (see `GOALS.md` Section 9.5).                                                                                       |
| `/search`     | Missing | Global search is available via the header (Ctrl+K), which routes to `/explore?q=<term>`. A dedicated search page is not planned. |

### Routes registered but not wired

| Route                            | Status                                                                                |
| -------------------------------- | ------------------------------------------------------------------------------------- |
| `POST /api/v1/tag-types/request` | Controller exists, route not wired. See [F1](#f1-wire-the-category-request-endpoint). |

---

## Testing Plan

The project does not yet have an automated test suite. This is a deliberate
choice for v1.0: building a comprehensive test suite before the feature set
stabilises produces tests that must be rewritten. The v1.0 release will be
verified by manual testing (see [Release Checklist](#release-checklist)), and
automated testing begins in v1.1.

### Testing roadmap

| Version | Scope                                                                                |
| ------- | ------------------------------------------------------------------------------------ |
| v1.0    | Manual verification only.                                                            |
| v1.1    | Unit tests for pure utilities. Integration tests for the auth flow.                  |
| v1.2    | Full integration coverage for all endpoints. E2E tests for critical user journeys.   |
| v2.0    | Load testing, fuzz testing for input validation, security scanning integrated in CI. |

### v1.1 test coverage targets

| Module                                  | Test type   | Target                                  |
| --------------------------------------- | ----------- | --------------------------------------- |
| `utils/token.ts`                        | Unit        | 100% branch coverage                    |
| `utils/validate.ts`                     | Unit        | 100% branch coverage                    |
| `services/fileService.ts`               | Unit        | Path traversal cases covered            |
| `services/githubService.parseGitHubUrl` | Unit        | All documented URL formats covered      |
| `services/spamDetection.checkSpam`      | Unit        | Each rule triggers as documented        |
| `controllers/authController`            | Integration | Register → verify → login → logout flow |
| `controllers/authController`            | Integration | Password reset flow                     |
| `controllers/profileController`         | Integration | Email change flow (both steps)          |

### Test infrastructure requirements

- **Jest** with `ts-jest` for TypeScript support.
- **Supertest** for HTTP integration tests.
- **mongodb-memory-server** for a temporary in-memory database.
- **Factory functions** for creating test data (users, projects, reviews).

### Manual testing checklist

Before any release, verify the following manually in a production-mode
environment:

- [ ] Register a new account; receive a verification code; verify; log in.
- [ ] Register with a duplicate username; observe the error message.
- [ ] Register with a duplicate email; observe the error message.
- [ ] Log in with a wrong password; observe the generic error message.
- [ ] Log in with a banned account; observe the `ACCOUNT_DISABLED` error.
- [ ] Create a project without email verification; observe the rejection.
- [ ] Create a project with verification; observe the project page.
- [ ] Upload an image; observe it appears in the gallery.
- [ ] Upload an oversized file; observe the rejection.
- [ ] Link a GitHub repository; observe the metadata sync.
- [ ] Submit a review; observe the aggregate rating updates.
- [ ] Submit a second review; observe the rejection.
- [ ] Review your own project; observe the rejection.
- [ ] Post a comment; reply to it; observe the threading.
- [ ] Delete a comment with replies; observe soft deletion.
- [ ] Delete a comment without replies; observe hard deletion.
- [ ] Create a tag; observe it in autocomplete.
- [ ] Request a new category (once F1 is complete).
- [ ] Approve a pending category as admin.
- [ ] Change a user's role; observe the audit fields.
- [ ] Ban a user; observe the user cannot log in.
- [ ] Request an email change; complete both steps.
- [ ] Cancel an email change; observe rollback.
- [ ] Change your password; observe other sessions are revoked.
- [ ] Submit a contact ticket; receive confirmation email.
- [ ] Reply to a ticket as staff; receive notification.
- [ ] Use ticket lookup; verify code; access tickets.
- [ ] Access `/dashboard/system` as developer; observe metrics.
- [ ] Access `/dashboard/system` as admin; observe rejection.
- [ ] Verify the sitemap at `/sitemap`.
- [ ] Verify the manifest at `/api/_meta`.

---

## Deployment Readiness

Items required before recommending the platform to users.

### Infrastructure

- [ ] Staging deployment at a public URL (blocker B4).
- [ ] HTTPS configured with a valid certificate.
- [ ] `APP_URL` set to the public domain.
- [ ] `JWT_SECRET` at least 64 characters, generated with `openssl rand -hex 32`.
- [ ] MongoDB with authentication enabled.
- [ ] SMTP provider configured and verified.
- [ ] Daily database backups with verified restore procedure.
- [ ] Log aggregation or external monitoring.
- [ ] Error alerting (for 5xx responses or process crashes).

### Documentation

- [x] `README.md` with installation and API reference.
- [x] `SECURITY.md` with disclosure policy.
- [x] `CONTRIBUTING.md` with workflow and standards.
- [x] `CODE_OF_CONDUCT.md`.
- [x] `docs/PROJECT_GUIDE.md` with feature documentation.
- [x] `docs/AI_GUIDE.md` with architecture reference.
- [x] `docs/GOALS.md` with vision and metrics.
- [x] `TODO.md` (this document).
- [ ] `CHANGELOG.md` (blocker B5).
- [ ] Deployment guide specific to the chosen infrastructure.

### Operational procedures

- [ ] Incident response runbook.
- [ ] Backup and restore procedure documented and tested.
- [ ] Upgrade procedure documented.
- [ ] Monitoring thresholds and alert routing configured.
- [ ] Log retention policy documented.

---

## Release Checklist

Before tagging v1.0.0:

- [ ] All release blockers (B1–B5) completed.
- [ ] All functional gaps (F1–F5) either completed or explicitly deferred.
- [ ] Manual testing checklist (Section "Testing Plan") completed.
- [ ] `npm audit` reports zero critical or high vulnerabilities.
- [ ] `npx tsc --noEmit` passes.
- [ ] `npm run build` succeeds.
- [ ] Docker image builds successfully.
- [ ] `.env.example` is complete and accurate.
- [ ] `CHANGELOG.md` written.
- [ ] `README.md` reviewed for accuracy.
- [ ] `SECURITY.md` reviewed for accuracy.
- [ ] `docs/PROJECT_GUIDE.md` reviewed for accuracy.
- [ ] Staging deployment verified.
- [ ] Database backup taken.
- [ ] Rollback procedure documented.
- [ ] `git tag v1.0.0` created on the release commit.
- [ ] GitHub Release published with the CHANGELOG content.

---

## Suggested Work Order

This is the recommended sequence to reach v1.0 release. Items can be
reordered if constraints change, but the sequence minimises rework.

### Week 1 — Infrastructure

- B1: Dockerfile
- B2: CI pipeline
- B3: Complete `.env.example`
- Update `docker-compose.yml` to include the application

### Week 2 — Deployment and verification

- B4: Staging deployment
- Run the manual testing checklist against staging
- Fix any issues discovered

### Week 3 — Functional gaps

- F1: Wire the category request endpoint
- F2: Orphaned uploads cleanup script
- F3: Helpfulness vote deduplication
- F4: Soft-deleted comment recovery

### Week 4 — Documentation and release

- B5: CHANGELOG and v1.0.0 tag
- Final review of all documentation
- Final smoke test
- Publish the release

---

## Decision Log

A record of decisions that shaped the project, with reasoning. Useful for
future contributors who ask "why is it this way?"

| Decision                                                               | Date | Reasoning                                                                                                                                                              |
| ---------------------------------------------------------------------- | ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Server-rendered (EJS) instead of SPA                                   | 2025 | SEO reliability, fast first paint, no build step for the frontend. Trade-off: less client-side interactivity.                                                          |
| JWT in HttpOnly cookies instead of localStorage                        | 2025 | Protects against XSS token theft. Trade-off: requires CSRF protection via `SameSite`.                                                                                  |
| Session lookup on every request                                        | 2025 | Enables immediate revocation. Trade-off: an extra database query per authenticated request.                                                                            |
| Refresh tokens are not rotated                                         | 2025 | Rotation introduces race conditions with concurrent requests. The security benefit is marginal when sessions are revocable.                                            |
| Password change preserves the current session                          | 2025 | A user who changes their password on a laptop should not be logged out of that laptop.                                                                                 |
| One review per user per project                                        | 2025 | Prevents review bombing and duplicate reviews. Trade-off: a user who changes their mind must edit their review rather than submitting a new one.                       |
| Owner cannot review own project                                        | 2025 | Prevents self-promotion through fake reviews.                                                                                                                          |
| User tags are auto-approved                                            | 2025 | Follows the GitHub model; avoids a moderation bottleneck. Trade-off: occasionally a bad tag is created; the low usage count naturally demotes it.                      |
| Categories require admin approval                                      | 2025 | Categories are structural; a bad category disrupts the taxonomy.                                                                                                       |
| Comments with replies are soft-deleted                                 | 2025 | Preserves the reply hierarchy. Trade-off: the database accumulates placeholder documents.                                                                              |
| Comments without replies are hard-deleted                              | 2025 | Prevents placeholder accumulation.                                                                                                                                     |
| In-memory caching for explore and home feed                            | 2025 | Simple and sufficient for single-process deployment. Trade-off: cache is per-process and lost on restart.                                                              |
| No formal test suite in v1.0                                           | 2025 | The feature set is still stabilising; tests written now would need rewriting. Testing begins in v1.1.                                                                  |
| `syncIndexes.ts` is manual, not automatic                              | 2025 | Automatic index sync on startup can drop indexes and cause downtime. Manual execution gives the operator control.                                                      |
| Sessions are not bound to IP                                           | 2025 | IP binding breaks mobile users and CGNAT environments. The device hash is stored for correlation but not enforced as validation.                                       |
| Refresh tokens are stored on the session, not in a separate collection | 2025 | Simpler schema. The session is the natural unit of revocation.                                                                                                         |
| `MAIL_MODE=log` in development is intentional                          | 2025 | Logging OTPs to the console removes a dependency on a mail server for development. `MAIL_MODE=smtp` must be set in production; this is documented in deployment notes. |

---

**Last updated:** 2026
**Maintainer:** [@Sobhan-SRZA](https://github.com/Sobhan-SRZA)
**License:** BSD-3-Clause