/**
 * `Seo` — single source of truth for per-page metadata.
 *
 * Wraps `react-helmet-async` so feature pages don't have to hand-roll
 * the same five OG/Twitter tags every time. The provider itself is
 * mounted once at the app root in `main.jsx`.
 *
 * What it sets
 * ------------
 *   - `<title>`          — auto-suffixed with the public app name so
 *                          every tab gets the brand for free.
 *   - `<meta description>`
 *   - `<link rel="canonical">` — built off `VITE_SITE_URL` (or the
 *                          live `window.location.origin` as a runtime
 *                          fallback) so the same code ships clean
 *                          across local / staging / production.
 *   - Open Graph (`og:title`, `og:description`, `og:image`, `og:url`,
 *     `og:type`, `og:site_name`).
 *   - Twitter Cards (`summary_large_image`, title, description, image).
 *   - `<meta name="robots" content="noindex, nofollow">` when
 *     `noIndex` is true (auth pages, dashboards, settings).
 *
 * Image resolution
 * ----------------
 * Pass either an absolute URL or a path relative to the site root
 * (`/og-default.png`, `/uploads/foo.jpg`); we promote it to an
 * absolute URL because crawlers reject relative `og:image` values.
 *
 * Extending
 * ---------
 * Render structured data (JSON-LD, additional `<link>`s, etc.) by
 * passing children — they slot directly into the underlying `<Helmet>`.
 * The companion `<JsonLd>` helper is the canonical way to do that.
 */

import { Helmet } from 'react-helmet-async';

const APP_NAME = import.meta.env.VITE_APP_NAME || 'Lumen LMS';
const SITE_URL = (import.meta.env.VITE_SITE_URL || '').replace(/\/$/, '');
const DEFAULT_IMAGE = '/og-default.png';

const isAbsolute = (value) => /^https?:\/\//i.test(value);

const resolveOrigin = () => {
  if (SITE_URL) return SITE_URL;
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  return '';
};

const toAbsoluteUrl = (value) => {
  if (!value) return '';
  if (isAbsolute(value)) return value;
  const origin = resolveOrigin();
  if (!origin) return value;
  return `${origin}${value.startsWith('/') ? '' : '/'}${value}`;
};

const currentPathWithSearch = () => {
  if (typeof window === 'undefined') return '/';
  return `${window.location.pathname}${window.location.search}`;
};

export function Seo({
  title,
  description,
  image,
  url,
  type = 'website',
  noIndex = false,
  children,
}) {
  // When no title is supplied we deliberately omit `<title>` instead of
  // emitting the bare app name — that way an outer `<Seo noIndex />`
  // in a layout/shell never clobbers a child page's `useDocumentTitle`
  // call (or its own inner `<Seo title="…" />` rendered later in the
  // tree). Same idea drives the omission of og:title when title is
  // missing: don't pretend we know the page name when we don't.
  const pageTitle = title ? `${title} · ${APP_NAME}` : null;

  const canonical = toAbsoluteUrl(url ?? currentPathWithSearch());
  const ogImage = toAbsoluteUrl(image ?? DEFAULT_IMAGE);

  return (
    <Helmet prioritizeSeoTags>
      {pageTitle && <title>{pageTitle}</title>}
      {description && <meta name="description" content={description} />}
      {canonical && <link rel="canonical" href={canonical} />}

      <meta property="og:site_name" content={APP_NAME} />
      <meta property="og:type" content={type} />
      {title && <meta property="og:title" content={title} />}
      {description && <meta property="og:description" content={description} />}
      {canonical && <meta property="og:url" content={canonical} />}
      {ogImage && <meta property="og:image" content={ogImage} />}

      <meta name="twitter:card" content="summary_large_image" />
      {title && <meta name="twitter:title" content={title} />}
      {description && (
        <meta name="twitter:description" content={description} />
      )}
      {ogImage && <meta name="twitter:image" content={ogImage} />}

      {noIndex && <meta name="robots" content="noindex, nofollow" />}

      {children}
    </Helmet>
  );
}

export default Seo;
