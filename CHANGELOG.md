# Changelog

All notable changes to **Lumen LMS** are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
and the project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

> Dates use ISO 8601 (`YYYY-MM-DD`). Sections in `[Unreleased]` move
> into a versioned heading on each release tag.

---

## [Unreleased]

Pre-deploy cleanup pass — see `STEP 51` of `STEPS.md` for the full
checklist that drove this changeset.

### Changed

- Server lifecycle code (`db.js`, `redis.js`, `email.js`) now logs
  through the shared `pino` logger instead of `console.log`, so every
  startup/shutdown event ships in the same JSON envelope as request
  logs and can be filtered in the production aggregator.
- `formatDate.js` exposes a new `formatMonthYear` helper for join-date
  / milestone copy. `PublicProfilePage` now consumes it instead of a
  hand-rolled `Date.toLocaleDateString` call so locale formatting
  stays in one place.

### Removed

- Empty placeholder `server/routes/quizAttempt.routes.js` (the routes
  it was reserved for already live in `quiz.student.routes.js`).

### Documentation

- Added a public-facing `SECURITY.md` at the repository root pointing
  at the operational runbook in `docs/SECURITY.md`.
- Added `CONTRIBUTING.md` covering the local setup, commit style,
  and PR checklist contributors are expected to follow.
- Added this `CHANGELOG.md` so future releases can ship structured
  release notes instead of free-form commit messages.

---

## [0.1.0] — 2026-04-21

Initial public release of Lumen LMS.

### Added

- **Authentication & accounts** — JWT access + rotating refresh
  cookies, email verification, forgot/reset password flow, account
  lockout, per-session `tokenVersion` invalidation on password change.
- **Catalog** — public course list with filters, slug-based detail
  page, gated curriculum preview, instructor public profile.
- **Learning surface** — enrollment, lesson player with Cloudinary
  signed URLs, progress tracking, mark-as-complete, certificate
  issuance at 100% completion.
- **Quizzes** — server-side scoring with `toStudentView()` so the
  answer key never leaves the API pre-submit, attempt history,
  rate-limited submissions.
- **Authoring** — instructor course editor, sections + lessons CRUD,
  draft → pending → published lifecycle, archive flow.
- **Admin** — dashboard stats, user directory with role/active toggles,
  course moderation queue (approve/reject/archive/delete).
- **Operational hardening** — Helmet CSP, CORS allowlist, structured
  `pino-http` logging, request-id propagation, graceful shutdown,
  Redis-backed rate limiting (with in-memory fallback), `compression`,
  trust-proxy aware client IP detection.
- **Frontend polish** — design-system primitives in `components/ui/`,
  CSS-variable theming with full dark-mode parity, reduced-motion
  awareness, accessible navigation, route-level code splitting, PWA
  manifest + offline gate.
- **Docs** — `README` with quick start, environment matrix, deployment
  guide; `docs/ARCHITECTURE.md`, `docs/RUNBOOK.md`, `docs/QA.md`,
  `docs/QUIZ-INTEGRITY.md`, `docs/SECURITY.md`.

[Unreleased]: https://github.com/your-org/lumen-lms/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/your-org/lumen-lms/releases/tag/v0.1.0
