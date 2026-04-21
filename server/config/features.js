/**
 * Server-side feature flags.
 *
 * Centralised toggle surface for non-trivial features so we can:
 *  - dark-launch a backend route in production WITHOUT a code change
 *    (flip the env var, restart the dyno, watch the metrics),
 *  - kill-switch a feature instantly if it misbehaves (no rollback,
 *    no redeploy — set the flag to "false" and recycle),
 *  - keep the conditional logic in one place so a future "rip the
 *    flag out" cleanup pass is `grep -nrw "features\\." server/`.
 *
 * MIRROR with `client/src/config/features.js`:
 *  - Whenever a feature can be reached from BOTH surfaces (e.g.
 *    certificates: a button on the dashboard, an API route on the
 *    server) the flag MUST exist on both sides and they MUST default
 *    to the same value. The server flag is the security-critical one
 *    (it gates the route); the client flag is purely cosmetic (it
 *    hides the entry point so users don't see a button that 404s).
 *
 * USAGE:
 *   import { features } from '../config/features.js';
 *   if (!features.certificates) return res.status(404).end();
 *
 * No third-party flag service for v1 — env vars are good enough for
 * a small team and one production environment. When/if we outgrow
 * this, swap the implementation here without touching any callsite.
 */

import { env } from './env.js';

export const features = Object.freeze({
  /**
   * Certificate generation + download endpoints. Mirrors
   * `VITE_FEATURE_CERTIFICATES` on the client.
   */
  certificates: env.FEATURE_CERTIFICATES,

  /**
   * Cloudinary HLS adaptive streaming for lesson videos. When `false`
   * the upload pipeline still works (MP4) but the player falls back
   * to progressive download. Mirrors `VITE_FEATURE_HLS`.
   */
  hlsStreaming: env.FEATURE_HLS,

  /**
   * Beta quiz time-limit field on the quiz builder. Mirrors
   * `VITE_FEATURE_BETA_QUIZ_TIMER`. Off by default — flip to `true`
   * once the timer UX has been QA'd on the mobile matrix.
   */
  betaQuizTimer: env.FEATURE_BETA_QUIZ_TIMER,
});

export default features;
