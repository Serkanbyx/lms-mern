/**
 * `MotionProvider` — global Framer Motion configuration.
 *
 * Mounted once at the app root (above the router) so every `motion.*`
 * element inherits the same defaults:
 *
 *   - `reducedMotion="user"` honours the OS / browser preference, plus the
 *     in-app "Reduce animations" toggle (which sets the `no-animations`
 *     class on `<html>`; CSS keyframes & transitions are short-circuited
 *     in `index.css`).
 *   - A consistent default transition (emphasized ease, base duration) so
 *     ad-hoc usages stay visually coherent with the shared variants in
 *     `utils/motion.js`.
 *
 * Keeping this concern in a single component means motion behaviour is
 * one-line tunable across the entire product.
 */

import { MotionConfig } from 'framer-motion';
import { durations, ease } from '../../utils/motion.js';

export function MotionProvider({ children }) {
  return (
    <MotionConfig
      reducedMotion="user"
      transition={{ duration: durations.base, ease }}
    >
      {children}
    </MotionConfig>
  );
}

export default MotionProvider;
