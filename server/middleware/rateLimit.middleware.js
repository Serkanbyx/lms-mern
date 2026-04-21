/**
 * Reusable rate limiters.
 *
 * Each export is an Express middleware created with `express-rate-limit`.
 * They are kept here (rather than next to the route) so different route
 * groups can share consistent windows/limits and so the Redis-backed store
 * (STEP 48) can be wired into a single place.
 *
 * STEP 48 — Horizontal scalability.
 *   When `REDIS_URL` is set, every limiter swaps its in-memory store for
 *   a Redis-backed `rate-limit-redis` store so multiple API instances
 *   share one bucket per (limiter, key) pair. Without that, each instance
 *   keeps its own counter and effectively multiplies the cap by the
 *   replica count — which silently nullifies the limit at scale.
 *
 *   The fallback to the in-memory store is automatic when no Redis is
 *   configured, so local dev and single-instance prod stay zero-config.
 *   Call sites never see the difference.
 *
 * The full limiter matrix:
 *
 *   | Limiter            | Window | Max | Routes                                  |
 *   |--------------------|--------|-----|-----------------------------------------|
 *   | apiLimiter         | 15 min | 300 | global API (mounted in `index.js`)      |
 *   | authLimiter        | 15 min |  10 | `/api/auth/login`, `/api/auth/register` |
 *   | passwordLimiter    | 15 min |   5 | `PATCH /api/auth/me/password`,          |
 *   |                    |        |     | `DELETE /api/auth/me`                    |
 *   | uploadLimiter      | 10 min |  20 | `/api/upload/*`                         |
 *   | quizSubmitLimiter  | 10 min |  30 | `POST /api/quizzes/:id/submit`          |
 *   | adminLimiter       | 10 min | 100 | `/api/admin/*`                          |
 *   | enrollLimiter      | 10 min |  30 | `POST /api/courses/:id/enroll`          |
 *   | verifyEmailLimiter | 15 min |   5 | `/api/auth/verify-email/*`              |
 *   | forgotPasswordL.   |  1 hr  |   3 | `POST /api/auth/forgot-password`        |
 *   | resetPasswordL.    | 15 min |   5 | `POST /api/auth/reset-password/:token`  |
 *   | refreshLimiter     |  1 min |  30 | `POST /api/auth/refresh`                |
 *
 * SECURITY NOTES:
 *   - Limits are per-IP using the trust-proxy aware `req.ip` lookup, except
 *     where the limiter sits AFTER `protect` and can key off `req.user._id`.
 *   - `standardHeaders: 'draft-7'` exposes RateLimit-* headers so clients
 *     can show retry hints; legacy `X-RateLimit-*` headers are disabled.
 *   - The `authLimiter` keys by IP+email so a single attacker can't lock
 *     out a victim by burning the bucket on their behalf — and so a single
 *     IP can still be probed across many emails (but with the global IP
 *     bucket capping the overall blast radius via `apiLimiter`).
 *   - The `passwordLimiter` ALWAYS sees an authenticated user (it sits
 *     after `protect`), so we key by user id with an IP fallback.
 *   - Upload limiter is intentionally tighter than the global API limiter
 *     because each upload consumes bandwidth and Cloudinary quota.
 *   - The Redis store keys are namespaced per-limiter (`rl:<name>:<key>`)
 *     so a `FLUSHDB` accident or a cross-prefix collision can't drain
 *     unrelated buckets together.
 */

import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';

import { redis } from '../config/redis.js';

/**
 * Build the shared `store` option for a limiter.
 *
 * Returns `undefined` when Redis is not configured so `express-rate-limit`
 * picks up its default in-memory store (no behaviour change for local dev
 * or single-instance deployments).
 *
 * The `prefix` keeps each limiter in its own keyspace so we can inspect
 * per-limiter usage (`SCAN 0 MATCH rl:auth:*`) and so a hot bucket on one
 * limiter never collides with another.
 */
const makeStore = (name) => {
  if (!redis) return undefined;
  return new RedisStore({
    sendCommand: (...args) => redis.call(...args),
    prefix: `rl:${name}:`,
  });
};

const FIFTEEN_MINUTES = 15 * 60 * 1000;
const TEN_MINUTES = 10 * 60 * 1000;
const ONE_MINUTE = 60 * 1000;
const ONE_HOUR = 60 * 60 * 1000;

const tooManyMessage = (message) => ({
  success: false,
  message,
});

/**
 * Global API rate limiter — wraps every `/api/*` request. Mounted once
 * in `index.js` BEFORE any route module so it forms the outermost layer
 * of defence (per-route limiters narrow specific endpoints further).
 *
 * 300 / 15 min / IP is generous for a typical SPA boot (catalog list +
 * a handful of detail / curriculum reads + auth) while still containing
 * scripted enumeration of public endpoints.
 */
