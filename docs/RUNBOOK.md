# Runbook

> Operational recipes for the most common day-2 tasks. Every entry
> assumes you're an admin with shell access to the relevant Render
> service.

---

## Table of contents

1. [Restart / drain a backend instance](#restart--drain-a-backend-instance)
2. [Rotate a secret](#rotate-a-secret)
3. [Promote a user to admin](#promote-a-user-to-admin)
4. [Restore from a database backup](#restore-from-a-database-backup)
5. [Trigger a cron job manually](#trigger-a-cron-job-manually)
6. [Toggle a feature flag in production](#toggle-a-feature-flag-in-production)
7. [Investigate a production 5xx](#investigate-a-production-5xx)
8. [Recover a locked-out account](#recover-a-locked-out-account)

---

## Restart / drain a backend instance

Trigger a graceful restart on Render → Service → "Manual deploy" →
"Deploy latest commit". Render fires SIGTERM; our handler in
`server/index.js`:

1. Stops accepting new connections (`server.close`).
2. Waits for in-flight requests to drain.
3. Closes the Mongo connection cleanly.
4. Closes the Redis connection.
5. Exits with code 0 — or force-exits at 10 s if anything hangs.

Watch the deploy log for these lines (in order). If you don't see
"HTTP server closed." within a few seconds, something is hanging on a
request — page the on-call.

To test the same handler locally:

```bash
# In one terminal
cd server && npm run dev

# In another terminal
kill -SIGTERM $(pgrep -f "nodemon index.js")
```

Logs should show `Shutdown signal received — draining connections.`
followed by `MongoDB connection closed.` and `Redis connection closed.`
(or just Mongo if you don't have Redis configured locally).

---

## Rotate a secret

The generic loop is:

1. Generate the new value.
2. Update the env var on the Render dashboard for **every** affected
   service (web, cron, preview).
3. Trigger a deploy on the web service so the new value is loaded.
4. Verify by signing in with a fresh session.
5. Revoke the old value at the source (Cloudinary console, MongoDB
   Atlas user, etc.).

Per-secret notes follow.

### `JWT_ACCESS_SECRET` (quarterly + on suspected compromise)

**Impact:** every existing access token becomes invalid. The SPA
seamlessly recovers via the refresh-token cookie within 15 minutes —
users do **not** need to log back in.

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Update the value on Render → API service → Environment, redeploy,
watch for a brief 401 spike followed by a `/api/auth/refresh` spike
that absorbs it within ~5 minutes.

### `JWT_REFRESH_SECRET` (only when required)

**Impact:** every refresh token becomes invalid → **all users are
forced to re-login**. Schedule and announce before doing this.

> Always rotate `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` at the
> **same** time when responding to a confirmed compromise — partial
> rotation leaves a usable token alive on the unrotated side.

### `CLOUDINARY_API_SECRET` (quarterly + on suspected compromise)

**Impact:** every previously minted signed video URL stops working.
New URLs are minted on the next request, so users see a brief stall
on any video already loaded in their player. Regenerate on the
Cloudinary dashboard, push to Render env, redeploy, then verify
upload + signed-URL playback against a freshly created test course.

### SMTP credentials (on provider rotation / leak)

Provision a new SMTP user / app password, update `SMTP_USER` and
`SMTP_PASS` on Render, redeploy, then trigger
`POST /api/auth/forgot-password` against an internal account and
confirm delivery.

### MongoDB credentials (on team change / leak)

1. In MongoDB Atlas, create a new database user with the same role set.
2. Update `MONGO_URI` on Render + redeploy.
3. Once the new instance is healthy, **delete** the old user from Atlas.
4. Audit the Atlas access list — remove IP entries that are no longer needed.

### `ADMIN_PASSWORD` (on handover / leak)

1. Generate a new strong password (≥ 12 chars).
2. Update Render env (so the seeder can be re-run if needed).
3. Sign in as the admin and change the password via
   `PATCH /api/auth/me/password`.
4. The env value is only consumed by `npm run seed:admin`; the live
   admin credential is stored hashed in the `User` collection from
   that point on.

---

## Promote a user to admin

Two options.

### Option A — `seed:admin` script (idempotent)

Set `ADMIN_EMAIL=user@example.com` and `ADMIN_PASSWORD=…` (the password
is only used if the user doesn't exist yet) in the worker's env, then:

```bash
npm run seed:admin
```

If the user already exists, the script promotes them to `role: admin`
and re-activates the account. It does **not** rotate the password.

### Option B — Mongo shell (one-off)

```js
db.users.updateOne(
  { email: 'user@example.com' },
  { $set: { role: 'admin', isActive: true } }
);
```

Audit the change in the security log: who promoted whom, when, why.

---

## Restore from a database backup

MongoDB Atlas keeps automated snapshots on the M10 tier and above.

1. Atlas → Cluster → Backup → pick the snapshot timestamp.
2. **Restore to a new cluster** (never overwrite production directly —
   one bad restore command becomes an unrecoverable incident).
3. Repoint the API at the restored cluster by flipping `MONGO_URI` on
   Render → trigger a deploy → smoke-test the most critical reads.
4. Cut over by updating DNS / connection strings everywhere else.
5. Decommission the old cluster only after 24 h of clean runtime on
   the restored one.

Do **not** use `mongorestore` against a live production cluster
without first confirming with another engineer.

---

## Trigger a cron job manually

Each cron script is also exposed via npm so you can run it on demand
(useful for backfills or to verify a one-off fix).

```bash
cd server
npm run cron:cleanup-drafts          # delete stale draft courses
npm run cron:cleanup-tokens          # sweep expired auth tokens
npm run cron:certificate-reminder    # nudge users with unclaimed certs
```

Each script:

- Connects via the shared `connectDB()` helper (so it uses the same
  `MONGO_URI` as the API).
- Logs a structured summary line through `pino`.
- Exits `0` on success (including "nothing to do") or `1` on error.

On Render, set the matching cron expressions on the dashboard:

| Script                    | Cron expression  | Description    |
| ------------------------- | ---------------- | -------------- |
| `cleanupStaleDrafts`      | `0 3 * * *`      | Daily 03:00 UTC |
| `cleanupExpiredTokens`    | `0 * * * *`      | Hourly         |
| `certificateReminder`     | `0 10 * * *`     | Daily 10:00 UTC |

---

## Toggle a feature flag in production

Flags are env-driven (no runtime control plane in v1). To kill-switch
the certificate feature for example:

1. Render → API service → Environment → set `FEATURE_CERTIFICATES=false`.
2. Render → Static site (client) → Environment → set
   `VITE_FEATURE_CERTIFICATES=false`.
3. Trigger a deploy on **both** services. The server flag stops the
   route immediately; the client flag hides the UI affordance on the
   next page load.

> Always flip both sides together. A flag that's off on one side and
> on on the other ships as a "button doesn't work" bug.

---

## Investigate a production 5xx

1. Log aggregator → filter by `level=error` and the request ID from
   the user report (every response carries `X-Request-Id`).
2. The structured pino line will include `req.url`, `res.statusCode`,
   `err.message`, and the redacted request snapshot — `authorization`,
   `cookie`, and password fields are scrubbed at the logger level so
   you can paste lines into a ticket without leaking secrets.
3. If the line points at a Mongoose validation, reproduce in a local
   shell with `mongosh` against a snapshot.
4. If the line points at an unhandled rejection, the process has
   already restarted (see graceful shutdown above). Audit the trace
   and ship a fix; the orchestrator will resume traffic on the new
   instance.

---

## Recover a locked-out account

Account lockout trips after `MAX_LOGIN_ATTEMPTS` consecutive
failed logins and persists for `LOCK_DURATION_MIN` minutes. To unlock
manually (e.g. user is on the phone with support):

```js
db.users.updateOne(
  { email: 'user@example.com' },
  { $unset: { lockUntil: '', failedLoginAttempts: '' } }
);
```

Always confirm identity through a second channel (verified phone, the
Slack handle on file) BEFORE running this — a malicious "support
request" is exactly how account takeover starts.
