/**
 * Client-side feature flags.
 *
 * Cosmetic counterpart to `server/config/features.js`. Hides UI
 * affordances for features that are dark-launched OFF in production.
 * The server flag is the security-critical one — flipping the client
 * flag alone never grants access to a gated route, it only stops users
 * seeing a button that would 404.
 *
 * Conventions:
 *  - Default to ENABLED (`!== 'false'`) for shipping features so a
 *    missing env var doesn't accidentally hide a stable feature.
 *  - Default to DISABLED (`=== 'true'`) for beta features so we don't
 *    accidentally expose work-in-progress UX.
 *  - Each flag here MUST have a server-side mirror with the same
 *    default value. Diverging defaults ship as bugs.
 *
 * Vite exposes `import.meta.env.VITE_*` to the client bundle at build
 * time. Anything not prefixed with `VITE_` is dropped — keep secrets
 * on the server.
 */

const isFalse = (value) => String(value).toLowerCase() === 'false';
const isTrue = (value) => String(value).toLowerCase() === 'true';

export const features = Object.freeze({
  /**
   * Certificate download buttons + email reminders. Default ON.
   * Mirrors `FEATURE_CERTIFICATES` on the server.
   */
  certificates: !isFalse(import.meta.env.VITE_FEATURE_CERTIFICATES),

  /**
   * Cloudinary HLS adaptive streaming for the lesson player. Default
   * OFF — flip to true once the HLS pipeline is plumbed end-to-end.
   * Mirrors `FEATURE_HLS` on the server.
   */
  hlsStreaming: isTrue(import.meta.env.VITE_FEATURE_HLS),

  /**
   * Command palette (⌘K). Default ON — a power-user surface that has
   * shipped, but the kill switch lets us hide it instantly if a
   * future regression breaks navigation.
   */
  commandPalette: !isFalse(import.meta.env.VITE_FEATURE_COMMAND_PALETTE),

  /**
   * Quiz time-limit countdown chip + force-submit. Default OFF until
   * the timer UX has been QA'd on the mobile matrix. Mirrors
   * `FEATURE_BETA_QUIZ_TIMER` on the server.
   */
  betaQuizTimer: isTrue(import.meta.env.VITE_FEATURE_BETA_QUIZ_TIMER),

  /**
   * Analytics event wrapper (Plausible/Umami once wired). Default OFF
   * — the wrapper is a no-op until a backend is chosen and the
   * snippet is loaded in `index.html`.
   */
  analytics: isTrue(import.meta.env.VITE_FEATURE_ANALYTICS),
});

export default features;
