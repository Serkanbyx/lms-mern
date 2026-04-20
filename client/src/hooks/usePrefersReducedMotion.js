/**
 * `usePrefersReducedMotion()`
 *
 * Returns `true` when the OS / browser reports the user prefers reduced
 * motion. Animation primitives (Framer Motion variants, skeleton shimmer,
 * confetti bursts) gate their output behind this hook so we honour the
 * accessibility setting without ever asking the user to toggle a switch.
 */

import { useMediaQuery } from './useMediaQuery.js';

const QUERY = '(prefers-reduced-motion: reduce)';

export const usePrefersReducedMotion = () => useMediaQuery(QUERY);

export default usePrefersReducedMotion;
