/**
 * `useDocumentTitle(title, options?)`
 *
 * Sets `document.title` while the component is mounted and (optionally)
 * restores the previous title on unmount. Acts as a fallback when a page
 * doesn't render its own `<Helmet>` from `react-helmet-async`.
 *
 * The title is automatically suffixed with the public app name so every
 * tab gets the brand for free; pass `{ suffix: false }` to opt out.
 *
 * IMPLEMENTATION — `useLayoutEffect` (with an SSR-safe fallback) instead
 * of `useEffect`. SPA navigation between two pages that both call this
 * hook can otherwise race: the previous page's effect runs after the new
 * page is committed when chunks are loaded asynchronously, leaving the
 * stale title visible for a frame. Layout effects fire synchronously
 * after the DOM mutation and before paint, so the tab title always
 * matches what the user is looking at.
 */

import { useEffect, useLayoutEffect } from 'react';

const APP_NAME = import.meta.env.VITE_APP_NAME || 'Lumen LMS';

// `useLayoutEffect` warns when called during SSR (no DOM); fall back to
// `useEffect` in that environment so the warning never reaches users.
const useIsoLayoutEffect =
  typeof document === 'undefined' ? useEffect : useLayoutEffect;

export const useDocumentTitle = (title, { suffix = true, restoreOnUnmount = false } = {}) => {
  useIsoLayoutEffect(() => {
    if (typeof document === 'undefined' || !title) return undefined;

    const previous = document.title;
    document.title = suffix ? `${title} · ${APP_NAME}` : title;

    return () => {
      if (restoreOnUnmount) document.title = previous;
    };
  }, [title, suffix, restoreOnUnmount]);
};

export default useDocumentTitle;
