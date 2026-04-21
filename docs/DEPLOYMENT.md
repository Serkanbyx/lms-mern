# Deployment Guide

> End-to-end walkthrough for shipping Lumen LMS to production:
> **MongoDB Atlas** (database) +
> **Render** (Express API, optional Redis, optional cron jobs) +
> **Netlify** (React SPA) + **Cloudinary** (media).
>
> Everything in this document is performed by **you** through web
> dashboards or GitHub Desktop. The build agent never executes any
> `git`, `gh`, Render, Netlify, or Atlas command on your behalf — it
> only documents the procedure here so you can follow it at deploy
> time.

---

## Table of contents

1. [Pre-flight checklist](#pre-flight-checklist)
2. [Push the repository to GitHub](#push-the-repository-to-github)
3. [MongoDB Atlas](#mongodb-atlas)
4. [Cloudinary](#cloudinary)
5. [SMTP provider](#smtp-provider)
6. [Backend on Render](#backend-on-render)
7. [Optional — Render Redis](#optional--render-redis)
8. [Optional — Render Cron Jobs](#optional--render-cron-jobs)
9. [Frontend on Netlify](#frontend-on-netlify)
10. [Final wiring (CORS + CSP)](#final-wiring-cors--csp)
11. [Post-deploy verification — functional](#post-deploy-verification--functional)
12. [Post-deploy verification — security](#post-deploy-verification--security)
13. [Troubleshooting](#troubleshooting)

---

## Pre-flight checklist

Before opening any cloud dashboard, confirm these are true locally.

- [ ] `npm run dev` boots cleanly inside `server/` (Mongo connects, no
      schema warnings, `/api/health` returns `200`).
- [ ] `npm run dev` boots cleanly inside `client/` and the SPA can
      hit the local API (login, course list, lesson playback).
- [ ] `cd client && npm run build` finishes without errors and emits
      `client/dist/`.
- [ ] No `.env`, `.env.local`, or `.env.production` is tracked by git
      (only `*.env.example`). The `.gitignore` at the repository root
      already enforces this — verify with GitHub Desktop's "Changes"
      pane.
- [ ] `client/public/_redirects` exists and contains
      `/*    /index.html   200` (SPA fallback for Netlify).
- [ ] `client/public/_headers` exists. The `Content-Security-Policy`
      line still contains the placeholder string
      `https://your-api.onrender.com` — you'll replace it with the
      real Render URL at the end of [Final wiring](#final-wiring-cors--csp).

---

## Push the repository to GitHub

Done **manually** through GitHub Desktop. The agent does not run any
git command.

1. Open **GitHub Desktop** → `File` → `Add local repository…` and
    select the project folder.
2. `File` → `Publish repository…`. Pick **private** for now (you can
    flip to public later); leave "Keep this code private" unchecked
    only if the repo is portfolio-ready.
3. Confirm the latest commit (the green check on the left rail) is
    the one you want deployed.
4. Click **Push origin** to sync.

Render and Netlify will read the repository over OAuth in the next
sections — neither needs a deploy key or a token.

---

## MongoDB Atlas

1. <https://cloud.mongodb.com> → create a project (e.g. `lumen-lms`).
2. **Build a Cluster** → free **M0** tier → pick a region near your
    Render region (typically the closest US/EU one).
3. **Database Access** → add a database user. Use a password with
    at least 20 characters mixing upper / lower / digits / symbols.
    Save it in a password manager — Atlas will not show it again.
4. **Network Access** → add the Render egress IPs for your region
    (Render → docs → "Outbound IPs") **and** your current dev IP.
    Do **NOT** add `0.0.0.0/0` for production — leaving the cluster
    open to the internet is the most common Atlas mis-config.
5. **Connect** → **Drivers** → copy the `mongodb+srv://…` string. It
    will look like:

    ```text
    mongodb+srv://<user>:<password>@<cluster>.mongodb.net/lumen?retryWrites=true&w=majority
    ```

    URL-encode the password if it contains special characters (`@`,
    `/`, `:`, `?`, `#`). Append the database name (`/lumen`) before
    the query string. This value goes into Render as `MONGO_URI`.

---

## Cloudinary

1. <https://cloudinary.com> → free tier is sufficient for the demo.
2. Dashboard → copy **Cloud name**, **API Key**, **API Secret**.
3. Settings → **Upload** → enable "Auto-tag" (optional) and confirm
    "Resource type" defaults to `auto` (so video and image uploads
    both work through the same signed-upload route).
4. Settings → **Security** → enable "Restricted media types: PHP,
    JavaScript, EXE" to harden against renamed-binary uploads in
    addition to the server-side MIME filter.

---

## SMTP provider

Pick one of: **Resend**, **SendGrid**, **Postmark**, **Mailgun**, or
your own Postfix. Whatever you choose, you'll need:

- `SMTP_HOST` (e.g. `smtp.resend.com`)
- `SMTP_PORT` (`587` for STARTTLS, `465` for implicit TLS)
- `SMTP_SECURE` (`true` only if port `465`)
- `SMTP_USER`, `SMTP_PASS`
- `MAIL_FROM` — must be on a verified domain or the provider will
   silently reject every send.

Send yourself a test message from the provider's dashboard before
going further. Email delivery problems caught in production cost
days; caught here, they cost minutes.

---

## Backend on Render

> **Fast path — Blueprint.** A `server/render.yaml` ships with the
> backend. Dashboard → **Blueprints** → **New Blueprint Instance**
> → select the repo, then point the blueprint config path at
> `server/render.yaml`. Render reads the file and provisions the API + Redis +
> all three cron jobs in one shot. You only need to fill in the
> values marked `sync: false` (DB URI, Cloudinary, SMTP, admin,
> CORS / `CLIENT_URL`) on the dashboard after the first apply —
> the JWT secrets are auto-generated. If you take the Blueprint
> path, skip the manual UI flow that follows and jump straight to
> the health check and the `seed:admin` invocation. The manual UI
> flow that follows is here for the case where you want to wire
> things by hand.

1. <https://dashboard.render.com> → **New +** → **Web Service**.
2. Connect your GitHub account if you haven't already → pick the
    repository you pushed earlier.
3. Configure:

    | Field | Value |
    | --- | --- |
    | Name | `lumen-lms-api` (anything you like) |
    | Region | same region as your Atlas cluster |
    | Branch | `main` |
    | Root directory | `server` |
    | Runtime | `Node` |
    | Build command | `npm install` |
    | Start command | `npm start` |
    | Instance type | `Free` to verify, then upgrade to `Starter` for production (free tier sleeps after 15 min idle) |

4. **Environment** tab → add the variables below. The two JWT
    secrets must each be at least 32 characters and **must differ**
    from each other (validated at boot by `server/config/env.js`).
    Generate them locally with:

    ```bash
    node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
    ```

    | Key | Value |
    | --- | --- |
    | `NODE_ENV` | `production` |
    | `PORT` | `10000` |
    | `MONGO_URI` | the Atlas connection string from above |
    | `JWT_ACCESS_SECRET` | 64+ char random hex (run the command above) |
    | `JWT_REFRESH_SECRET` | a **different** 64+ char random hex |
    | `JWT_ACCESS_EXPIRES_IN` | `15m` |
    | `JWT_REFRESH_EXPIRES_IN` | `30d` |
    | `CLIENT_URL` | will be set after Netlify is live (placeholder for now) |
    | `CORS_ORIGINS` | leave empty for now; revisit in [Final wiring](#final-wiring-cors--csp) |
    | `CLOUDINARY_CLOUD_NAME` | from Cloudinary |
    | `CLOUDINARY_API_KEY` | from Cloudinary |
    | `CLOUDINARY_API_SECRET` | from Cloudinary |
    | `SMTP_HOST` / `SMTP_PORT` / `SMTP_SECURE` / `SMTP_USER` / `SMTP_PASS` | from your SMTP provider |
    | `MAIL_FROM` | `Lumen LMS <noreply@your-domain.com>` |
    | `ADMIN_EMAIL` | the email you want for the seeded admin |
    | `ADMIN_PASSWORD` | min 12 characters; will hash on first seed |
    | `ADMIN_NAME` | display name (e.g. `Platform Admin`) |
    | `BCRYPT_ROUNDS` | `12` |
    | `MAX_LOGIN_ATTEMPTS` | `10` |
    | `LOCK_DURATION_MIN` | `15` |
    | `EMAIL_VERIFICATION_TTL_MIN` | `1440` |
    | `PASSWORD_RESET_TTL_MIN` | `15` |
    | `REFRESH_COOKIE_NAME` | `lms.refresh` |
    | `LOG_LEVEL` | `info` |
    | `FEATURE_CERTIFICATES` | `true` |
    | `FEATURE_HLS` | `false` |
    | `FEATURE_BETA_QUIZ_TIMER` | `false` |

5. **Create Web Service**. Render builds and deploys.
6. When the build is green, hit `https://<your-service>.onrender.com/api/health`.
    A `200` JSON payload with `status: "ok"` confirms the API is up.
7. Open Render → service → **Shell** and run the admin seed once:

    ```bash
    npm run seed:admin
    ```

    The script is idempotent — re-running it promotes / re-activates
    the user without rotating the password.

> **Copy the live API URL** (e.g. `https://lumen-lms-api.onrender.com`)
> — you'll need it three more times: Netlify env var, Netlify
> `_headers` CSP, and the API service's own `CLIENT_URL`.

---

## Optional — Render Redis

Recommended for production. Without it the in-memory rate limiter
silently multiplies the per-IP cap by the replica count.

1. Render dashboard → **New +** → **Redis**.
2. Pick the smallest paid tier (free Redis is not offered).
3. Copy the **Internal Redis URL** (`redis://red-xxxxx:6379`). Do
    **not** use the external URL from the API service — internal
    URLs avoid public network egress and are free of bandwidth
    charges.
4. API service → Environment → set `REDIS_URL` to that internal URL.
5. **Manual Deploy** → "Deploy latest commit". Watch logs for:

    ```text
    Redis connected — rate limiter using shared store.
    ```

    If you instead see `Redis store unavailable — falling back to
    in-memory limiter.`, the URL or auth is wrong.

---

## Optional — Render Cron Jobs

Three background scripts ship with the server. Each is a separate
Render **Cron Job** service that points at the same repo and runs
the matching npm script.

| Cron Job name | Root directory | Schedule (UTC) | Start command |
| --- | --- | --- | --- |
| `cleanup-stale-drafts` | `server` | `0 3 * * *` | `npm run cron:cleanup-drafts` |
| `cleanup-expired-tokens` | `server` | `0 * * * *` | `npm run cron:cleanup-tokens` |
| `certificate-reminder` | `server` | `0 10 * * *` | `npm run cron:certificate-reminder` |

For each job:

1. **New +** → **Cron Job** → connect the same repo.
2. Set the schedule and start command from the table.
3. Copy the **same** environment variables you set on the web
    service (Render does not share env across services). The fastest
    way is web service → **Environment** → "Save as Environment
    Group", then attach that group to each cron job.

Verify by hitting **Run job now** on each one and checking the log
prints a structured summary line.

---

## Frontend on Netlify

> **Fast path — `netlify.toml`.** A `client/netlify.toml` ships
> with the SPA and already pins the build command, the publish
> directory (`dist`), Node 20, the SPA fallback, and the
> immutable cache headers for `/assets/*`. Set the site's
> **Base directory** to `client` so Netlify discovers the file —
> after that, leave the rest of the build settings on the form
> blank and just add the `VITE_*` environment variables in the
> **Environment variables** section below.

1. <https://app.netlify.com> → **Add new site** → **Import from Git**.
2. Authorize GitHub if needed → pick the same repository.
3. Configure:

    | Field | Value |
    | --- | --- |
    | Branch to deploy | `main` |
    | Base directory | `client` |
    | Build command | `npm run build` |
    | Publish directory | `dist` (relative to the base directory) |
    | Functions directory | _leave blank_ |

4. **Environment variables** → add:

    | Key | Value |
    | --- | --- |
    | `VITE_API_BASE_URL` | `https://<your-render-service>.onrender.com/api` (note the `/api` suffix and **no** trailing slash) |
    | `VITE_SITE_URL` | `https://<your-site>.netlify.app` (or your custom domain) |
    | `VITE_APP_NAME` | `Lumen LMS` |
    | `VITE_FEATURE_CERTIFICATES` | `true` |
    | `VITE_FEATURE_HLS` | `false` |
    | `VITE_FEATURE_COMMAND_PALETTE` | `true` |
    | `VITE_FEATURE_BETA_QUIZ_TIMER` | `false` |
    | `VITE_FEATURE_ANALYTICS` | `false` |

5. **Deploy site**. The first build runs `npm install && npm run build`
    in `client/`. When it finishes, Netlify gives you a
    `https://<random-name>.netlify.app` URL — rename it under
    **Site configuration → Site name** to something readable.
6. SPA routing: `client/public/_redirects` is already present
    (`/*    /index.html   200`). It's copied into `dist/` by Vite's
    static-asset pipeline. No further action needed.
7. Custom domain (optional): **Domain management** → **Add custom
    domain** → follow Netlify's DNS / verification flow. HTTPS
    is auto-provisioned via Let's Encrypt.

---

## Final wiring (CORS + CSP)

After **both** services are live you have to teach them about each
other. Skip this and login will silently fail with a CORS error
every time.

### 1. API allows the SPA origin

Render → API service → Environment → set both:

- `CLIENT_URL` = the Netlify URL (e.g. `https://lumen-lms.netlify.app`)
- `CORS_ORIGINS` = the same value (comma-separated if you have more
   than one front-end, e.g. preview + production)

Click **Save Changes** → Render redeploys. From a browser DevTools
console at the SPA URL, run:

```js
fetch('/api/health').then(r => r.json()).then(console.log);
```

A `200` JSON response means CORS + base URL are both correct.

### 2. SPA CSP allows the API origin

The CSP shipped in `client/public/_headers` ends with `connect-src
'self' https://your-api.onrender.com;`. Replace that placeholder
with the real Render URL (no trailing slash, no path). Commit the
change with GitHub Desktop and push — Netlify will redeploy and
swap the `Content-Security-Policy` response header on the next
request.

Verify: open the SPA → DevTools → **Network** tab → reload → click
any document response → confirm `connect-src` lists your real API
origin. If you forget this, every `axios` call from the browser
will be blocked with `Refused to connect to '…' because it
violates the document's Content Security Policy.`.

---

## Post-deploy verification — functional

Walk through this end-to-end as a fresh user. Each box maps to a
real product surface; if any fails, fix it before sharing the URL.

- [ ] Register a new student account; email arrives within 60 s.
- [ ] Click the verification link; account marks verified.
- [ ] Login; refresh the page — the session persists (HttpOnly
       refresh cookie + access token in memory).
- [ ] Promote the new account to `instructor` (Atlas one-liner or
       the admin UI) → log out → log in → instructor dashboard
       loads.
- [ ] Create a course → upload a thumbnail (Cloudinary returns a
       `https://res.cloudinary.com/…` URL) → add a section + 2
       lessons (one video, one text) → add a quiz with at least
       3 questions.
- [ ] Submit the course for review.
- [ ] Log in as the seeded admin → moderation queue → approve.
- [ ] Log out → register a fresh student → verify → enroll → watch
       lessons → mark complete → take the quiz → reach 100% →
       download the certificate PDF (file opens in your viewer).
- [ ] Switch back to the instructor account → dashboard reflects the
       new enrolled student count.

---

## Post-deploy verification — security

These probe the hardening that's baked into the API. Skipping them is
how a portfolio project ships its first CVE.

- [ ] **Rate limit** — `for i in (1..11); curl … /api/auth/login` → the
       11th attempt returns `429`.
- [ ] **CORS** — `curl -H "Origin: https://evil.example" …` → the
       response is missing `Access-Control-Allow-Origin`, so the
       browser would block it.
- [ ] **Privilege escalation via register** — `POST /api/auth/register`
       with `role: "admin"` in the body → response shows the new
       user is `student`.
- [ ] **Privilege escalation via profile patch** — `PATCH /api/auth/me`
       with `role: "admin"` → response shows `role` unchanged.
- [ ] **Quiz client-side scoring** — submit a quiz with `score: 100`
       in the body → server ignores it and re-scores from `answers`.
- [ ] **Draft access** — fetch a `status: 'draft'` course via the
       public catalog endpoint → `404`.
- [ ] **Quiz answer leak** — fetch a quiz as a student before
       submitting → response has no `correctIndex` field on any
       option.
- [ ] **NoSQL injection** — `POST /api/auth/login` with body
       `{"email": {"$ne": null}, "password": {"$ne": null}}` →
       sanitised by `express-mongo-sanitize`; response is the
       generic `Invalid email or password.`.
- [ ] **Stored XSS** — set a course title to
       `<script>alert(1)</script>` → renders as escaped text in the
       catalog, no alert fires.
- [ ] **5xx leak check** — trigger any `500` (e.g. POST malformed
       JSON to a JSON-only route) → response body is the generic
       error envelope, no stack trace, no internal paths.
- [ ] **Headers** — `curl -I https://<api>/api/health` →
       `Strict-Transport-Security`, `X-Content-Type-Options`,
       `X-Frame-Options`, and `Content-Security-Policy` are all
       present; `X-Powered-By` is **absent**.
- [ ] **Admin self-protection** — admin attempts to delete own
       account or change own role → `403`.
- [ ] **Last-admin guard** — only one admin remaining tries to
       demote self → `403`.
- [ ] **Upload MIME spoof** — upload `evil.exe` renamed to
       `evil.jpg` → rejected by either Multer's MIME filter or
       Cloudinary's restricted-types policy.
- [ ] **Upload size cap** — upload a 10 MB image → rejected (5 MB
       cap from `multer.config.js`).
- [ ] **Lesson video URL leak** — fetch a non-preview lesson as an
       unenrolled student → `videoUrl` is absent / 403.
- [ ] **No secret leakage in logs** — Render logs → search for
       `password`, `Bearer`, `mongo`, `secret` → nothing leaks
       (the `pino` redact list scrubs at the logger level).

---

## Troubleshooting

### "Network Error" on every request from the SPA

99% of the time this is one of:

1. `VITE_API_BASE_URL` is missing the `/api` suffix — Vite bakes
    env vars in at **build** time, so changing it in Netlify
    requires a **redeploy** (not just a save).
2. The Render service has cold-started and the first request timed
    out. Free-tier services sleep after 15 min idle. Hit
    `/api/health` once to wake it.
3. CORS — `CLIENT_URL` on the API does not exactly match the SPA
    origin. Check trailing slashes, `http` vs `https`,
    `www.` vs apex.

### CSP blocks every API call

`Refused to connect to 'https://api…' because it violates the
document's Content Security Policy.` — you forgot the SPA-CSP
update in [Final wiring](#final-wiring-cors--csp). Replace the
placeholder in `client/public/_headers`, push, redeploy.

### Mongo connection times out on Render

Atlas → Network Access does not include the Render egress IPs for
your region. The error in Render logs will be
`MongoServerSelectionError: connection <monitor> to … timed out`.
Add the IPs (Render → docs → "Outbound IPs") and trigger a redeploy.

### Refresh-token cookie not persisting in the browser

The browser refuses third-party cookies on cross-origin requests
unless they have `SameSite=None; Secure`. The cookie helper in
`server/utils/cookies.js` already sets these in production. If it
still fails, confirm:

1. The API is served over HTTPS (Render does this by default).
2. The SPA is served over HTTPS (Netlify does this by default).
3. The browser isn't running in an old Incognito window with
    third-party cookies disabled.

### `npm run seed:admin` reports "User already exists"

That's the success path — the script is idempotent. The user has
been promoted to `admin` and reactivated. The original password is
unchanged; if forgotten, use the password-reset flow.

### Cron Job runs but nothing happens

The cron service has its own env scope. If `MONGO_URI` isn't set
on the cron service, the script connects to no database, finds
nothing to clean up, and exits `0` — silently doing nothing.
Re-attach the env group to every cron service.

---

## Going further

Once everything above is green:

- Roll the secrets per `docs/RUNBOOK.md` § "Rotate a secret" on the
   cadence your threat model warrants (we recommend 90 days for JWT
   secrets and 180 for SMTP / Cloudinary).
- Wire **Render notifications** (Slack / email) to deploy failures
   and high error rates. The aggregator + `X-Request-Id` flow in
   `docs/RUNBOOK.md` covers triage.
- Tag the release in GitHub Desktop (`v0.1.0`) so the next change
   has a clean diff base, and write the release notes directly on
   the GitHub Releases page.