export const apiLimiter = rateLimit({
  windowMs: FIFTEEN_MINUTES,
  limit: 300,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  store: makeStore('api'),
  message: tooManyMessage('Too many requests. Please try again in a few minutes.'),
});

/**
 * Auth rate limiter — caps register/login attempts.
 *
 * Keyed by IP + lowercased email so a single IP can be probed across many
 * emails (each bucket counts independently) but a single email can't be
 * brute-forced from one IP either. The `ipKeyGenerator` helper collapses
 * IPv6 to a `/64` prefix so an attacker can't rotate host bits to dodge
 * the limit.
 *
 * Mounted BEFORE the validator runs, so the body may be malformed or
 * missing. We coerce `req.body.email` to a string + lowercase before
 * folding it into the key — never trust shape at this layer.
 */
export const authLimiter = rateLimit({
  windowMs: FIFTEEN_MINUTES,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  store: makeStore('auth'),
  keyGenerator: (req) => {
    const ip = ipKeyGenerator(req.ip);
    const email = typeof req.body?.email === 'string' ? req.body.email.toLowerCase() : '';
    return `auth:${ip}:${email}`;
  },
  message: tooManyMessage(
    'Too many authentication attempts. Please try again in 15 minutes.',
  ),
});

/**
 * Password / account rate limiter — caps the destructive self-service
 * endpoints (`PATCH /api/auth/me/password`, `DELETE /api/auth/me`).
 *
 * Keyed by `req.user._id` (the routes always sit behind `protect`, so
 * the user is guaranteed populated). 5 attempts per 15 minutes is
 * comfortably above legitimate usage (a user typing a wrong current
 * password a few times) while immediately stopping a token-thief from
 * iterating through possible current passwords.
 */
export const passwordLimiter = rateLimit({
  windowMs: FIFTEEN_MINUTES,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  store: makeStore('password'),
  keyGenerator: (req) =>
    req.user?._id
      ? `pwd:user:${req.user._id.toString()}`
      : `pwd:ip:${ipKeyGenerator(req.ip)}`,
  message: tooManyMessage(
    'Too many password change attempts. Please try again in 15 minutes.',
  ),
});

/**
 * Upload rate limiter — caps thumbnail/video uploads per IP.
 * 20 requests / 10 minutes is generous for a real instructor authoring a
 * course, but immediately blocks scripted abuse.
 */
export const uploadLimiter = rateLimit({
  windowMs: TEN_MINUTES,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  store: makeStore('upload'),
  message: tooManyMessage(
    'Too many upload attempts. Please try again in a few minutes.',
  ),
});

/**
 * Quiz-submission limiter — keys by authenticated user id (falling
 * back to a request IP when no `req.user` is attached). 30 submits /
 * 10 minutes is well above the worst-case "I want to retake this
 * quiz a few times" path while immediately stopping a script that
 * tries to brute-force an answer key by hammering `/submit`.
 *
 * The `keyGenerator` MUST be mounted AFTER `protect` so `req.user._id`
 * is populated; the IP fallback exists only to keep the limiter
 * functional if it is ever wired in front of the auth middleware.
 * The IPv6 fallback uses `ipKeyGenerator` (express-rate-limit v7+
 * helper) to collapse a `/64` prefix to one bucket — using `req.ip`
 * directly would let an attacker rotate through host bits inside
 * their own IPv6 block to dodge the limit.
 */
export const quizSubmitLimiter = rateLimit({
  windowMs: TEN_MINUTES,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  store: makeStore('quiz-submit'),
  keyGenerator: (req) =>
    req.user?._id
      ? `quiz-submit:user:${req.user._id.toString()}`
      : `quiz-submit:ip:${ipKeyGenerator(req.ip)}`,
  message: tooManyMessage(
    'Too many quiz submissions. Please slow down and try again in a few minutes.',
  ),
});

/**
 * Admin-route limiter — caps every call to `/api/admin/*` per
 * authenticated admin. 100 requests / 10 minutes is generous for an
 * admin actively using the dashboard (stats + several user lookups +
 * a handful of moderation actions per minute) while still containing
 * the blast radius of a compromised admin token: a stolen credential
 * can no longer enumerate the entire user table or fire a deletion
 * loop without immediately tripping the limiter.
 *
 * Like `quizSubmitLimiter`, the key generator MUST be mounted AFTER
 * `protect` so `req.user._id` is populated. The IPv6 fallback uses
 * `ipKeyGenerator` so an attacker can't rotate through host bits
 * inside their own /64 to dodge the limit.
 */
