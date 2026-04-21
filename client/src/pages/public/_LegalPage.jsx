/**
 * `LegalPage` — shared chrome for static legal/policy pages
 * (`/terms`, `/privacy`).
 *
 * Pulls together a centred prose container with consistent typography,
 * a "last updated" stamp and an in-page Table of Contents that mirrors
 * the section anchors. We keep all of this in one place so the Terms
 * page and Privacy page stay visually identical — when policy copy
 * changes, the surrounding shell never needs to be touched twice.
 *
 * The actual policy copy lives in the calling page as a `sections`
 * array (`{ id, title, body }`). Body accepts plain strings, arrays of
 * strings (rendered as paragraphs) or ready-made JSX so the caller can
 * compose lists, links and emphasis without having to import its own
 * layout primitives.
 */

import { Link } from 'react-router-dom';

import { Icon } from '../../components/ui/index.js';

const formatDate = (value) =>
  new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(value));

const renderBody = (body) => {
  if (Array.isArray(body)) {
    return body.map((paragraph, index) => (
      <p key={index} className="mt-3 first:mt-0 leading-relaxed text-text-muted">
        {paragraph}
      </p>
    ));
  }
  if (typeof body === 'string') {
    return <p className="leading-relaxed text-text-muted">{body}</p>;
  }
  return body;
};

export function LegalPage({
  title,
  subtitle,
  effectiveDate,
  intro,
  sections = [],
  contactEmail = 'hello@lumen.lms',
}) {
  return (
    <div className="bg-bg">
      <div className="mx-auto max-w-3xl px-6 py-16 sm:py-20">
        <header className="mb-10 border-b border-border pb-8">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-text-subtle">
            Lumen LMS · Legal
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-text sm:text-4xl">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-3 max-w-2xl text-base leading-relaxed text-text-muted">
              {subtitle}
            </p>
          )}
          {effectiveDate && (
            <p className="mt-5 inline-flex items-center gap-2 rounded-full border border-border bg-bg-muted px-3 py-1 text-xs text-text-subtle">
              <Icon name="Calendar" size={14} />
              Last updated {formatDate(effectiveDate)}
            </p>
          )}
        </header>

        {intro && (
          <div className="mb-10 rounded-xl border border-border bg-bg-muted/40 p-5 text-sm leading-relaxed text-text-muted">
            {intro}
          </div>
        )}

        {sections.length > 0 && (
          <nav
            aria-label="On this page"
            className="mb-12 rounded-xl border border-border bg-bg p-5"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-text-subtle">
              On this page
            </p>
            <ol className="mt-3 space-y-1.5 text-sm">
              {sections.map((section, index) => (
                <li key={section.id} className="flex items-start gap-2">
                  <span className="text-text-subtle tabular-nums">
                    {String(index + 1).padStart(2, '0')}.
                  </span>
                  <a
                    href={`#${section.id}`}
                    className="text-primary hover:underline underline-offset-4"
                  >
                    {section.title}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        )}

        <article className="prose-like space-y-12">
          {sections.map((section, index) => (
            <section
              key={section.id}
              id={section.id}
              className="scroll-mt-24"
            >
              <h2 className="text-xl font-semibold text-text sm:text-2xl">
                <span className="mr-2 text-text-subtle tabular-nums">
                  {String(index + 1).padStart(2, '0')}.
                </span>
                {section.title}
              </h2>
              <div className="mt-4 space-y-3">{renderBody(section.body)}</div>
            </section>
          ))}
        </article>

        <footer className="mt-16 rounded-xl border border-border bg-bg-muted/40 p-6 text-sm text-text-muted">
          <p className="font-medium text-text">Questions about this policy?</p>
          <p className="mt-2 leading-relaxed">
            Reach the team at{' '}
            <a
              href={`mailto:${contactEmail}`}
              className="font-medium text-primary hover:underline underline-offset-4"
            >
              {contactEmail}
            </a>
            . You can also browse the{' '}
            <Link
              to="/about"
              className="font-medium text-primary hover:underline underline-offset-4"
            >
              About page
            </Link>{' '}
            for context on who maintains the platform.
          </p>
        </footer>
      </div>
    </div>
  );
}

export default LegalPage;
