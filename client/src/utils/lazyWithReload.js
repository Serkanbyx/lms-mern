/**
 * `lazyWithReload` — drop-in replacement for `React.lazy` that survives
 * stale-bundle deploys.
 *
 * Why this exists:
 *   When a new build ships, the entry bundle currently in the browser
 *   was built against an OLD asset manifest. Any `import()` call from
 *   that entry resolves to a chunk filename (with a hash) that the
 *   Netlify CDN no longer serves — the import rejects, Suspense never
 *   resolves, AnimatePresence has already unmounted the previous
 *   route, and the user sees a fully blank screen until they hard-
 *   reload.
 *
 * Strategy:
 *   1. Detect a chunk-load failure (Vite/webpack throw distinct but
 *      stable messages — we match all known shapes).
 *   2. Force ONE hard reload (`location.reload()`) so the browser
 *      fetches the fresh `index.html` and, with it, the new entry +
 *      manifest. Return a never-resolving promise so React keeps
 *      rendering the Suspense fallback during the brief window before
 *      navigation kicks in.
 *   3. Guard against infinite loops with a `sessionStorage` flag:
 *      if we already reloaded once for THIS chunk in this session and
 *      it still failed, give up and re-throw so the ErrorBoundary
 *      shows its branded "Something went wrong" UI instead of looping.
 *
 * Trade-off:
 *   The user loses any unsaved in-page state (form drafts, scroll,
 *   modal open) during the reload. Acceptable because the alternative
 *   is a permanently blank screen that requires a manual hard reload
 *   anyway.
 */

import { lazy } from 'react';

const RELOAD_FLAG_PREFIX = 'lms.chunkReload:';

const looksLikeChunkLoadFailure = (err) => {
  const message = String(err?.message ?? '');
  // Vite (`Failed to fetch dynamically imported module`) + webpack
  // (`Loading chunk N failed`) + Safari (`Importing a module script
  // failed`) all phrase it differently. Cover the common shapes.
  return (
    /Failed to fetch dynamically imported module/i.test(message) ||
    /Loading chunk [\w-]+ failed/i.test(message) ||
    /Importing a module script failed/i.test(message) ||
    err?.name === 'ChunkLoadError'
  );
};

const reloadOnceFor = (key) => {
  if (typeof window === 'undefined') return false;
  const flag = `${RELOAD_FLAG_PREFIX}${key}`;
  try {
    if (window.sessionStorage.getItem(flag)) return false;
    window.sessionStorage.setItem(flag, String(Date.now()));
  } catch {
    // Storage disabled — proceed with the reload anyway; worst case
    // is a single extra reload, not an infinite loop (the second
    // attempt will hit the catch and rethrow).
  }
  // `location.reload()` returns void synchronously but the browser
  // navigates immediately after the current tick — return a promise
  // that never resolves so React keeps the Suspense fallback up
  // instead of flashing an error UI in between.
  window.location.reload();
  return true;
};

export const lazyWithReload = (importer, key = importer.toString()) =>
  lazy(async () => {
    try {
      return await importer();
    } catch (err) {
      if (looksLikeChunkLoadFailure(err) && reloadOnceFor(key)) {
        return new Promise(() => {});
      }
      throw err;
    }
  });

export default lazyWithReload;
