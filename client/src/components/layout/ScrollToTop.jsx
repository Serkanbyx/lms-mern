/**
 * `ScrollToTop` — restore viewport to (0, 0) on every router transition
 * unless the destination URL carries a `#hash` (anchor link inside the
 * same document, e.g. `/about#team`).
 *
 * Why this exists:
 *   React Router intentionally does NOT reset scroll on `pushState`
 *   navigation. Without this component, clicking "Sign up to enroll"
 *   on a long course detail page lands the user mid-form on
 *   `/register?next=…`, and clicking a card from `/courses` opens the
 *   detail page already scrolled to wherever the previous catalog
 *   viewport ended. Both feel like dead links.
 *
 * Behaviour:
 *   - Triggers on `pathname` and `search` changes — not on hash changes
 *     (so the browser's native `#anchor` jump works as expected).
 *   - Honours `prefers-reduced-motion`: jumps instantly (`'auto'`) for
 *     users with motion sensitivity, smooth-scrolls for everyone else.
 *   - Renders nothing — pure side-effect, mount once near the router.
 */

import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const prefersReducedMotion = () => {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
};

export function ScrollToTop() {
  const { pathname, search, hash } = useLocation();

  useEffect(() => {
    if (hash) return;
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
    });
  }, [pathname, search, hash]);

  return null;
}

export default ScrollToTop;
