# Contributing to Lumen LMS

Thanks for your interest in improving Lumen LMS! This document explains
the workflow we follow so a contribution can land cleanly without a
back-and-forth review cycle.

> Already familiar with the stack? Jump straight to the [Pull request
> checklist](#pull-request-checklist).

---

## Table of contents

1. [Code of conduct](#code-of-conduct)
2. [Project tour](#project-tour)
3. [Local development](#local-development)
4. [Branch + commit conventions](#branch--commit-conventions)
5. [Coding standards](#coding-standards)
6. [Testing](#testing)
7. [Pull request checklist](#pull-request-checklist)
8. [Reporting bugs / requesting features](#reporting-bugs--requesting-features)
9. [Security disclosures](#security-disclosures)

---

## Code of conduct

Be kind, be specific, and assume good faith. Discrimination, harassment,
or personal attacks of any kind are not tolerated. If you experience or
witness behaviour that violates this principle, contact the maintainer
privately through the channels listed in
[`SECURITY.md`](./SECURITY.md#reporting-a-vulnerability).

---

## Project tour

| Folder      | What lives here                                                |
| ----------- | -------------------------------------------------------------- |
| `client/`   | Vite + React 19 SPA (Tailwind v4, Zustand-free, hooks-only).   |
| `server/`   | Express 5 REST API (Mongoose 8, JWT, rate-limiting, Cloudinary). |
| `docs/`     | Architecture, runbook, QA, quiz integrity, security ops docs.  |
| `assets/`   | Brand assets and screenshots referenced by `README.md`.        |

A more detailed walk-through of the architecture lives in
[`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md).

---

## Local development

Prerequisites: Node ≥ 20, npm ≥ 10, a MongoDB instance (Atlas or local
Docker), optionally Redis (the rate limiter falls back to in-memory if
unset).

```bash
git clone https://github.com/<your-fork>/lumen-lms.git
cd lumen-lms

cp server/.env.example server/.env
cp client/.env.example client/.env

cd server && npm install && npm run dev
cd ../client && npm install && npm run dev
```

The full setup (seeding the demo data, configuring Cloudinary, etc.)
is documented in the [`README` Quick Start](./README.md#-getting-started).

---

## Branch + commit conventions

- Create a feature branch off `main`:
  `feat/<short-kebab-case-summary>` or `fix/<issue-id>-<summary>`.
- Use **Conventional Commits** for the subject line (≤ 72 chars,
  imperative mood, no trailing period):

  ```
  feat: add quiz timer with auto-submit on expiry
  fix: prevent enrollment counter drift on race
  refactor: extract pickFields helper from controllers
  docs: clarify Cloudinary signed URL expiry policy
  chore: bump express-rate-limit to 7.5.0
  ```

- The body (optional) explains **why** the change is needed and lists
  notable implementation details as bullets. Reference the issue with
  `Closes #123` so it auto-closes on merge.

---

## Coding standards

- **Language:** Modern ES2023+. Use `async/await`, optional chaining,
  nullish coalescing, top-level imports — no CommonJS.
- **Naming:** `camelCase` for variables and functions, `PascalCase`
  for React components and classes, `SCREAMING_SNAKE` only for true
  constants. Identifiers are **always English** so the codebase reads
  consistently to every contributor.
- **Server:** controllers must use `pickFields` (or explicit
  destructure) when copying body into a Mongoose document — never
  `...req.body`. Express 5 quirks are documented in `server/index.js`
  and at the top of each route file.
- **Client:** UI strings must come from `components/ui/` primitives.
  Don't hand-roll `<button>` / `<input>` styling — extend the
  primitive instead. All colours flow through CSS variables in
  `src/index.css`. All dates render through helpers in
  `src/utils/formatDate.js`.
- **Accessibility:** every interactive element has a label, every
  `<img>` has `alt`, every flow round-trips on the keyboard. The
  `eslint-plugin-jsx-a11y` rules block merges on regressions.
- **Performance:** route-level code splitting is the default —
  prefer `React.lazy` for new pages. Network calls go through
  `services/*.service.js`, not `axios` directly.

If a rule is missing here but baked into the codebase, follow the
existing pattern. When unsure, open a draft PR and ask.

---

## Testing

The project intentionally relies on **manual QA flows** (documented in
[`docs/QA.md`](./docs/QA.md)) plus the static analyzers. Before
opening a PR, please:

```bash
cd client && npm run lint && npm run build
cd ../server && npm run lint
```

If you add a unit test, co-locate it with the file under test
(`Foo.jsx` + `Foo.test.jsx`) and use Vitest's built-in matchers.

---

## Pull request checklist

Before requesting review:

- [ ] Branch is up to date with `main` (rebase preferred over merge).
- [ ] Conventional commit subject + meaningful body.
- [ ] No new ESLint warnings or build errors.
- [ ] Manual smoke test of the affected flow, against a local server.
- [ ] Screenshots for any visual change (light + dark mode).
- [ ] No `console.log` left behind. `console.error` only inside catch
      blocks or via the structured logger.
- [ ] No real secrets, tokens, or PII in the diff.
- [ ] `README.md` / `docs/*` updated when behaviour changes.
- [ ] If you touched a security-sensitive surface (auth, rate limit,
      uploads, role guards), call it out in the PR description.

---

## Reporting bugs / requesting features

- **Bugs:** open a GitHub issue with reproduction steps, expected vs
  actual, and the commit SHA / deployed URL where you saw the bug.
- **Features:** please open a discussion first so we can scope it
  before you spend time on the implementation.

Both flows assume the bug is *not* a security issue — see the next
section for that.

---

## Security disclosures

Do **not** open a public issue for vulnerabilities. Follow the private
disclosure process documented in [`SECURITY.md`](./SECURITY.md).

---

Thanks for contributing!
