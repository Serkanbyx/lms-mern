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
 * SECURITY NOTES:
 *   - Limits are per-IP using the trust-proxy aware `req.ip` lookup.
 *   - `standardHeaders: 'draft-7'` exposes RateLimit-* headers so clients
 *     can show retry hints; legacy `X-RateLimit-*` headers are disabled.
 *   - Upload limiter is intentionally tighter than the global API limiter
 *     because each upload consumes bandwidth and Cloudinary quota.
 */

import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

/**
 * Upload rate limiter — caps thumbnail/video uploads per IP.
 * 20 requests / 10 minutes is generous for a real instructor authoring a
 * course, but immediately blocks scripted abuse.
 */
export const uploadLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many upload attempts. Please try again in a few minutes.',
  },
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
  windowMs: 10 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req) =>
    req.user?._id
      ? `quiz-submit:user:${req.user._id.toString()}`
      : `quiz-submit:ip:${ipKeyGenerator(req.ip)}`,
  message: {
    success: false,
    message: 'Too many quiz submissions. Please slow down and try again in a few minutes.',
  },
});

export default { uploadLimiter, quizSubmitLimiter };
