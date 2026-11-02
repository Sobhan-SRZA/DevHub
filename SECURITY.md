# Security Policy

This document describes how to report a vulnerability in DevHub, which
versions receive security support, the security controls currently implemented
in the codebase, and the limitations that remain.

DevHub handles authentication credentials, session tokens, uploaded files, and
user-generated content. We take these responsibilities seriously and welcome
good-faith reports from security researchers, users, and contributors.

---

## Table of Contents

- [Supported Versions](#supported-versions)
- [Reporting a Vulnerability](#reporting-a-vulnerability)
- [Scope](#scope)
- [Implemented Security Controls](#implemented-security-controls)
- [Known Limitations](#known-limitations)
- [Cryptographic Details](#cryptographic-details)
- [Security Testing](#security-testing)
- [Disclosure Policy](#disclosure-policy)
- [Security Hall of Fame](#security-hall-of-fame)
- [Security Changelog](#security-changelog)
- [Standards and References](#standards-and-references)
- [Contact](#contact)

---

## Supported Versions

Security support is provided only for the latest stable release.

| Version                        | Supported | Notes                                      |
| ------------------------------ | :-------: | ------------------------------------------ |
| `main` (latest)                |     ✅     | Receives all security patches.             |
| Latest tagged release (`v1.x`) |     ✅     | Receives critical and high-severity fixes. |
| Older releases                 |     ❌     | Upgrade before reporting.                  |

If you are running a fork or a modified deployment, verify the issue against
an unmodified checkout of `main` before reporting. Bugs introduced by local
modifications fall outside the supported scope.

---

## Reporting a Vulnerability

### Do Not Report Publicly

Do not disclose a suspected vulnerability in a public GitHub issue, pull
request, discussion, or any other public channel. Public disclosure before a
patch is available exposes every deployment of the project to exploitation.

### Private Reporting Channels

| Channel                      | Address                                                                           | Notes                                                                  |
| ---------------------------- | --------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| **GitHub Security Advisory** | [Report privately](https://github.com/Sobhan-SRZA/DevHub/security/advisories/new) | Preferred. Encrypted in transit; visible only to maintainers.          |
| **Email**                    | `security@example.com`                                                            | Alternative. Use PGP if the report contains sensitive details.         |
| **PGP Key**                  | [`.well-known/security.asc`](./.well-known/security.asc)                          | Recommended for reports containing exploit code or affected user data. |

Do not send encrypted attachments to the GitHub advisory form; it does not
preserve them. Use email with the PGP key for material that must be
encrypted.

### What to Include in the Report

A well-structured report can be triaged in hours rather than days. Please
include the following.

**1. Vulnerability type**

Use standard terminology where it applies: XSS, CSRF, IDOR, SSRF, SQL/NoSQL
injection, authentication bypass, privilege escalation, path traversal,
unrestricted file upload, rate-limit bypass, information disclosure, and so
on.

**2. Location**

- The affected endpoint, if applicable (for example
  `POST /api/v1/auth/login`).
- The file and line number where the defect is reachable.
- The version, commit hash, or tag you tested against.

**3. Reproduction steps**

- A minimal proof of concept. Include exact HTTP requests and responses where
  relevant, or a short script that demonstrates the issue.
- Preconditions that must be met (authenticated session, specific role,
  specific configuration).
- Steps that must be taken before the vulnerable request.

**4. Impact**

- What an attacker can do with the vulnerability.
- What data is at risk.
- What privilege level is required to exploit it.
- Whether it is exploitable in the default configuration or only under
  specific conditions.

**5. Suggested remediation** (optional but appreciated)

If you already know how to fix the issue, describe the approach. This
accelerates the patch and reduces the risk of an incomplete fix.

**6. Contact information**

A name or handle for credit, and a preferred contact method. If you wish to
remain anonymous, say so explicitly.

### What to Expect

| Stage                                   | Commitment                     |
| --------------------------------------- | ------------------------------ |
| Acknowledgement of the report           | Within **48 hours**            |
| Initial triage and severity assessment  | Within **5 business days**     |
| Remediation plan and estimated timeline | Within **10 business days**    |
| Patch release                           | Severity-dependent (see below) |
| Public advisory                         | After the patch is available   |

**Remediation timelines:**

| Severity | Target fix window      |
| -------- | ---------------------- |
| Critical | 7 days                 |
| High     | 30 days                |
| Medium   | 90 days                |
| Low      | Next scheduled release |

These are targets, not guarantees. Complex issues may require longer
investigation. You will be informed if the timeline slips.

### Confidentiality

Reports are treated as confidential. Details will be shared only with
maintainers who need them to investigate and remediate. If the vulnerability
affects a downstream dependency, we will coordinate disclosure with the
maintainers of that dependency before any public statement.

---

## Scope

### In Scope

The following areas are within scope for security reports.

| Category                     | Examples                                                                                                                         |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| **Authentication**           | Registration, login, refresh, logout, OTP flows, password reset, email verification, email change.                               |
| **Authorization**            | Role bypass, privilege escalation, IDOR on projects, reviews, comments, tags, and tickets.                                       |
| **Session management**       | Hijacking, fixation, token leakage, revocation bypass, cookie misconfiguration.                                                  |
| **Injection**                | XSS in any user-controlled field, NoSQL injection through query or body, HTML injection in rendered content, Markdown injection. |
| **File upload**              | Path traversal, unrestricted file types, stored XSS through SVG, RCE through uploaded content, metadata leakage.                 |
| **Data exposure**            | PII leakage through APIs, password or token leakage in responses or logs, account enumeration.                                   |
| **Business logic**           | Rating manipulation, review manipulation, download counter manipulation, ticket lookup abuse, quota bypass.                      |
| **Rate limiting**            | Brute-force viability, OTP bombing, API abuse, bypass of the existing limiters.                                                  |
| **Headers and cookies**      | Missing `HttpOnly`, `Secure`, or `SameSite`, CORS misconfiguration, CSP bypass.                                                  |
| **Third-party integrations** | GitHub token leakage, SMTP credentials exposure, GeoIP SSRF.                                                                     |

### Out of Scope

The following are not considered valid security reports under this policy.

- Denial-of-service or distributed denial-of-service attacks.
- Social engineering, including phishing of maintainers or users.
- Physical attacks against infrastructure.
- Issues that require a compromised browser extension or a rooted device.
- SPF, DKIM, and DMARC configuration — these are host and email-provider
  responsibilities.
- Outdated browser support (Internet Explorer 11 and similar).
- Issues reproducible only on `localhost` with a personally modified
  configuration.
- Results from automated scanners without a verified proof of concept and an
  explanation of impact.
- Self-XSS with no realistic path to exploitation against another user.
- Missing security headers or best-practice advisories that do not
  demonstrate an exploitable weakness.
- Spam, unwanted email, or content moderation disputes — use the reporting
  channels described in `CODE_OF_CONDUCT.md`.
- Public disclosure of a vulnerability already reported and pending a patch.

### Third-Party Components

Issues in dependencies (Express, Mongoose, Zod, bcrypt, Nodemailer, and
others) should be reported to the respective upstream project. If the issue
is exploitable specifically through DevHub's usage, report it here as well,
but do not expect a patch before the upstream fix is available.

---

## Implemented Security Controls

The following controls are present in the current codebase. Each row names
the file that implements the control, so you can verify the behaviour
directly.

### Authentication

| Control                         | Implementation                                                                                  | Location                                              |
| ------------------------------- | ----------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| Password hashing                | bcrypt, 12 rounds, per-hash salt, automatic salt generation.                                    | `models/User.ts`                                      |
| Password storage                | `select: false` on the `password` field; excluded from all queries unless explicitly requested. | `models/User.ts`                                      |
| Password policy (registration)  | Minimum 6 characters, at least one letter and one digit.                                        | `validators/authValidator.ts`                         |
| Password policy (reset)         | Minimum 8 characters, one lowercase, one uppercase, one digit.                                  | `validators/authValidator.ts`                         |
| Password policy (change)        | Same as reset, plus a check that the new password differs from the current one.                 | `validators/profileValidator.ts`                      |
| Password comparison             | `bcrypt.compare` via the `comparePassword` instance method.                                     | `models/User.ts`                                      |
| Login identifier                | Email or username, both lowercased before lookup.                                               | `controllers/authController.ts`                       |
| Banned user check               | Rejected with `ACCOUNT_DISABLED` on login and on every authenticated request.                   | `controllers/authController.ts`, `middleware/auth.ts` |
| Registration email verification | Mandatory; the account is created but no session is issued until the code is verified.          | `controllers/authController.ts`                       |
| Session issuance                | Server-issued session ID; the client receives only signed tokens referencing that session.      | `services/sessionService.ts`                          |

### OTP and Verification Codes

| Control         | Implementation                                                    | Location                          |
| --------------- | ----------------------------------------------------------------- | --------------------------------- |
| Code generation | `crypto.randomInt(0, 1_000_000)`, zero-padded to six digits.      | `models/VerificationCode.ts`      |
| Code storage    | SHA-256 of `code + salt`; the plaintext code is never persisted.  | `models/VerificationCode.ts`      |
| Salt            | 16 random bytes per record.                                       | `models/VerificationCode.ts`      |
| Attempt limit   | 5 attempts per code, after which the record is deleted.           | `services/verificationService.ts` |
| Resend cooldown | 60 seconds between requests for the same purpose.                 | `services/verificationService.ts` |
| Default TTL     | 10 minutes for verification codes; 15 minutes for password reset. | `services/verificationService.ts` |
| Single use      | Deleted on successful verification.                               | `services/verificationService.ts` |
| Expiry cleanup  | TTL index on `expiresAt`.                                         | `models/VerificationCode.ts`      |

### Sessions and Tokens

| Control                               | Implementation                                                                                            | Location                                  |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| JWT signing                           | HS256 with a server-side secret.                                                                          | `utils/token.ts`                          |
| Access token lifetime                 | Configured via `JWT_EXPIRES_IN`; defaults to 7 days.                                                      | `utils/token.ts`, `config/env.ts`         |
| Refresh token lifetime                | Fixed at 30 days.                                                                                         | `utils/token.ts`                          |
| Token typing                          | `typ` claim distinguishes `access`, `refresh`, `email_verify`, and `password_reset`.                      | `utils/token.ts`                          |
| Token verification                    | Signature, expiration, and `typ` are all checked.                                                         | `utils/token.ts`, `middleware/auth.ts`    |
| Session lookup                        | Every authenticated request re-validates the session against the database, allowing immediate revocation. | `middleware/auth.ts`                      |
| Refresh binding                       | A refresh token is only accepted when the session ID **and** the refresh token match a stored record.     | `controllers/authController.ts`           |
| Session rotation                      | A new access token is issued on refresh; the session ID remains stable.                                   | `controllers/authController.ts`           |
| Session revocation on password change | All other sessions are deleted; the current session is preserved.                                         | `controllers/profileController.ts`        |
| Session revocation on password reset  | All sessions are deleted.                                                                                 | `controllers/authController.ts`           |
| Session revocation on logout          | The current session record is deleted, not merely invalidated.                                            | `controllers/authController.ts`           |
| Logout from all devices               | All sessions for the user are deleted.                                                                    | `controllers/authController.ts`           |
| Expired session cleanup               | TTL index on `expiresAt`; the primary query additionally filters by expiry.                               | `models/Session.ts`, `middleware/auth.ts` |

### Cookies

Cookies are set centrally in `controllers/authController.ts`:

```typescript
const cookieOpts = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
};
```

| Attribute             | Rationale                                                                      |
| --------------------- | ------------------------------------------------------------------------------ |
| `httpOnly`            | Prevents JavaScript from reading the token, limiting the impact of an XSS.     |
| `secure` (production) | Prevents transmission over plain HTTP.                                         |
| `sameSite: "lax"`     | Blocks the cookie from being sent on cross-site sub-requests, mitigating CSRF. |
| `path: "/"`           | Limits the cookie to the application origin.                                   |

### Input Validation

| Layer            | Tool                                                     | Location                  |
| ---------------- | -------------------------------------------------------- | ------------------------- |
| Request body     | Zod schemas, one per endpoint.                           | `validators/*.ts`         |
| Query parameters | Zod with `coerce` for numeric fields.                    | `validators/*QuerySchema` |
| Path parameters  | Regular expressions for ObjectIds, slugs, and usernames. | Controllers               |
| Uploaded files   | MIME allowlist, size limit, count limit.                 | `config/upload.ts`        |

**Enforced format rules:**

| Field    | Pattern                                                                    |
| -------- | -------------------------------------------------------------------------- |
| Username | `[a-zA-Z0-9_.-]{3,20}`                                                     |
| Email    | RFC-compatible regex, lowercased, maximum 254 characters                   |
| Password | Minimum 6 characters with at least one letter and one digit (registration) |
| ObjectId | `/^[a-f\d]{24}$/i`                                                         |
| Slug     | `/^[a-z0-9-]{2,80}$/`                                                      |
| Colour   | `/^#[0-9a-fA-F]{6}$/`                                                      |

### Error Handling

Errors flow through a single middleware in `middleware/errorHandler.ts`.

| Error type                                   | Handling                                                                                                     |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `AppError`                                   | Serialized with `code`, `message`, and optional `field` or `details`.                                        |
| `ZodError`                                   | Converted to `VALIDATION_ERROR` with per-field messages.                                                     |
| MongoDB duplicate key (11000)                | Translated to `USERNAME_TAKEN` or `EMAIL_TAKEN` where the field is identifiable.                             |
| Mongoose `ValidationError`                   | Converted to `VALIDATION_ERROR` with per-field messages.                                                     |
| Mongoose `CastError`                         | Converted to `VALIDATION_ERROR` with the offending field.                                                    |
| `JsonWebTokenError`                          | Converted to `INVALID_TOKEN`.                                                                                |
| `TokenExpiredError`                          | Converted to `SESSION_EXPIRED`.                                                                              |
| Network errors (`ECONNREFUSED`, `ETIMEDOUT`) | Converted to `NETWORK_ERROR` with status 503.                                                                |
| Unhandled errors                             | Logged server-side; the client receives a generic message in production and the full message in development. |

Response headers are checked before any error response is written; if the
response has already started, the error is passed to Express's default handler
to avoid corrupting the response.

### XSS Prevention

| Control                | Implementation                                                                                                                 | Location                                           |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------- |
| Server-rendered output | EJS auto-escapes `<%= %>`; `<%- %>` is used only for content that has already been sanitized.                                  | `frontend/views/`                                  |
| Client-side rendering  | `escapeHtml()` is applied before any `innerHTML` interpolation.                                                                | `frontend/public/js/`                              |
| Markdown sanitization  | A whitelist-based sanitizer walks the parsed DOM.                                                                              | `frontend/public/js/components/markdown-editor.js` |
| Allowed tags           | A fixed set of structural and formatting tags.                                                                                 | Same file                                          |
| Forbidden tags         | `script`, `style`, `iframe`, `object`, `embed`, `form`, `meta`, `link`, `base`, `svg`, `math` are removed with their contents. | Same file                                          |
| Attribute filtering    | Event handler attributes (`on*`), `style`, and any attribute not on the per-tag allowlist are removed.                         | Same file                                          |
| URL scheme filtering   | `javascript:`, `vbscript:`, and `data:` (except `data:image/`) are rejected in `href`, `src`, and `xlink:href`.                | Same file                                          |
| External links         | `target="_blank"` and `rel="noopener noreferrer nofollow"` are added.                                                          | Same file                                          |
| Images                 | `loading="lazy"` is added.                                                                                                     | Same file                                          |
| Uploaded HTML and SVG  | Served with `Content-Type: application/octet-stream` and `Content-Disposition: attachment` to prevent execution.               | `backend/src/app.ts`                               |

### Content Security Policy

A CSP is set by `middleware/security.ts` on every response.

```
default-src 'self';
script-src 'self' 'unsafe-inline';
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
font-src 'self' https://fonts.gstatic.com data:;
img-src 'self' data: blob: https:;
media-src 'self' blob:;
connect-src 'self';
frame-ancestors 'none';
base-uri 'self';
form-action 'self';
object-src 'none';
upgrade-insecure-requests  (production only)
```

The `'unsafe-inline'` directive in `script-src` and `style-src` weakens the
policy. It is present because several pages use inline scripts and inline
styles. Removing it is a planned improvement (see
[Known Limitations](#known-limitations)).

### HTTP Security Headers

| Header                              | Value                                                          | Location                                     |
| ----------------------------------- | -------------------------------------------------------------- | -------------------------------------------- |
| `Content-Security-Policy`           | See above                                                      | `middleware/security.ts`                     |
| `Strict-Transport-Security`         | `max-age=15552000; includeSubDomains` (production only)        | Same file                                    |
| `X-Frame-Options`                   | `DENY`                                                         | Same file, and on `/uploads` in `app.ts`     |
| `X-Content-Type-Options`            | `nosniff`                                                      | Same file, and on `/public` and `/uploads`   |
| `Referrer-Policy`                   | `strict-origin-when-cross-origin`                              | Same file                                    |
| `Permissions-Policy`                | `camera=(), microphone=(), geolocation=(), payment=(), usb=()` | Same file                                    |
| `X-DNS-Prefetch-Control`            | `off`                                                          | Same file                                    |
| `X-Download-Options`                | `noopen`                                                       | Same file                                    |
| `X-Permitted-Cross-Domain-Policies` | `none`                                                         | Same file                                    |
| `X-Powered-By`                      | Removed                                                        | Same file, and `app.disable("x-powered-by")` |

### File Upload

| Control                    | Implementation                                                                                                      | Location                  |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| Storage location           | `backend/uploads/`, outside the public web root.                                                                    | `config/upload.ts`        |
| Directory separation       | Per-category, per-project subdirectories.                                                                           | Same file                 |
| Filename generation        | `Date.now()` + 12 random bytes, hex-encoded, plus the original extension.                                           | Same file                 |
| MIME allowlist             | Images: `jpeg`, `png`, `webp`, `gif`. Video: `mp4`, `webm`, `quicktime`. Archives: `zip`, `rar`, `7z`, `tar`, `gz`. | Same file                 |
| Size limits                | Images 5 MB, video 200 MB, archive 500 MB, avatar 5 MB.                                                             | Same file                 |
| Count limits               | 10 images, 1 video, 1 archive per project.                                                                          | Same file                 |
| Path traversal on deletion | `toAbsolutePath` resolves the path, checks `path.relative` against the upload root, and rejects paths that escape.  | `services/fileService.ts` |
| Response hardening         | `nosniff` on all uploads; HTML and SVG forced to download; archives forced to download.                             | `backend/src/app.ts`      |

### Request-Level Protections

| Control                                | Implementation                                                                                              | Location                 |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------ |
| Body size limit                        | 2 MB for JSON and URL-encoded bodies.                                                                       | `backend/src/app.ts`     |
| Path traversal at the middleware layer | Requests containing `\0`, `%00`, or `../` are rejected before routing.                                      | `middleware/security.ts` |
| Trust proxy                            | Enabled when `TRUST_PROXY=1` or `NODE_ENV=production`, so that the client IP is read from the proxy header. | `backend/src/app.ts`     |
| Response compression                   | `compression` package if available, otherwise a native `zlib` fallback.                                     | `middleware/security.ts` |

### Rate Limiting

Rate limiting exists at three layers.

**Global limiters** in `middleware/security.ts`:

| Limiter            | Window     | Limit      | Applied to                                                                |
| ------------------ | ---------- | ---------- | ------------------------------------------------------------------------- |
| `apiLimiter`       | 15 minutes | 400 per IP | All of `/api`                                                             |
| `authLimiter`      | 15 minutes | 30 per IP  | `/register`, `/login`, `/refresh`                                         |
| `sensitiveLimiter` | 1 hour     | 10 per IP  | Email verification, password reset, contact submission, ticket operations |

**Per-endpoint limiters** in `middleware/apiRateLimit.ts`, applied through
`apiGuard()`:

| Visibility      | Window     | Limit | Key                         |
| --------------- | ---------- | ----- | --------------------------- |
| `public`        | 60 seconds | 60    | IP                          |
| `authenticated` | 60 seconds | 120   | User ID, falling back to IP |
| `admin`         | 60 seconds | 240   | User ID                     |
| `developer`     | 60 seconds | 240   | User ID                     |

Individual endpoints override these values where appropriate. Examples:

| Endpoint                    | Override      |
| --------------------------- | ------------- |
| Project creation            | 10 per hour   |
| Project uploads (all types) | 30 per hour   |
| Username change             | 3 per hour    |
| Avatar upload               | 3 per hour    |
| Email change requests       | 5 per hour    |
| Password change requests    | 5 per hour    |
| Review submission           | 10 per hour   |
| Comment creation            | 15 per minute |

**Email delivery limiter** in `services/mail/rateLimiter.ts`:

| Scope                 | Window     | Limit      |
| --------------------- | ---------- | ---------- |
| Per recipient address | 60 seconds | 5 messages |

**Contact form limiters** in `controllers/contactController.ts`:

| Scope             | Window                   |
| ----------------- | ------------------------ |
| Per email address | One ticket per 2 minutes |
| Per IP address    | One ticket per 5 minutes |

### Authorization

Authorization is enforced through a combination of middleware and explicit
checks in controllers.

| Layer                   | Middleware                                                      | Location                  |
| ----------------------- | --------------------------------------------------------------- | ------------------------- |
| Authentication required | `requireAuth`                                                   | `middleware/auth.ts`      |
| Authentication optional | `optionalAuth`                                                  | Same file                 |
| Page authentication     | `pageAuth` (redirects to login)                                 | `middleware/pageAuth.ts`  |
| Role requirement        | `requireAdmin`, `requireDeveloper`                              | `middleware/roles.ts`     |
| Page role requirement   | `pageAdminGuard`, `pageDeveloperGuard`                          | Same file                 |
| Resource ownership      | `requireProjectOwnership`, `requireTagOwnership`, `loadProject` | `middleware/ownership.ts` |

**Authorization rules enforced in controllers:**

- Only the project owner may edit or delete a project, upload media, or trigger a sync.
- Only the review author may edit or delete a review.
- Only the comment author may edit or delete a comment.
- A user may not review their own project.
- A user may not ban their own account.
- A user may not change their own role.
- An administrator may not modify developer-level roles.
- Only developers may assign the `developer` role.
- A tag may not be deleted while any project references it.

### Anti-Enumeration

| Flow                | Behaviour                                                                                                                                                          |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Login               | A single message is returned for nonexistent accounts and for incorrect passwords.                                                                                 |
| Password recovery   | A uniform response is returned whether or not the email exists; a signed token is still issued for nonexistent accounts to preserve the response shape and timing. |
| Resend verification | A uniform response is returned; delivery failures are logged but not surfaced.                                                                                     |
| Ticket lookup       | A uniform response is returned whether or not any tickets exist for the address.                                                                                   |

Registration is intentionally excluded from uniform responses because the
username and email uniqueness checks are necessary for a usable form. Dedicated
codes (`USERNAME_TAKEN`, `EMAIL_TAKEN`) are returned for that reason.

### Database

| Control            | Implementation                                                                                           | Location                                                                                          |
| ------------------ | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| NoSQL injection    | Mongoose schema casting plus Zod validation. Raw user strings are never passed to query operators.       | Controllers, validators                                                                           |
| Regex construction | User input used in `$regex` is escaped with the standard metacharacter pattern.                          | `controllers/adminController.ts`, `controllers/userController.ts`, `controllers/tagController.ts` |
| Unique indexes     | `email`, `usernameLower`, `slug`, `sessionId`.                                                           | Models                                                                                            |
| TTL indexes        | `Session.expiresAt`, `VerificationCode.expiresAt`.                                                       | Models                                                                                            |
| Sensitive fields   | `password`, `pendingPassword`, `refreshToken`, `trackingTokenHash`, `lookupOtpHash` are `select: false`. | Models                                                                                            |
| Connection string  | Read from `MONGODB_URI`; never embedded in source.                                                       | `config/env.ts`                                                                                   |

### GitHub Integration

| Control               | Implementation                                                                     | Location                    |
| --------------------- | ---------------------------------------------------------------------------------- | --------------------------- |
| Rate-limit awareness  | Remaining quota and reset time are read from response headers on every call.       | `services/githubService.ts` |
| Proactive throttling  | Requests pause when the remaining quota falls below a safety margin (50).          | Same file                   |
| Maximum wait          | The client will not block for more than 30 seconds waiting for a reset.            | Same file                   |
| Concurrency cap       | A counting semaphore limits simultaneous requests to 3.                            | Same file                   |
| Request deduplication | Concurrent callers requesting the same repository share one in-flight request.     | Same file                   |
| Conditional requests  | ETag-based `If-None-Match`; `304` responses do not consume quota.                  | Same file                   |
| Retry policy          | Up to 3 retries with exponential backoff for transient failures and 5xx responses. | Same file                   |
| Timeout               | 8 seconds per request.                                                             | Same file                   |
| Token handling        | `GITHUB_TOKEN` is read from the environment; never logged.                         | Same file                   |

### Email

| Control                | Implementation                                                                                                             | Location                                             |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| TLS version            | Minimum TLS 1.2.                                                                                                           | `services/mail/transports/smtpTransport.ts`          |
| Certificate validation | Enabled by default; disabled only when `SMTP_ALLOW_INSECURE=true` is explicitly set (which triggers a warning at startup). | `services/mail/config.ts`                            |
| Timeouts               | Connection, greeting, and socket timeouts are configured.                                                                  | `services/mail/transports/smtpTransport.ts`          |
| Connection pooling     | Up to 3 connections, 100 messages per connection.                                                                          | Same file                                            |
| Transport selection    | `MAIL_MODE=log` writes to the console; `MAIL_MODE=smtp` delivers through SMTP.                                             | `services/mail/config.ts`                            |
| HTML escaping          | All user-supplied values are escaped before interpolation in templates.                                                    | `services/mail/utils.ts`, `services/mail/templates/` |
| Rate limiting          | Per-recipient sliding window (5 per minute).                                                                               | `services/mail/rateLimiter.ts`                       |
| Address validation     | Simplified regex validation before delivery.                                                                               | `services/mail/utils.ts`                             |

### Ticket Tracking

| Control          | Implementation                                                                    | Location                    |
| ---------------- | --------------------------------------------------------------------------------- | --------------------------- |
| Token generation | 32 random bytes, hex-encoded.                                                     | `services/ticketService.ts` |
| Token storage    | SHA-256 hash only; the raw token is never persisted.                              | Same file                   |
| Token lifetime   | 30 days.                                                                          | Same file                   |
| Revocation       | Explicit `trackingRevoked` flag.                                                  | Same file                   |
| Lookup OTP       | SHA-256 of `email + ":" + code`; expires after 15 minutes; limited to 5 attempts. | Same file                   |

### Logging Hygiene

The logger in `services/logger.ts` intercepts `console` output and writes to
daily files. The following are never logged:

- Passwords, in plaintext or hashed form.
- Access tokens, refresh tokens, or any portion of a JWT.
- The `Authorization` header or `Cookie` header.
- OTP codes, except in `MAIL_MODE=log` during development.
- Full request bodies.

In production, unhandled errors are logged with the message and stack
internally, while the client receives a generic message.

### Environment Validation

`config/environment.ts` enforces the following at startup:

- `APP_URL` must be set and must not contain `localhost` in production.
- `JWT_SECRET` must be at least 64 characters in production.
- A warning is emitted when `APP_ENV=production` but `NODE_ENV` is not
  `production`, or when `API_STRICT=false` is set in production.
- `config/env.ts` exits the process if `MONGODB_URI`, `JWT_SECRET`, or `PORT`
  are missing.

### Spam Detection

`services/spamDetection.ts` applies the following checks to user-submitted
content:

- Repeated character runs.
- Repeated word frequency, with table-row exclusion to reduce false positives.
- Excessive URL count.
- Known URL shorteners.
- Excessive uppercase ratio.
- Suspicious promotional phrases (English and Persian).
- HTML and JavaScript injection patterns.
- Invisible-character obfuscation.
- Normalized duplicate-content detection per user and field.

Content scoring 50 or above is rejected; content scoring between 30 and 49 is
returned with warnings.

---

## Known Limitations

The following limitations are known and accepted. They are listed here so
that security researchers can distinguish between gaps awaiting a fix and
behaviour that is out of scope by design.

### High Priority

| Limitation                            | Risk                                                      | Status                                                                     |
| ------------------------------------- | --------------------------------------------------------- | -------------------------------------------------------------------------- |
| `'unsafe-inline'` in CSP `script-src` | Reduces the CSP's effectiveness against injected scripts. | Planned: move inline scripts to external files, then remove the directive. |
| No magic-byte validation on uploads   | A file with a spoofed MIME type may pass the allowlist.   | Planned.                                                                   |
| No antivirus scanning on uploads      | Malicious files may be stored and redistributed.          | Requires a ClamAV or equivalent integration.                               |

### Medium Priority

| Limitation                                           | Risk                                                                                      | Status                                                                                                                                                |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| No IP or User-Agent binding for sessions             | A stolen token may be usable from another device until the session expires or is revoked. | The device hash is used for deduplication, not validation. IP binding is intentionally avoided because it breaks mobile users and CGNAT environments. |
| No 2FA (TOTP)                                        | Accounts are protected by a single factor.                                                | Placeholder UI only.                                                                                                                                  |
| No login history                                     | Users cannot review past sign-ins.                                                        | Placeholder UI only.                                                                                                                                  |
| No API tokens                                        | Programmatic access is limited to session-based authentication.                           | Placeholder UI only.                                                                                                                                  |
| No IP allowlist for administrative routes            | Admin and developer routes are protected by role only.                                    | Planned.                                                                                                                                              |
| No database-backed audit log                         | Administrative actions are logged to the console, not to a queryable collection.          | Planned.                                                                                                                                              |
| No email change notification to the previous address | Users are not alerted when their email changes.                                           | Marked as a TODO in `controllers/profileController.ts`.                                                                                               |
| Rate limiters are in-process only                    | Horizontal scaling requires sticky sessions or a shared store.                            | A Redis-backed store is planned.                                                                                                                      |

### Low Priority

| Limitation                 | Risk                                                                             | Status                                                                                            |
| -------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| No CAPTCHA on registration | Automated account creation is possible within rate limits.                       | Will be added if spam becomes a real problem.                                                     |
| No CSP reporting endpoint  | CSP violations are not collected.                                                | Planned alongside CSP tightening.                                                                 |
| No HSTS preload            | `Strict-Transport-Security` is set but not submitted to the preload list.        | Requires a stable domain.                                                                         |
| No CORS middleware         | The application relies on same-origin behaviour; there is no explicit allowlist. | Intentional for the current deployment model, but a gap if the API is ever consumed cross-origin. |

### Out of Scope

The following are outside the project's control and are not addressed by
security patches:

- Security of the hosting environment and operating system.
- Configuration of the MongoDB instance (authentication, network exposure,
  backups).
- Configuration of the SMTP provider.
- Security of any CDN or WAF placed in front of the application.
- SSL/TLS certificate management.
- Security of email deliverability mechanisms (SPF, DKIM, DMARC).

---

## Cryptographic Details

### Algorithms

| Purpose                      | Algorithm                | Parameters                                                                                                                |
| ---------------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| Password hashing             | bcrypt                   | Rounds: 12. Salt generated per hash.                                                                                      |
| OTP hashing                  | SHA-256                  | Per-record 16-byte salt; digest is stored, plaintext is not.                                                              |
| JWT signing                  | HS256                    | Secret is `JWT_SECRET`, at least 64 characters in production.                                                             |
| Session identifier           | `crypto.randomBytes(16)` | Hex-encoded (32 characters).                                                                                              |
| Tracking token               | `crypto.randomBytes(32)` | Hex-encoded (64 characters).                                                                                              |
| Upload filename              | `crypto.randomBytes(12)` | Hex-encoded (24 characters), prefixed with a millisecond timestamp.                                                       |
| Device fingerprint           | SHA-256                  | Input: `userAgent + "                                                                                                     | " + (fingerprint or deviceId or "")`. |
| OTP generation               | `crypto.randomInt`       | Range 0 to 999,999; zero-padded to six digits.                                                                            |
| Ticket lookup OTP            | `crypto` random bytes    | Range 100,000 to 999,999.                                                                                                 |
| Client fingerprint (browser) | FNV-1a                   | Derived from user agent, locale, screen, timezone, hardware concurrency, and platform. Used only as a session-reuse hint. |

### Secret Management

| Rule                                                       | Enforcement                                                   |
| ---------------------------------------------------------- | ------------------------------------------------------------- |
| Secrets live in `.env`, never in source.                   | `.env` is gitignored.                                         |
| `.env.example` contains placeholders only.                 | Committed and reviewed.                                       |
| `JWT_SECRET` must be at least 64 characters in production. | Enforced at startup in `config/environment.ts`.               |
| Secrets are never logged.                                  | Enforced by review; the logger strips common patterns.        |
| Secrets are never returned in API responses.               | `publicUser` and related serializers select only safe fields. |

### Secret Rotation

**`JWT_SECRET` cannot be rotated without invalidating every active session.**
If the secret is changed, every user is logged out on the next request because
their tokens no longer verify. Planned support for key rotation (signing with
a new key while accepting the previous key for a grace period) is not
implemented.

**SMTP credentials and the GitHub token may be rotated without disrupting
users**, provided the application is restarted so that the new values are
loaded.

---

## Security Testing

### Manual Review Checklist

Use the following checklist when reviewing a deployment or a change.

#### Authentication

- [ ] Five failed login attempts are rate-limited.
- [ ] Registration with a duplicate email returns `EMAIL_TAKEN`.
- [ ] Accessing a protected route without a token returns `401`.
- [ ] Accessing an admin route with a user role returns `403`.
- [ ] An expired refresh token forces a redirect to login.
- [ ] Logout invalidates the refresh token on the server.
- [ ] Password change revokes every other session.
- [ ] Password reset revokes every session.

#### Authorization

- [ ] User B cannot edit User A's project.
- [ ] User B cannot delete User A's comment.
- [ ] A regular user cannot approve a tag.
- [ ] A regular user cannot approve a category.
- [ ] A user cannot ban their own account.
- [ ] A user cannot change their own role.
- [ ] An administrator cannot promote someone to developer.
- [ ] A tag in use by a project cannot be deleted.

#### XSS

- [ ] `<script>alert(1)</script>` in a biography is escaped.
- [ ] `<img src=x onerror=alert(1)>` in a comment is escaped.
- [ ] `[link](javascript:alert(1))` in a Markdown description is stripped.
- [ ] An SVG upload containing `<script>` is forced to download.
- [ ] A username containing `<script>` is rejected by the validator.

#### File Upload

- [ ] An executable renamed to `.jpg` with a spoofed MIME type is rejected at
      the MIME check (magic-byte validation is not yet implemented).
- [ ] A 100 MB video is rejected by the size limit.
- [ ] A filename containing `../../etc/passwd` is stored under the sanitized
      name.
- [ ] A ZIP file is served with `Content-Disposition: attachment`.

#### Session

- [ ] A token from another device is accepted only while the session exists
      and has not expired.
- [ ] Revoking a session from the security page removes it immediately.
- [ ] Concurrent sessions from two devices are both listed.

#### Rate Limiting

- [ ] Six OTP requests within five minutes trigger the cooldown.
- [ ] Ten incorrect OTP attempts delete the code.
- [ ] Exceeding the per-endpoint quota returns `429`.

### Recommended Tools

| Tool                     | Purpose                                      |
| ------------------------ | -------------------------------------------- |
| **OWASP ZAP**            | Dynamic scanning of the running application. |
| **Burp Suite Community** | Manual request inspection and fuzzing.       |
| **Semgrep**              | Static analysis for common patterns.         |
| **npm audit**            | Dependency vulnerability scanning.           |
| **Snyk**                 | Continuous dependency scanning in CI.        |
| **Trivy**                | Container image scanning, if containerised.  |

### Running Basic Checks

```bash
# Dependency vulnerabilities
npm audit

# Type check
npx tsc --noEmit

# Static analysis
semgrep --config=auto backend/src/
```

---

## Disclosure Policy

### Timeline

1. **Report received.** Acknowledged within 48 hours.
2. **Triage.** Severity and scope determined within 5 business days.
3. **Fix development.** Target windows by severity:
   - Critical: 7 days
   - High: 30 days
   - Medium: 90 days
   - Low: next scheduled release
4. **Patch release.** A new version is published with a note in the release
   notes.
5. **Public disclosure.** A GitHub Security Advisory is published after the
   patch is available.

### If You Wish to Disclose Before a Fix

We request that you wait at least **90 days** from the date of the report. If
a fix has not been released within that window, you are free to disclose, with
attribution to the maintainers for their good-faith effort to address the
issue. We will not pursue legal action against researchers who follow this
policy.

### Credit

If you wish, you will be credited in the advisory and in this document under
[Security Hall of Fame](#security-hall-of-fame). Credit is given for the
vulnerability type and the date, without exposing personal information unless
you explicitly request it.

---

## Security Hall of Fame

The following individuals have responsibly disclosed vulnerabilities that
have been addressed.

<!--
Format:
- [@username](https://github.com/username) — Vulnerability type — Month Year
-->

_No entries yet._

---

## Security Changelog

| Date | Version | Item                              |
| ---- | ------- | --------------------------------- |
| —    | —       | Project under active development. |

---

## Standards and References

### Standards Followed

- **OWASP Top 10 (2021)** — mitigations applied where applicable.
- **OWASP ASVS** — authentication and session management sections.
- **CWE Top 25** — patterns avoided throughout the codebase.
- **RFC 7519** — JSON Web Tokens.
- **RFC 8725** — JWT Best Current Practices.
- **RFC 6749** — OAuth 2.0 (patterns adopted; full flow not implemented).
- **BSD 3-Clause License** — governing licence.

### References

- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [OWASP Session Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)
- [OWASP File Upload Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html)
- [OWASP Cross-Site Scripting Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html)
- [JWT Best Practices RFC 8725](https://datatracker.ietf.org/doc/html/rfc8725)
- [OWASP Top 10 (2021)](https://owasp.org/Top10/)

---

## Contact

| Role                 | Contact                                                  |
| -------------------- | -------------------------------------------------------- |
| **Maintainer**       | [@Sobhan-SRZA](https://github.com/Sobhan-SRZA)           |
| **Security reports** | `security@example.com`                                   |
| **Conduct reports**  | `conduct@example.com`                                    |
| **PGP key**          | [`.well-known/security.asc`](./.well-known/security.asc) |

For non-security matters, use the [contact form](/contact) or open a public
issue.

---

## Related Documents

- [`CONTRIBUTING.md`](./CONTRIBUTING.md) — Development workflow and coding standards.
- [`CODE_OF_CONDUCT.md`](./CODE_OF_CONDUCT.md) — Community expectations.
- [`README.md`](./README.md) — Project overview and API reference.
- [`LICENSE`](./LICENSE) — BSD 3-Clause.
- [`docs/AI_GUIDE.md`](./docs/AI_GUIDE.md) — Architectural guide.
- [`docs/PROJECT_GUIDE.md`](./docs/PROJECT_GUIDE.md) — Feature-level documentation.

---

<div align="center">

**Thank you for helping keep DevHub and its users safe.**

_Last reviewed: 2026_

</div>