/**
 * `useIntersection(ref, options?)`
 *
 * Thin React wrapper around `IntersectionObserver`. Returns the latest
 * `IntersectionObserverEntry` for the observed element (or `null` until
 * the first callback fires).
 *
 * Powers lazy-loaded course thumbnails, scroll-triggered animations,
 * and the catalog's infinite-scroll sentinel.
 *
 * `options` is the standard `IntersectionObserverInit` shape:
 *   { root?, rootMargin?, threshold? }
 *
 * Pass `{ once: true }` to disconnect the observer the first time the
 * target becomes visible — handy for "reveal once and forget" effects.
 */

import { useEffect, useRef, useState } from 'react';

export const useIntersection = (ref, { once = false, ...observerInit } = {}) => {
  const [entry, setEntry] = useState(null);
  const observerRef = useRef(null);

  useEffect(() => {
    const node = ref?.current;
    if (
      !node ||
      typeof window === 'undefined' ||
      typeof window.IntersectionObserver === 'undefined'
    ) {
      return undefined;
    }

    observerRef.current = new IntersectionObserver(([nextEntry]) => {
      setEntry(nextEntry);
      if (once && nextEntry.isIntersecting) {
        observerRef.current?.disconnect();
      }
    }, observerInit);

    observerRef.current.observe(node);
    return () => observerRef.current?.disconnect();
    // The observer init object is treated as a config snapshot — callers
    // should memoise it if they need re-observation on change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref, once]);

  return entry;
};

export default useIntersection;
