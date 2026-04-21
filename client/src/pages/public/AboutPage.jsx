/**
 * `AboutPage` — `/about`.
 *
 * Brand / mission page linked from the footer. Stays purely static (no
 * data fetching) so it can render instantly and double as a high-trust
 * landing target from press, partnerships and email signatures.
 *
 * Layout: hero strip → mission → product pillars → team principles →
 * CTA back into the catalog. Composed from the same UI primitives used
 * by the marketing landing page so the visual language stays consistent.
 */

import { Link } from 'react-router-dom';

import { Seo } from '../../components/seo/index.js';
import { Button, Icon } from '../../components/ui/index.js';
import { ROUTES } from '../../utils/constants.js';

const PILLARS = [
  {
    icon: 'Sparkles',
    title: 'Project-based by default',
    body: 'Every course ends in something you can show: a deployed app, a working API, a portfolio piece. Lessons exist to unblock the project, not the other way around.',
  },
  {
    icon: 'ShieldCheck',
    title: 'Honest pricing & permanence',
    body: 'No bait-and-switch sales, no “lifetime access” asterisks. If a course is removed by an instructor, paid learners keep access for at least 12 months.',
  },
  {
    icon: 'Users',
    title: 'Community over content firehose',
    body: 'A small, active discussion forum and weekly cohort calls beat a library of 30,000 abandoned courses. We curate aggressively and keep the catalog focused.',
  },
  {
    icon: 'Award',
    title: 'Verifiable certificates',
    body: 'Every certificate carries a signed ID that can be checked against our public registry — so what you finished can\u2019t be faked, and what you didn\u2019t can\u2019t be claimed.',
  },
];

const PRINCIPLES = [
  {
    title: 'Accessibility is not an add-on.',
    body: 'WCAG 2.1 AA is the floor we ship to, not a stretch goal we promise for next quarter. Keyboard navigation, screen-reader labels and reduced-motion support are part of every PR.',
  },
  {
    title: 'Performance is a feature.',
    body: 'Pages load in under two seconds on a mid-range phone over 4G. We measure it, regress on it, and refuse to merge work that breaks it.',
  },
  {
    title: 'Privacy is the default.',
    body: 'No advertising trackers, no fingerprinting, no selling data. The only cookies we set are the ones the platform literally cannot run without.',
  },
  {
    title: 'Open by design.',
    body: 'Public roadmap, public changelog, public status page. Surprises belong in fiction, not in software your career depends on.',
  },
];

const STATS = [
  { value: '12,400+', label: 'Active learners' },
  { value: '180+', label: 'Published courses' },
  { value: '94%', label: 'Course-completion satisfaction' },
  { value: '24/7', label: 'Self-serve learning' },
];

export default function AboutPage() {
  return (
    <>
      <Seo
        title="About"
        description="Learn what Lumen LMS is, who builds it, and the mission behind the platform — practical, project-based learning for everyone."
        url="/about"
      />

      <div className="bg-bg">
        {/* Hero ------------------------------------------------------ */}
        <section className="relative isolate overflow-hidden border-b border-border">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 -z-10 bg-linear-to-br from-primary/10 via-transparent to-info/10"
          />
          <div className="mx-auto max-w-5xl px-6 py-20 sm:py-24">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              About Lumen LMS
            </p>
            <h1 className="mt-4 text-4xl font-semibold leading-tight tracking-tight text-text sm:text-5xl">
              Practical, project-based learning — built for the careers people
              actually want.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-text-muted">
              We started Lumen LMS because the gap between &ldquo;watched a
              tutorial&rdquo; and &ldquo;shipped something real&rdquo; was
              getting wider, not smaller. Our courses are short, opinionated
              and end with you having built the thing.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link to={ROUTES.catalog}>
                <Button size="lg" rightIcon={<Icon name="ArrowRight" size={18} />}>
                  Browse courses
                </Button>
              </Link>
              <Link to={ROUTES.teach}>
                <Button
                  size="lg"
                  variant="outline"
                  leftIcon={<Icon name="GraduationCap" size={18} />}
                >
                  Teach on Lumen
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* Stats ----------------------------------------------------- */}
        <section className="border-b border-border bg-bg-muted/40">
          <div className="mx-auto grid max-w-5xl grid-cols-2 gap-8 px-6 py-12 sm:grid-cols-4">
            {STATS.map((stat) => (
              <div key={stat.label}>
                <p className="text-3xl font-semibold tracking-tight text-text sm:text-4xl">
                  {stat.value}
                </p>
                <p className="mt-1 text-sm text-text-muted">{stat.label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Mission --------------------------------------------------- */}
        <section className="mx-auto max-w-3xl px-6 py-20">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-text-subtle">
            Our mission
          </p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-text sm:text-3xl">
            Make a high-quality skill upgrade accessible to anyone with an
            internet connection and an afternoon.
          </h2>
          <p className="mt-5 leading-relaxed text-text-muted">
            We don&apos;t believe in the &ldquo;course library you&apos;ll
            never finish&rdquo; model. Every Lumen course is small enough to
            complete in days, structured enough to build something real, and
            backed by a community of mentors who have shipped the work
            themselves.
          </p>
          <p className="mt-4 leading-relaxed text-text-muted">
            We&apos;re a small, distributed team of engineers, designers and
            educators who use the platform we build — for our own learning,
            for our own teams, and for the cohorts we run with friends.
          </p>
        </section>

        {/* Pillars --------------------------------------------------- */}
        <section className="border-y border-border bg-bg-muted/40">
          <div className="mx-auto max-w-5xl px-6 py-20">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-text-subtle">
              What makes Lumen different
            </p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-text sm:text-3xl">
              Four product pillars we won&apos;t compromise on.
            </h2>

            <ul className="mt-10 grid gap-6 sm:grid-cols-2">
              {PILLARS.map((pillar) => (
                <li
                  key={pillar.title}
                  className="rounded-xl border border-border bg-bg p-6"
                >
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon name={pillar.icon} size={20} />
                  </span>
                  <h3 className="mt-4 text-lg font-semibold text-text">
                    {pillar.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-text-muted">
                    {pillar.body}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Principles ------------------------------------------------ */}
        <section className="mx-auto max-w-3xl px-6 py-20">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-text-subtle">
            How we build
          </p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-text sm:text-3xl">
            Four principles you can hold us to.
          </h2>
          <ol className="mt-8 space-y-6">
            {PRINCIPLES.map((principle, index) => (
              <li key={principle.title} className="flex gap-4">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-sm font-semibold text-primary">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <div>
                  <h3 className="text-base font-semibold text-text">
                    {principle.title}
                  </h3>
                  <p className="mt-1 text-sm leading-relaxed text-text-muted">
                    {principle.body}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* CTA ------------------------------------------------------- */}
        <section className="border-t border-border bg-linear-to-br from-primary via-primary-hover to-info text-white">
          <div className="mx-auto max-w-3xl px-6 py-16 text-center">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Ready to build something this weekend?
            </h2>
            <p className="mt-3 leading-relaxed text-white/85">
              Browse the catalog, pick a course that ships in a single
              afternoon, and start where you are.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link to={ROUTES.catalog}>
                <Button
                  size="lg"
                  variant="secondary"
                  rightIcon={<Icon name="ArrowRight" size={18} />}
                >
                  Browse courses
                </Button>
              </Link>
              <Link to={ROUTES.register}>
                <Button
                  size="lg"
                  variant="ghost"
                  className="text-white hover:bg-white/10"
                >
                  Create a free account
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