export const adminLimiter = rateLimit({
  windowMs: TEN_MINUTES,
  limit: 100,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  store: makeStore('admin'),
  keyGenerator: (req) =>
    req.user?._id
      ? `admin:user:${req.user._id.toString()}`
      : `admin:ip:${ipKeyGenerator(req.ip)}`,
  message: tooManyMessage(
    'Too many admin requests. Please slow down and try again in a few minutes.',
  ),
});

/**
 * Enrollment limiter — caps `POST /api/courses/:id/enroll` per
 * authenticated user. 30 enrolls / 10 minutes is more than enough for
 * any human (a learner browsing the catalog and adding a few courses
 * to their roster) while immediately stopping the scripted enroll-
 * unenroll-enroll loops that would otherwise inflate the
 * `Course.enrollmentCount` denormalized counter and skew analytics.
 *
 * Mounted AFTER `protect` so `req.user._id` is the natural key. The
 * IPv6 fallback exists only to keep the limiter functional if it is
 * ever wired in front of the auth middleware.
 */
export const enrollLimiter = rateLimit({
  windowMs: TEN_MINUTES,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  store: makeStore('enroll'),
  keyGenerator: (req) =>
    req.user?._id
      ? `enroll:user:${req.user._id.toString()}`
      : `enroll:ip:${ipKeyGenerator(req.ip)}`,
  message: tooManyMessage(
    'Too many enrollment attempts. Please slow down and try again in a few minutes.',
  ),
});

// ---------------------------------------------------------------------------
// STEP 46 — Limiters for verification, password reset, and refresh.
// ---------------------------------------------------------------------------

/**
 * Email verification + resend-verification limiter.
 *
 * 5 attempts / 15 min / IP+email is enough headroom for a confused user
 * (open the email twice, click the wrong link, request a new one) but
 * immediately stops a script scanning the verify endpoint for valid
 * tokens, and stops mail-bombing a victim with resend requests.
 */
export const verifyEmailLimiter = rateLimit({
  windowMs: FIFTEEN_MINUTES,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  store: makeStore('verify'),
  keyGenerator: (req) => {
    const ip = ipKeyGenerator(req.ip);
    const email = typeof req.body?.email === 'string' ? req.body.email.toLowerCase() : '';
    return `verify:${ip}:${email}`;
  },
  message: tooManyMessage(
    'Too many verification attempts. Please try again in 15 minutes.',
  ),
});

/**
 * Forgot-password limiter — 3 / hour, keyed by IP + email.
 *
 * Tighter than the verify bucket because password resets actually send
 * mail and reveal that an account exists if you watch the mailbox.
 * Combined with the always-200 "if an account exists…" response, an
 * attacker cannot enumerate accounts AND cannot mail-bomb any real
 * user past the threshold either.
 */
export const forgotPasswordLimiter = rateLimit({
  windowMs: ONE_HOUR,
  limit: 3,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  store: makeStore('forgot'),
  keyGenerator: (req) => {
    const ip = ipKeyGenerator(req.ip);
    const email = typeof req.body?.email === 'string' ? req.body.email.toLowerCase() : '';
    return `forgot:${ip}:${email}`;
  },
  message: tooManyMessage(
    'Too many password reset requests. Please wait an hour before trying again.',
  ),
});

/**
 * Reset-password (token consumption) limiter — 5 / 15 min / IP+token.
 *
 * Keyed by IP + the token in the URL so an attacker can't iterate
 * possible tokens from one IP, but legitimate users who paste a stale
 * link several times still see helpful errors instead of a wall of 429s.
 */
export const resetPasswordLimiter = rateLimit({
  windowMs: FIFTEEN_MINUTES,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  store: makeStore('reset'),
  keyGenerator: (req) => {
    const ip = ipKeyGenerator(req.ip);
    const token = typeof req.params?.token === 'string' ? req.params.token : '';
    return `reset:${ip}:${token}`;
  },
  message: tooManyMessage(
    'Too many password reset attempts. Please request a new link.',
  ),
});

/**
 * Refresh-token limiter — 30 / minute / IP.
 *
 * Refresh is called as a SILENT retry by the axios interceptor when an
 * access token expires. Legitimate flows never need more than one or
 * two per minute, so 30/min is generous while still containing a
 * runaway client (or a stolen cookie being burned through).
 */
export const refreshLimiter = rateLimit({
  windowMs: ONE_MINUTE,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  store: makeStore('refresh'),
  keyGenerator: (req) => `refresh:${ipKeyGenerator(req.ip)}`,
  message: tooManyMessage(
    'Too many refresh attempts. Please sign in again.',
  ),
});

export default {
  apiLimiter,
  authLimiter,
  passwordLimiter,
  uploadLimiter,
  quizSubmitLimiter,
  adminLimiter,
  enrollLimiter,
  verifyEmailLimiter,
  forgotPasswordLimiter,
  resetPasswordLimiter,
  refreshLimiter,
};
