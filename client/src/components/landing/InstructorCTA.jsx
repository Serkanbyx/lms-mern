/**
 * `InstructorCTA` — split section that recruits new instructors.
 *
 * Left column shows a stylised "earnings dashboard" mock built entirely
 * from theme tokens (no PNGs to download / brand-mismatch later); right
 * column carries the value proposition + a primary CTA pointing at the
 * `/teach` flow.
 *
 * The bullet list mirrors the instructor onboarding promises so the
 * landing page never overpromises versus the actual `/teach` page.
 */

import { Link } from 'react-router-dom';

import { Button, Icon } from '../ui/index.js';
import { Reveal } from '../layout/index.js';
import { ROUTES } from '../../utils/constants.js';

const BENEFITS = [
  'Reach a global audience of motivated learners.',
  'Built-in tools for curriculum, video and quizzes.',
  'Transparent revenue share with monthly payouts.',
  'Dedicated support from our instructor success team.',
];

export function InstructorCTA() {
  return (
    <section
      aria-labelledby="instructor-cta-heading"
      className="mx-auto max-w-7xl px-6 py-16 lg:py-20"
    >
      <Reveal className="grid gap-10 lg:grid-cols-2 lg:items-center">
        <DashboardMock />

        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">
            For instructors
          </p>
          <h2
            id="instructor-cta-heading"
            className="mt-3 text-2xl sm:text-3xl font-semibold tracking-tight text-text"
          >
            Teach what you love. Earn while you do it.
          </h2>
          <p className="mt-4 text-text-muted">
            Whether you teach React, watercolor or accounting — we give you the
            stage and the toolkit. You bring the craft.
          </p>

          <ul className="mt-6 space-y-3">
            {BENEFITS.map((benefit) => (
              <li key={benefit} className="flex items-start gap-3 text-sm text-text">
                <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center
                  rounded-full bg-success/15 text-success shrink-0">
                  <Icon name="Check" size={14} />
                </span>
                {benefit}
              </li>
            ))}
          </ul>

          <div className="mt-8">
            <Button
              as={Link}
              to={ROUTES.teach}
              size="lg"
              rightIcon={<Icon name="ArrowRight" size={18} />}
            >
              Start teaching
            </Button>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

const DashboardMock = () => (
  <div
    aria-hidden="true"
    className="relative rounded-3xl border border-border bg-bg-subtle p-6 shadow-md
      overflow-hidden"
  >
    <div
      className="pointer-events-none absolute -top-16 -right-16 h-56 w-56 rounded-full
        bg-primary/20 blur-3xl"
    />

    <div className="flex items-center justify-between mb-6 relative">
      <div>
        <p className="text-xs text-text-subtle">Lifetime earnings</p>
        <p className="text-3xl font-semibold text-text mt-1">$48,720</p>
      </div>
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full
        bg-success/15 text-success text-xs font-medium">
        <Icon name="TrendingUp" size={12} />
        +18.4%
      </span>
    </div>

    <div className="relative h-32">
      <svg viewBox="0 0 320 120" className="h-full w-full">
        <defs>
          <linearGradient id="earningsFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          d="M0,90 L40,72 L80,80 L120,55 L160,62 L200,38 L240,46 L280,22 L320,30 L320,120 L0,120 Z"
          fill="url(#earningsFill)"
        />
        <path
          d="M0,90 L40,72 L80,80 L120,55 L160,62 L200,38 L240,46 L280,22 L320,30"
          stroke="var(--color-primary)"
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>

    <ul className="mt-6 space-y-3 relative">
      {[
        { title: 'Modern React Patterns', delta: '+ $1,240', sub: '32 new students' },
        { title: 'Design Systems 101', delta: '+ $860', sub: '21 new students' },
        { title: 'TypeScript in Practice', delta: '+ $510', sub: '14 new students' },
      ].map((row) => (
        <li
          key={row.title}
          className="flex items-center gap-3 rounded-xl bg-bg border border-border px-3 py-2.5"
        >
          <span className="h-9 w-9 rounded-lg bg-primary/15 text-primary
            flex items-center justify-center">
            <Icon name="BookOpen" size={16} />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-text truncate">{row.title}</p>
            <p className="text-xs text-text-subtle">{row.sub}</p>
          </div>
          <span className="text-sm font-semibold text-success">{row.delta}</span>
        </li>
      ))}
    </ul>
  </div>
);

export default InstructorCTA;
