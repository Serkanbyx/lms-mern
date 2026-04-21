/**
 * `NotFoundPage` — catch-all 404 page (final route in `App.jsx`).
 *
 * Designed as a true dead-end recovery surface rather than a generic
 * empty state:
 *   - Oversized "404" headline acts as a visual anchor so the user
 *     immediately recognises the situation, even with images blocked.
 *   - A short, plain-language explanation (no stack-trace jargon).
 *   - Two equal-weight CTAs that cover both intents: get back to known
 *     ground (`Back to home`) or pivot to discovery (`Browse courses`).
 *   - A subtle illustrative compass mark in the background — purely
 *     decorative, marked `aria-hidden`, never the carrier of meaning.
 *
 * SEO: Marked `noIndex` so crawlers never persist 404 URLs in their
 * index. The SPA shell technically returns a 200 status, so `noIndex`
 * is the only signal we can give them here.
 *
 * A11y: The page uses a single `<h1>` for the page title (the "404"
 * eyebrow is decorative copy), the buttons are real `<a>`/`<button>`
 * elements via `Link` + `Button`, and the illustration is hidden from
 * assistive tech.
 */

import { Link } from 'react-router-dom';

import { Seo } from '../../components/seo/index.js';
import { Button, Icon } from '../../components/ui/index.js';
import { ROUTES } from '../../utils/constants.js';

export default function NotFoundPage() {
  return (
    <main className="relative isolate flex min-h-[calc(100vh-12rem)] items-center justify-center overflow-hidden px-6 py-20">
      <Seo title="Page not found" noIndex />

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 flex items-center justify-center"
      >
        <div className="h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-xl text-center">
        <div
          aria-hidden="true"
          className="mx-auto mb-8 inline-flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10 text-primary"
        >
          <Icon name="Compass" size={40} />
        </div>

        <p
          aria-hidden="true"
          className="select-none bg-linear-to-b from-text to-text-muted bg-clip-text text-7xl font-black leading-none tracking-tighter text-transparent sm:text-8xl"
        >
          404
        </p>

        <h1 className="mt-6 text-2xl font-semibold text-text sm:text-3xl">
          Page not found
        </h1>

        <p className="mx-auto mt-3 max-w-md text-sm text-text-muted sm:text-base">
          The page you were looking for doesn&apos;t exist, was moved, or the
          link is broken. Let&apos;s get you back on track.
        </p>

        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          {/* Render the buttons AS the link so we end up with a single
              <a role="button"> instead of nesting <button> inside <a>.
              Nested interactive elements break keyboard navigation
              (one tab stop per element, focus rings stack) and most
              screen readers announce them twice. */}
          <Button
            as={Link}
            to={ROUTES.home}
            size="lg"
            leftIcon={<Icon name="Home" size={18} />}
            className="w-full sm:w-auto"
          >
            Back to home
          </Button>
          <Button
            as={Link}
            to={ROUTES.catalog}
            size="lg"
            variant="outline"
            leftIcon={<Icon name="BookOpen" size={18} />}
            className="w-full sm:w-auto"
          >
            Browse courses
          </Button>
        </div>

        <p className="mt-10 text-xs text-text-subtle">
          Think this is a mistake?{' '}
          {/* Plain `<a>` (not <Link>) on purpose: this resolves to a
              `mailto:` URL and `react-router-dom` would log a noisy
              relative-path warning if it tried to treat it as an
              in-app route. The same address is exposed in the footer's
              "Contact" link so the support inbox stays consistent. */}
          <a
            href="mailto:hello@lumen.lms?subject=Broken%20link%20on%20Lumen%20LMS"
            className="font-medium text-primary hover:underline underline-offset-4"
          >
            Let us know
          </a>
          .
        </p>
      </div>
    </main>
  );
}
