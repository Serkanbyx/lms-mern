/**
 * `useDocumentTitle(title, options?)`
 *
 * Sets `document.title` while the component is mounted and (optionally)
 * restores the previous title on unmount. Acts as a fallback when a page
 * doesn't render its own `<Helmet>` from `react-helmet-async`.
 *
 * The title is automatically suffixed with the public app name so every
 * tab gets the brand for free; pass `{ suffix: false }` to opt out.
 */

import { useEffect } from 'react';

const APP_NAME = import.meta.env.VITE_APP_NAME || 'Lumen LMS';

export const useDocumentTitle = (title, { suffix = true, restoreOnUnmount = false } = {}) => {
  useEffect(() => {
    if (typeof document === 'undefined' || !title) return undefined;

    const previous = document.title;
    document.title = suffix ? `${title} · ${APP_NAME}` : title;

    return () => {
      if (restoreOnUnmount) document.title = previous;
    };
  }, [title, suffix, restoreOnUnmount]);
};

export default useDocumentTitle;
