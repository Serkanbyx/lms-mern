# Security Runbook

> Companion to STEP 47 of `STEPS.md`. This document is the single source of
> truth for **operational security tasks** on the LMS — secrets rotation,
> incident response, and the production-hardening checklist that must pass
> before each release.

---

## Table of contents

1. [Threat model summary](#threat-model-summary)
2. [Production hardening checklist](#production-hardening-checklist)
3. [Secrets inventory](#secrets-inventory)
4. [Rotation procedures](#rotation-procedures)
   - [JWT access secret](#1-jwt_access_secret-quarterly--on-suspected-compromise)
   - [JWT refresh secret](#2-jwt_refresh_secret-only-when-required)
   - [Cloudinary API secret](#3-cloudinary_api_secret-quarterly--on-suspected-compromise)
   - [SMTP credentials](#4-smtp-credentials-on-provider-rotation--leak)
   - [MongoDB credentials](#5-mongodb-credentials-on-team-change--leak)
   - [Admin seed password](#6-admin_password-on-handover--leak)
5. [Incident response — suspected secret leak](#incident-response--suspected-secret-leak)
6. [Audit cadence](#audit-cadence)

---

## Threat model summary

The LMS handles three classes of sensitive data:

| Class                | Examples                                       | Primary risk            |
| -------------------- | ---------------------------------------------- | ----------------------- |
| **Auth credentials** | bcrypt password hashes, refresh-token cookies  | Account takeover        |
| **Paid content**     | Lesson videos (Cloudinary `authenticated`)     | Piracy / hot-linking    |
| **Personal data**    | Names, emails, enrollment + progress records   | GDPR / privacy exposure |

Threats explicitly accounted for in the codebase:

- Brute-force login (account lockout — STEP 46, IP+email rate limit — STEP 18).
- Mass-assignment / NoSQL injection (`pickFields` whitelists + `express-mongo-sanitize`).
- Hot-linking premium video (signed Cloudinary URLs — STEP 47).
- XSS / supply-chain (strict CSP + Dependabot — STEP 47).
- XST via `TRACE` / `TRACK` (rejected at the edge — STEP 47).
- Token theft (HttpOnly+Secure refresh cookie + 15-minute access TTL).

---

## Production hardening checklist

> Run through this list before each production deploy. Anything unchecked
> is a release blocker.

- [ ] CSP configured on both API (helmet) and client (Netlify `_headers`).
- [ ] `app.set('trust proxy', 1)` active in production (`server/index.js`).
- [ ] HTTPS redirect middleware active in production.
- [ ] HSTS `max-age` ≥ 1 year, `includeSubDomains`, `preload`.
- [ ] All lesson video responses use signed Cloudinary URLs
      (`signedVideoUrl()` in `course.controller.getCourseCurriculum` and
      `lesson.controller.projectLessonForResponse`).
- [ ] Cloudinary dashboard contains **no unsigned upload presets**.
- [ ] Lesson videos in Cloudinary live under `type=authenticated`.
- [ ] Request-id middleware mounted **before** the logger.
- [ ] Structured (JSON) logs in production with `authorization`, `cookie`,
      `set-cookie`, `password`, `currentPassword`, `newPassword`, `token`,
      and `refreshToken` redacted.
- [ ] `Permissions-Policy` denies camera, microphone, geolocation,
      interest-cohort.
- [ ] `X-Frame-Options: DENY` + `frame-ancestors 'none'` on both surfaces.
- [ ] Dependabot PRs open weekly for `/server` and `/client`.
- [ ] `npm audit --audit-level=high` clean in CI.
- [ ] All secrets in this runbook are at least 32 characters and unique.
- [ ] Refresh-token cookie carries `HttpOnly`, `Secure`, `SameSite=Strict`
      in production.
- [ ] Account lockout active (`MAX_LOGIN_ATTEMPTS`, `LOCK_DURATION_MIN`).

---

## Secrets inventory

The full set of values that MUST be stored in the Render dashboard (never in
git) and the Netlify dashboard for the SPA build:

### Server (Render)

| Variable                  | Purpose                            | Min length |
| ------------------------- | ---------------------------------- | ---------- |
| `JWT_ACCESS_SECRET`       | Sign 15-minute access tokens       | 32 chars   |
| `JWT_REFRESH_SECRET`      | Sign rotating refresh tokens       | 32 chars   |
| `MONGO_URI`               | Atlas connection string            | —          |
| `CLOUDINARY_API_SECRET`   | Sign uploads + signed video URLs   | —          |
| `SMTP_PASS`               | Transactional mail account         | —          |
| `ADMIN_PASSWORD`          | Seed password for the bootstrap admin | 12 chars |

### Client (Netlify)

| Variable             | Purpose                                |
| -------------------- | -------------------------------------- |
| `VITE_API_BASE_URL`  | Base URL of the API (must be HTTPS)    |

> The client surface contains **no secrets** — only the API base URL. Any
> value that appears in `import.meta.env` is shipped to the browser.

---

## Rotation procedures

### 1. `JWT_ACCESS_SECRET` (quarterly + on suspected compromise)

**Impact:** every existing access token becomes invalid. The SPA seamlessly
recovers via the refresh-token cookie within 15 minutes — users do **not**
need to log back in.

1. Generate a new value:
   ```sh
   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
   ```
2. In the Render dashboard, update `JWT_ACCESS_SECRET` and trigger a redeploy.
3. After the new instance is live, monitor the API logs for a brief 401 spike
   — that is expected as outstanding access tokens are rejected.
4. Confirm `/api/auth/refresh` traffic absorbs the spike within ~5 minutes.

### 2. `JWT_REFRESH_SECRET` (only when required)

**Impact:** every refresh token becomes invalid → **all users are forced to
re-login**. Schedule + announce before doing this.

1. Post a maintenance notice (e.g. status page / in-app banner).
2. Generate a new secret as above.
3. Update Render env + redeploy.
4. Users get a 401 on next refresh and are bounced to `/login`.

> Always rotate `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` at the **same**
> time when responding to a confirmed compromise — partial rotation leaves a
> usable token alive on the unrotated side.

### 3. `CLOUDINARY_API_SECRET` (quarterly + on suspected compromise)

**Impact:** every previously minted signed video URL stops working. New URLs
are minted on the next request, so users see a brief stall (≤ refresh
interval) on any video already loaded in their player.

1. In the Cloudinary dashboard, regenerate the API secret.
2. Update Render env + redeploy.
3. Verify upload + signed-URL playback against a freshly created test course.

### 4. SMTP credentials (on provider rotation / leak)

Low risk — only password-reset and verification emails depend on this.

1. Provision new SMTP user / app password.
2. Update `SMTP_USER` / `SMTP_PASS` on Render + redeploy.
3. Trigger a `POST /api/auth/forgot-password` against an internal account
   and confirm delivery.

### 5. MongoDB credentials (on team change / leak)

1. In MongoDB Atlas, create a new database user with the same role set.
2. Update `MONGO_URI` on Render + redeploy.
3. Once the new instance is healthy, **delete** the old user from Atlas.
4. Audit the Atlas access list — remove IP entries that are no longer needed.

### 6. `ADMIN_PASSWORD` (on handover / leak)

1. Generate a new strong password (≥ 12 chars).
2. Update Render env (so the seeder can be re-run if needed).
3. Sign in as the admin and change the password via `PATCH /api/auth/me/password`.
4. The env value is only consumed by `npm run seed:admin`; the live admin
   credential is stored hashed in the `User` collection from that point on.

---

## Incident response — suspected secret leak

When ANY production secret is suspected of being leaked (laptop loss, an
accidental git push, a third-party breach):

1. **Stop the bleed.** Rotate the affected secret immediately following the
   procedure above. Don't wait for a maintenance window.
2. **Invalidate sessions.** If JWT secrets are in scope, rotate **both** the
   access and refresh secrets so all sessions die at once.
3. **Audit access.** Pull request-id-correlated logs (pino JSON output) for
   the affected window and look for IPs / user agents you don't recognise
   on the `/api/auth/*` and `/api/admin/*` routes.
4. **Notify users.** If account data was at risk, email affected users and
   force a password reset for them (set `passwordChangedAt` server-side so
   the existing access tokens are rejected on next request).
5. **Post-mortem.** File an entry in this document under a "History" section
   (date, root cause, remediation, follow-ups).

---

## Audit cadence

| Cadence    | Action                                                                |
| ---------- | --------------------------------------------------------------------- |
| Weekly     | Review Dependabot PRs, merge non-major patches.                       |
| Monthly    | Run `npm audit --audit-level=high` against `/server` and `/client`.   |
| Quarterly  | Rotate `JWT_ACCESS_SECRET` and `CLOUDINARY_API_SECRET`.               |
| Quarterly  | Re-run the production hardening checklist above.                      |
| Annually   | Review HSTS preload entry + CSP — tighten `unsafe-inline` if possible.|
