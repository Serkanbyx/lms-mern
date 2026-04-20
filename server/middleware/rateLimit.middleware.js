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

import rateLimit from 'express-rate-limit';

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

export default { uploadLimiter };
