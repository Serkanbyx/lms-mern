/**
 * Reusable rate limiters.
 *
 * Each export is an Express middleware created with `express-rate-limit`.
 * They are kept here (rather than next to the route) so different route
 * groups can share consistent windows/limits and so the Redis-backed store
 * (added in a later step) can be wired into a single place.
 *
 * Defaults use the in-memory store, which is sufficient for development
 * and single-instance deployments. The Redis upgrade only requires changing
 * the `store` option of each limiter — call sites stay untouched.
 *
 * The full STEP 18 matrix:
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
 */

import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

const FIFTEEN_MINUTES = 15 * 60 * 1000;
const TEN_MINUTES = 10 * 60 * 1000;

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
  keyGenerator: (req) =>
    req.user?._id
      ? `enroll:user:${req.user._id.toString()}`
      : `enroll:ip:${ipKeyGenerator(req.ip)}`,
  message: tooManyMessage(
    'Too many enrollment attempts. Please slow down and try again in a few minutes.',
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
};
