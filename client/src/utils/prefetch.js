/**
 * Lightweight catalog prefetch helper.
 *
 * Scenario: a visitor hovers (or focuses) the "Browse courses" CTA on
 * the landing page. There's a high probability they're about to open
 * `/courses`. We can warm the catalog request in the background and
 * stash the result in `sessionStorage` so the catalog page can paint
 * its first viewport from cache while it revalidates.
 *
 * Two cheap layers stack here:
 *  - **Code prefetch**: dynamic-import the catalog page module so its
 *    JS chunk is on disk by the time the user clicks.
 *  - **Data prefetch**: hit the popular-courses listing with the same
 *    payload `CourseCatalogPage` will request first, and cache it
 *    under a stable key for `readPrefetched()` to consume.
 *
 * The promise is intentionally swallowed: a failure here is
 * invisible to the user and we never want a hover to surface a toast.
 */

import { listCourses } from '../services/course.service.js';

const STORAGE_KEY = 'lms.prefetch.catalog';
const STALE_AFTER_MS = 60_000;

let inflight = false;

const safeSession = () => {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
};

export const prefetchCatalog = (params = {}) => {
  if (inflight) return;
  inflight = true;

  // Warm the route bundle in parallel — Vite generates a chunk per
  // dynamic import boundary, so this just nudges the browser to fetch
  // it now instead of after the click.
  import('../pages/public/CourseCatalogPage.jsx').catch(() => {});

  listCourses({ sort: 'popular', limit: 12, ...params })
    .then((payload) => {
      const session = safeSession();
      if (!session) return;
      try {
        session.setItem(
          STORAGE_KEY,
          JSON.stringify({ ts: Date.now(), payload, params }),
        );
      } catch {
        // Quota exceeded or private mode — silently give up.
      }
    })
    .catch(() => {})
    .finally(() => {
      inflight = false;
    });
};

/**
 * Read a previously-prefetched catalog payload if it's still fresh
 * AND was collected for the same query shape. Returns `null` when
 * nothing is cached or the entry is past its TTL — callers should
 * fall back to a normal fetch in that case.
 */
export const readPrefetchedCatalog = (params = {}) => {
  const session = safeSession();
  if (!session) return null;

  let raw;
  try {
    raw = session.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;

  try {
    const { ts, payload, params: cachedParams } = JSON.parse(raw);
    if (Date.now() - ts > STALE_AFTER_MS) return null;
    if (JSON.stringify(cachedParams ?? {}) !== JSON.stringify(params ?? {})) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
};

export default prefetchCatalog;
