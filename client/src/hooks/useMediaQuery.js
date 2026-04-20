/**
 * `useMediaQuery(query)`
 *
 * Subscribes to a CSS media-query and returns its current `matches` flag.
 * Useful when a behaviour can't be expressed with Tailwind responsive
 * utilities alone (e.g. mounting a different component on mobile, or
 * skipping an animation on small screens).
 *
 * The hook listens to `change` events via `addEventListener` (the
 * legacy `addListener` API is intentionally NOT used — every modern
 * browser supports the standard event API).
 */

import { useEffect, useState } from 'react';

const isBrowser = typeof window !== 'undefined' && typeof window.matchMedia === 'function';

const getMatches = (query) => (isBrowser ? window.matchMedia(query).matches : false);

export const useMediaQuery = (query) => {
  const [matches, setMatches] = useState(() => getMatches(query));

  useEffect(() => {
    if (!isBrowser) return undefined;
    const mql = window.matchMedia(query);
    const onChange = (event) => setMatches(event.matches);
    setMatches(mql.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);

  return matches;
};

export default useMediaQuery;
