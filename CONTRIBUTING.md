# Contributing to DevHub

Thank you for your interest in contributing to DevHub. This document
describes the development workflow, coding standards, and review process
that keep the project consistent and maintainable.

DevHub is a production-grade application. Contributions are expected to
meet the same standards as the existing codebase: strict TypeScript, server-side
validation, structured error handling, and defensible security decisions.

- [Code of Conduct](#code-of-conduct)
- [Ways to Contribute](#ways-to-contribute)
- [Development Environment](#development-environment)
- [Project Layout](#project-layout)
- [Coding Standards](#coding-standards)
- [Adding a Feature](#adding-a-feature)
- [Testing](#testing)
- [Commit Conventions](#commit-conventions)
- [Pull Request Process](#pull-request-process)
- [Security Disclosures](#security-disclosures)
- [Questions](#questions)

---

## Code of Conduct

All participants are expected to follow the project's
[Code of Conduct](./CODE_OF_CONDUCT.md). In short: be respectful, assume good
faith, and focus critique on code and ideas rather than on individuals.

Harassment, discrimination, and personal attacks are not tolerated. Reports
may be sent privately to the maintainer.

---

## Ways to Contribute

Contributions are welcome in several forms:

| Type                  | Examples                                                                                                              |
| --------------------- | --------------------------------------------------------------------------------------------------------------------- |
| **Bug reports**       | Reproducible defects with a clear description of expected versus actual behaviour.                                    |
| **Feature proposals** | Well-scoped improvements to existing features. Larger features should be discussed in an issue before implementation. |
| **Documentation**     | Corrections, clarifications, or new guides in `README.md` and `docs/`.                                                |
| **Code**              | Bug fixes, new endpoints, UI improvements, refactors that reduce complexity.                                          |
| **Testing**           | Additional unit or integration tests (the project does not yet have a formal test suite — see [Testing](#testing)).   |

Before starting work on anything non-trivial, open an issue describing the
proposed change. This avoids duplicated effort and lets maintainers confirm the
direction before you invest time.

---

## Development Environment

### Requirements

- **Node.js** version 20 or later
- **npm** or **pnpm**
- **MongoDB** version 7 or later — either a local instance, MongoDB Atlas, or
  the bundled Docker Compose configuration
- **Git**

### Setup

```bash
# 1. Fork the repository on GitHub, then clone your fork
git clone https://github.com/<your-username>/DevHub.git
cd DevHub

# 2. Add the upstream remote
git remote add upstream https://github.com/Sobhan-SRZA/DevHub.git

# 3. Install dependencies
npm install

# 4. Copy the environment template
cp example.env .env

# 5. Edit .env and set at minimum:
#    MONGODB_URI
#    JWT_SECRET
```

Generate a strong secret for local development:

```bash
openssl rand -hex 32
```

### Start the database

If you do not already have MongoDB running:

```bash
docker compose up -d
```

This starts MongoDB on `localhost:27017` and Mongo Express on
`http://localhost:8081`.

### Run the application

```bash
npm run dev
```

The development server watches `backend/`, `frontend/views/`, and `.env`, and
restarts automatically on change. TypeScript files are executed directly
through `tsx`; no build step is required during development.

### Verify the installation

```bash
curl http://localhost:3000/api/v1/health
# → { "status": "ok" }
```

Open `http://localhost:3000` and complete the registration flow. In
`MAIL_MODE=log`, verification codes are written to the console.

---

## Project Layout

DevHub is split into two top-level directories:

```
backend/src/          → application code (TypeScript)
frontend/public/      → client-side JavaScript, CSS, and assets
frontend/views/       → EJS templates
docs/                 → documentation
```

### Backend

| Directory      | Purpose                                                                                               |
| -------------- | ----------------------------------------------------------------------------------------------------- |
| `api/`         | Declarative route entry points. Each file re-exports a router. The loader mounts these automatically. |
| `pages/`       | HTML route entry points, mounted the same way as `api/`.                                              |
| `routes/`      | Concrete router implementations referenced by `api/` and `pages/`.                                    |
| `controllers/` | Request handlers. Every exported handler is wrapped in `asyncHandler`.                                |
| `services/`    | Business logic with no access to `req` or `res`.                                                      |
| `models/`      | Mongoose schemas, indexes, and instance methods.                                                      |
| `middleware/`  | Cross-cutting concerns: authentication, authorization, ownership, uploads, errors, locals.            |
| `validators/`  | Zod schemas for every request payload.                                                                |
| `utils/`       | Helpers with no dependency on Express: `AppError`, `errorCodes`, token utilities, `asyncHandler`.     |
| `config/`      | Environment loading, database connection, upload configuration, API registry.                         |
| `scripts/`     | CLI utilities executed with `tsx`.                                                                    |
| `types/`       | Shared TypeScript types.                                                                              |

### Frontend

| Directory               | Purpose                                                                                |
| ----------------------- | -------------------------------------------------------------------------------------- |
| `public/js/components/` | Reusable client modules (`MarkdownEditor`, `TagPicker`, `userChip`).                   |
| `public/js/pages/`      | Page-specific behaviour for public routes.                                             |
| `public/js/dashboard/`  | Page-specific behaviour for dashboard routes.                                          |
| `public/js/auth/`       | Authentication flows.                                                                  |
| `public/styles/`        | Modular CSS. Global tokens and shared primitives live in `index.css` and `themes.css`. |
| `views/components/`     | EJS partials: header, footer, dialogs, navigation, SEO head.                           |
| `views/pages/`          | Full page templates.                                                                   |

---

## Coding Standards

The project applies strict rules uniformly. Contributions that deviate from
these will be asked to change before merge.

### TypeScript

- The project runs with `"strict": true`. Do not disable strict checks.
- Avoid `any`. Use `unknown` with a type guard, or define a narrow interface.
  Existing code uses `any` only where Express's type system requires it
  (`req: any` in controllers is common, but the payload passed to services is
  always validated).
- Prefer explicit return types on exported functions.
- Do not use `@ts-ignore`. If a suppression is genuinely necessary, use
  `@ts-expect-error` with a comment explaining why.

### Validation

- **Every** request payload must be validated with a Zod schema from
  `validators/` before reaching business logic.
- Validation happens in the controller via `validate(schema, req.body)`.
- A new endpoint without a corresponding validator is not acceptable.

### Error Handling

- Never `throw new Error()`. Use `AppError` or one of its factories
  (`BadRequest`, `Unauthorized`, `Forbidden`, `NotFound`, `Conflict`,
  `TooManyRequests`).
- Never return raw database errors to the client. Let `errorHandler` translate
  them.
- Every controller must be wrapped in `asyncHandler`. Do not write try/catch
  inside controllers except where the response format genuinely differs.

### Response Format

All JSON responses share one of two shapes:

```json
{ "ok": true, "message": "...", "data": { ... } }
{ "ok": false, "code": "ERROR_CODE", "message": "..." }
```

Do not introduce new top-level shapes.

### Frontend JavaScript

- The client layer is plain JavaScript (no build step, no framework). Match
  the existing ES5-compatible style so that the modules work across the
  supported browsers without transpilation.
- Modules are IIFEs that attach to `window`. Do not use ES modules.
- All user-supplied strings must pass through `escapeHtml()` before being
  interpolated into `innerHTML`.
- Fetch calls must include `credentials: 'include'`.
- Errors should be surfaced via `FormKit`, `openDialogError`, `confirmDialog`,
  or `toast` — never via `alert` except as a fallback.

### CSS

- Use the CSS custom properties defined in `styles/index.css` and
  `styles/themes.css` (`--bg`, `--text`, `--accent`, `--border`, `--radius`,
  `--shadow`, ...). Do not hardcode colours that should come from the theme.
- Page-specific CSS belongs in the matching subdirectory
  (`styles/dashboard/`, `styles/projects/`, `styles/users/`).
- Respect `prefers-reduced-motion` and `prefers-color-scheme`.

### EJS Templates

- Escape user data with `<%= %>`, not `<%- %>`. The only exception is
  intentionally rendered HTML that has already passed through the Markdown
  sanitiser.
- Reuse existing partials (`header`, `footer`, `dialogError`,
  `dashboard-nav`, `dash-breadcrumb`) rather than duplicating markup.
- Every public page must include `seo-head` with a title, description, and
  canonical path.
- Private pages must include `noindex: true`.

---

## Adding a Feature

Feature work follows a consistent ten-step pattern. The sequence is not
arbitrary: each layer depends on the one before it, and skipping a step
typically leads to inconsistent code.

### 1. Model

**Location:** `backend/src/models/Xyz.ts`

Define the schema, indexes, and any instance methods. Index design matters:
identify the queries your feature will run and add compound indexes
accordingly. Use TTL indexes for anything that expires.

```typescript
import { Schema, model, Model, Types } from "mongoose";

export interface IXyz {
  owner: Types.ObjectId;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

const xyzSchema = new Schema<IXyz, Model<IXyz>>(
  {
    owner: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
  },
  { timestamps: true }
);

xyzSchema.index({ owner: 1, createdAt: -1 });

export const Xyz = model<IXyz>("Xyz", xyzSchema);
```

### 2. Validator

**Location:** `backend/src/validators/xyzValidator.ts`

Write one schema for creation, one for update, and one for the list query.
All three are Zod schemas. Query schemas typically use `z.coerce` for
numeric fields.

```typescript
import { z } from "zod";

export const createXyzSchema = z.object({
  name: z.string().trim().min(2).max(120),
});

export const updateXyzSchema = createXyzSchema.partial();

export const xyzListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
```

### 3. Error Codes

**Location:** `backend/src/utils/errorCodes.ts`

Add new codes and their English messages. Use `SCREAMING_SNAKE_CASE`.

```typescript
export const ErrorCodes = {
  // ...
  XYZ_NOT_FOUND: "XYZ_NOT_FOUND",
  XYZ_TAKEN: "XYZ_TAKEN",
} as const;

export const ErrorMessages: Record<ErrorCode, string> = {
  // ...
  XYZ_NOT_FOUND: "The requested item could not be found.",
  XYZ_TAKEN: "An item with this name already exists.",
};
```

### 4. Service (if applicable)

**Location:** `backend/src/services/xyzService.ts`

If the feature contains logic that will be reused across controllers, or that
is complex enough to warrant independent testing, extract it into a service.
Services must not import `express`.

### 5. Controller

**Location:** `backend/src/controllers/xyzController.ts`

Every handler:

- Is wrapped in `asyncHandler`.
- Validates the payload with the corresponding Zod schema.
- Checks authorization explicitly if the router middleware does not already
  cover it.
- Returns `{ ok: true, ... }` on success.

```typescript
import { asyncHandler } from "../utils/asyncHandler";
import { validate } from "../utils/validate";
import { Unauthorized } from "../utils/AppError";
import { ErrorCodes } from "../utils/errorCodes";
import { createXyzSchema } from "../validators/xyzValidator";
import { Xyz } from "../models/Xyz";

export const createXyz = asyncHandler(async (req: any, res) => {
  if (!req.user) throw Unauthorized(ErrorCodes.UNAUTHENTICATED);

  const data = validate(createXyzSchema, req.body);
  const record = await Xyz.create({ owner: req.user._id, ...data });

  res.status(201).json({ ok: true, record });
});
```

### 6. Route

**Location:** `backend/src/api/xyz/router.ts`

```typescript
import { Router } from "express";
import { requireAuth } from "../../../middleware/auth";
import { apiGuard } from "../../../middleware/apiGuard";
import { apiRateLimit } from "../../../middleware/apiRateLimit";
import * as ctrl from "../../../controllers/xyzController";

const router = Router();

router.post(
  "/",
  requireAuth,
  apiRateLimit("authenticated", { windowMs: 60_000, max: 10 }),
  apiGuard({
    path: "/api/v1/xyz",
    method: "POST",
    visibility: "authenticated",
    description: "Create a new record.",
    tags: ["xyz"],
  }),
  ctrl.createXyz
);

export default router;
```

The loader mounts this router at `/api/xyz`, and because the file is inside
`api/v1/`, the full path is `/api/v1/xyz`. Register the new endpoint in the
API reference table in `README.md`.

### 7. Page Route (if the feature has a page)

**Location:** `backend/src/pages/xyz/page.ts`

For dashboard pages, apply `pageAuth` and, if required,
`pageAdminGuard` or `pageDeveloperGuard`.

### 8. EJS Template

**Location:** `frontend/views/pages/xyz/show.ejs`

Include the standard partials:

```ejs
<%- include("../../components/seo-head", { title: "..." }) %>
<%- include("../../components/header") %>
<%- include("../../components/dialogError") %>

<main> <!-- content --> </main>

<%- include("../../components/footer") %>
```

### 9. CSS

**Location:** `frontend/public/styles/xyz/show.css`

Use design tokens. If the page needs a new colour role, propose it in
`index.css` rather than hardcoding the value.

### 10. Client JavaScript

**Location:** `frontend/public/js/xyz/show.js`

Follow the existing pattern: query the API, render into the DOM, bind event
handlers, and surface errors through `FormKit` or `toast`.

### Checklist

Before submitting a feature:

- [ ] Model defined with appropriate indexes
- [ ] Zod schema for every request payload
- [ ] Error codes added with English messages
- [ ] Controller wrapped in `asyncHandler` and returns the standard shape
- [ ] Route declared through `apiGuard()` with visibility, description, and tags
- [ ] Page route protected with the correct guard
- [ ] EJS template includes `seo-head`, `header`, and `footer`
- [ ] Private pages use `noindex: true`
- [ ] CSS uses design tokens
- [ ] Client code escapes user-supplied strings
- [ ] `README.md` API reference updated
- [ ] `npx tsc --noEmit` passes

---

## Testing

The project does not yet ship a formal test suite. Contributions that add
tests are strongly encouraged and will be prioritised during review.

### Recommended Tooling

| Purpose               | Tool                                                 |
| --------------------- | ---------------------------------------------------- |
| Unit tests            | **Jest** with `ts-jest`                              |
| Integration tests     | **Supertest** against an in-process Express instance |
| End-to-end (optional) | **Playwright**                                       |

Install the recommended packages:

```bash
npm install --save-dev jest @types/jest ts-jest supertest @types/supertest
```

### High-Value Targets

If you are adding tests, the following areas have the highest value:

- `parseGitHubUrl` — URL parsing edge cases
- `parseMarkdown` — sanitisation, XSS vectors
- `escapeHtml` — encoding correctness
- `recalculateProjectStats` — aggregation correctness
- `computeHotScore` — ranking behaviour across windows
- Auth flow end-to-end: register → verify → login → logout
- Password reset flow
- Email change flow (both steps)

### Manual Testing

Until automated tests exist, every contribution must include manual
verification. At minimum:

- Test on desktop at 1440 px and 1024 px.
- Test on mobile at 390 px.
- Verify the change in both light and dark themes.
- Verify the change in a clean session (logged out) and in a logged-in session.
- Check the browser console for errors.

---

## Commit Conventions

Commits follow the [Conventional Commits](https://www.conventionalcommits.org/)
specification.

```
<type>(<scope>): <subject>
```

**Types:**

| Type       | Purpose                                          |
| ---------- | ------------------------------------------------ |
| `feat`     | A new feature                                    |
| `fix`      | A bug fix                                        |
| `refactor` | Code change with no behavioural effect           |
| `perf`     | Performance improvement                          |
| `docs`     | Documentation only                               |
| `style`    | Formatting, whitespace, or CSS (no logic change) |
| `test`     | Adding or correcting tests                       |
| `build`    | Build system or dependency changes               |
| `ci`       | Continuous integration changes                   |
| `chore`    | Maintenance tasks                                |

**Scope** is optional but recommended. Use the affected area: `auth`,
`projects`, `reviews`, `comments`, `tags`, `dashboard`, `api`, `security`,
`docs`, `deps`.

**Subject** is written in the imperative mood, lowercase, no trailing period,
and no more than 72 characters.

**Examples:**

```
feat(projects): add bulk archive action
fix(auth): reject expired refresh tokens on session lookup
refactor(dashboard): extract breadcrumb into a shared partial
docs(readme): document the tiered rate limiter
perf(explore): cache hot score aggregation for five minutes
```

**Body and footer:**

- The body is separated from the subject by a blank line. Use it to explain
  *what* and *why*, not *how*.
- Reference issues with `Refs: #123` or `Closes: #123`.

### Commit Hygiene

- Each commit should be a single, coherent change.
- Do not commit commented-out code, `console.log` statements, or `.env` files.
- Do not commit build artefacts (`dist/`, `node_modules/`).
- Do not commit secrets.

---

## Pull Request Process

### Before Opening a PR

1. **Sync with upstream.**

   ```bash
   git fetch upstream
   git rebase upstream/main
   ```

2. **Type-check.**

   ```bash
   npx tsc --noEmit
   ```

3. **Build.**

   ```bash
   npm run build
   ```

4. **Test manually** against the checklist in [Testing](#testing).

### Opening the PR

The pull request description should include:

- **Summary** — one or two sentences describing the change.
- **Motivation** — the problem being solved.
- **Approach** — how the change addresses the problem, at the level of
  components and files rather than line-by-line.
- **Screenshots** — required for any UI change. Provide both light and dark
  themes, and both desktop and mobile widths.
- **Breaking changes** — call these out explicitly. If the change alters any
  existing API contract, the README must be updated in the same PR.
- **Related issues** — reference with `Closes #123`.

### Review

- Every PR requires at least one approval from a maintainer.
- Reviewers may request changes to match existing conventions. These are not
  optional.
- The CI workflow (when it exists) must pass. Until then, the maintainer will
  verify the build and type check locally.
- Discussion takes place on the PR. Keep it focused on the change.

### Merge

- The project uses **squash-merge**. The PR title becomes the commit subject;
  ensure it follows the [Commit Conventions](#commit-conventions).
- Do not merge your own PR unless explicitly authorized.
- After merge, delete the branch.

### What Slows a Review

The most common reasons a PR is not merged quickly:

- Missing validation on a new endpoint.
- A new endpoint that is not declared through `apiGuard()`.
- Untranslated strings or inconsistent terminology.
- A UI change without screenshots.
- Unhandled errors — the promise rejection path is not covered.
- Commit messages that do not follow the convention.
- A large, unrelated refactor bundled with a feature.

Split unrelated changes into separate PRs. Reviewers evaluate each PR
independently.

---

## Security Disclosures

**Do not report security vulnerabilities through public issues or pull
requests.**

Report security issues following the process described in
[`SECURITY.md`](./SECURITY.md). The maintainer commits to acknowledging a
report within 48 hours and providing an initial assessment within five
business days.

If your contribution touches authentication, session handling, file uploads,
or input validation, mention this explicitly in the PR description so the
review can be prioritised.

---

## Questions

If something in this guide is unclear, or if you are unsure whether a proposed
change fits the project's direction:

1. **Open an issue** with the `question` label. Describe what you are trying
   to accomplish.
2. **Check the existing documentation** in `README.md`, `docs/PROJECT_GUIDE.md`,
   and `docs/AI_GUIDE.md`. Between them, they cover most of the architecture
   and conventions.
3. **Ask in the pull request** if you have started work and encounter an
   ambiguity.

Direct contact with the maintainer is available through the channels listed
in [`SECURITY.md`](./SECURITY.md) for security matters, or through the
repository's GitHub discussions for everything else.

---

<div align="center">

**Thank you for contributing to DevHub.**

Every well-scoped issue, clear bug report, and careful pull request makes the
project better for everyone who uses it.

</div>