# Architecture

> Companion to STEP 49 of `STEPS.md`. High-level map of how the LMS is
> assembled and the architectural decisions behind it.

---

## High-level diagram

```
                  ┌──────────────────────────┐
                  │     Browser (SPA)        │
                  │  React 19 + Vite + TW4   │
                  │  react-router v7         │
                  │  react-helmet-async      │
                  │  i18next (en-only v1)    │
                  └───────────┬──────────────┘
                              │  HTTPS · JSON · cookies
                              ▼
                  ┌──────────────────────────┐
                  │  Render edge (TLS + LB)  │
                  └───────────┬──────────────┘
                              │
                              ▼
        ┌─────────────────────────────────────────────┐
        │             Express 5 API                   │
        │  middleware: helmet · CORS · compression    │
        │              · cookie-parser · sanitize     │
        │              · rate-limit (Redis store)     │
        │              · pino-http                    │
        │  routes:    /auth /courses /lessons         │
        │             /quizzes /enrollments /admin    │
        │             /upload /users                  │
        └─────────┬─────────────┬───────────────┬─────┘
                  │             │               │
                  ▼             ▼               ▼
            ┌──────────┐  ┌──────────┐    ┌──────────┐
            │ MongoDB  │  │  Redis   │    │Cloudinary│
            │ Atlas    │  │ (rate-   │    │  (video  │
            │          │  │  limit + │    │ + image) │
            │          │  │  cache)  │    │          │
            └──────────┘  └──────────┘    └──────────┘
                  ▲
                  │
        ┌─────────┴────────────┐
        │   Render Cron Jobs   │
        │  cleanupStaleDrafts  │
        │  cleanupExpiredTokens│
        │  certificateReminder │
        └──────────────────────┘
```

---

## Component responsibilities

### `client/`
- **React 19 SPA** — owns every UI state machine. No SSR; SEO crawl
  payloads come from `react-helmet-async`'s document-side rendering at
  request time inside the SPA.
- **State**: per-page local state + React Context for cross-cutting
  concerns (auth, preferences, motion). No Redux / Zustand — the data
  model is small enough that React's primitives win on simplicity.
- **Routing**: react-router v7 with React.lazy code splitting on every
  page so the initial JS payload stays small.
- **Styling**: Tailwind v4 with a single CSS variable theme. Dark mode
  flips via `.dark` class on `<html>`.
- **i18n**: scaffold-only in v1 (`react-i18next` + `en.json`). All
  user-facing strings funnel through `t()` so adding a locale is a
  translation file, not a refactor.

### `server/`
- **Express 5** — the only backend. No microservices.
- **Database**: MongoDB via Mongoose 9. Models are the single point of
  trust for validation; controllers stay thin.
- **Auth**: short-lived JWT access tokens + rotating refresh tokens in
  an HttpOnly cookie. `tokenVersion` lets us invalidate every session
  on password change / logout-all.
- **Background work**: Render Cron Jobs running standalone scripts in
  `server/scripts/`. No long-running worker process.

### `Redis` (optional)
- Backs the rate limiter so multiple API replicas share one bucket per
  IP / user. Falls back to in-memory when `REDIS_URL` is unset.

### `Cloudinary`
- Stores course images and lesson videos. Video URLs are signed and
  short-lived; HLS adaptive streaming is feature-flagged.

---

## Decision log (ADRs)

> Append-only. Newest entries on top. The point is to capture *why*,
> not *what* — `git blame` already records the *what*.

### 2026-04-21 — STEP 49: i18n scaffold instead of full localisation
**Status**: accepted.
**Context**: We ship in English-only for v1 but every translation
attempt I've seen retrofit later required a full component sweep.
**Decision**: Wire `react-i18next` now, route every user-facing string
through `t()`. Translation files come later; the wiring stays.
**Consequences**: +14 KB gzip on the client bundle today, near-zero
work to add a locale tomorrow.

### 2026-04-21 — STEP 49: env-driven feature flags, no third-party service
**Status**: accepted.
**Context**: We need kill switches and dark-launch capability without
a six-figure LaunchDarkly bill on day one.
**Decision**: Two parallel modules (`server/config/features.js` and
`client/src/config/features.js`) reading env vars. Server is the
security gate; client is cosmetic.
**Consequences**: Restart required to flip a flag. When/if we outgrow
this, swap the implementation without touching callsites.

### 2026-04-21 — STEP 49: tab-switch counter is a signal, not a gate
**Status**: accepted.
**Context**: We can't realistically prevent cheating without proctoring.
**Decision**: Surface `tabSwitches` on `QuizAttempt` for instructor
review; never auto-fail on it.
**Consequences**: Honest users with notification interruptions don't
get punished; cheaters know they're being watched.

### 2026-04-19 — STEP 47: signed Cloudinary URLs for paid lesson video
**Status**: accepted.
**Context**: Hot-linking and torrent uploads of premium video are the
top piracy vector for content platforms.
**Decision**: Lesson videos use Cloudinary `authenticated` delivery
type with short-lived signatures.
**Consequences**: Slightly higher per-request latency (signature
generation), full control over share-link expiry.

### 2026-04-19 — STEP 47: HttpOnly cookie for refresh token, not header
**Status**: accepted.
**Context**: A localStorage-stored refresh token is owned by any XSS
that lands.
**Decision**: Refresh token in `Secure; HttpOnly; SameSite=Lax` cookie.
Access token in memory only.
**Consequences**: CSRF protection requires SameSite + a double-submit
pattern for state-changing endpoints (already in place).

---

## Build & deploy

| Surface     | Build            | Host           |
| ----------- | ---------------- | -------------- |
| Client SPA  | `vite build`     | Render Static  |
| API         | `node index.js`  | Render Web     |
| Cron jobs   | `node scripts/*` | Render Cron    |
| Database    | n/a              | MongoDB Atlas  |
| Cache       | n/a              | Render Redis   |
| Media       | n/a              | Cloudinary     |

CI: GitHub Actions runs ESLint + (planned) Vitest on every push. A
green run is required before Render will redeploy.

---

## Where to read next

- `docs/SECURITY.md` — secrets rotation, threat model.
- `docs/QA.md` — browser support, mobile QA matrix.
- `docs/QUIZ-INTEGRITY.md` — anti-cheat policy boundaries.
- `docs/RUNBOOK.md` — operational tasks (rotate, restore, drain).
