/**
 * `BecomeInstructorPage` — `/teach`.
 *
 * Marketing pitch for prospective instructors. Surfaces the value
 * proposition (revenue share, audience, support), explains the
 * application flow, and CTAs into either the application form (when
 * one ships) or the existing register flow as a sensible fallback.
 *
 * Static, no data fetching — designed to be SEO-indexable and link-
 * shareable on social. Visual language mirrors the landing page so a
 * visitor arriving from the navbar feels at home.
 */

import { Link } from 'react-router-dom';

import { Seo } from '../../components/seo/index.js';
import { Button, Icon } from '../../components/ui/index.js';
import { useAuth } from '../../context/useAuth.js';
import { ROUTES } from '../../utils/constants.js';

const VALUE_PROPS = [
  {
    icon: 'CircleDollarSign',
    title: 'Keep most of what you earn',
    body: 'Instructors take home up to 85% of net revenue from their courses. Payouts go out twice a month with itemised statements.',
  },
  {
    icon: 'Users',
    title: 'Reach motivated learners',
    body: 'A curated catalog means your course is discovered by people actively looking for it — not buried under 30,000 lookalikes.',
  },
  {
    icon: 'Sparkles',
    title: 'Production tooling, not paperwork',
    body: 'Drag-and-drop curriculum builder, video uploads with adaptive streaming, quiz authoring, certificates, and analytics — all in the box.',
  },
  {
    icon: 'LifeBuoy',
    title: 'Editor support before launch',
    body: 'Every course goes through a friendly review with our learning team — outline feedback, lesson length suggestions, and a final QA pass before it ships.',
  },
];

const STEPS = [
  {
    title: 'Pitch your course idea',
    body: 'Tell us what you want to teach, who it\u2019s for and what learners will build by the end. We respond within five business days with feedback or an invitation to apply.',
  },
  {
    title: 'Build with our toolkit',
    body: 'Use the curriculum builder to outline modules, upload your videos and attach resources. Draft as long as you need — nothing goes live until you publish.',
  },
  {
    title: 'Review & launch',
    body: 'Submit for editorial review. We give you actionable notes within seven days, and once you\u2019re ready, we coordinate the launch announcement to relevant cohorts.',
  },
  {
    title: 'Earn, iterate, grow',
    body: 'Track enrollments, completion and earnings in your dashboard. Update lessons as the field evolves — learners keep up to date automatically.',
  },
];

const FAQ = [
  {
    q: 'Do I need to be a professional educator?',
    a: 'No. Most of our top instructors are practitioners — engineers, designers, founders — teaching the things they ship at work. Our editorial team helps with pacing and structure so you can focus on substance.',
  },
  {
    q: 'What kind of courses perform best?',
    a: 'Project-based courses that end with a tangible deliverable (a deployed app, a portfolio piece, a working API) consistently outperform open-ended content libraries. Aim for 2 to 6 hours of focused video — most of our top sellers sit in that range.',
  },
  {
    q: 'How do payouts work?',
    a: 'You configure a payout method in instructor settings (Stripe Connect today, with PayPal coming soon). We pay out the 1st and 16th of each month, with a transparent statement covering enrollments, refunds and platform fees.',
  },
  {
    q: 'What about exclusivity?',
    a: 'Lumen LMS does not require exclusivity. You can publish the same content elsewhere; we just ask that you keep the Lumen edition feature-complete (no deliberately watered-down versions).',
  },
];

export default function BecomeInstructorPage() {
  const { isAuthenticated, isInstructor, isAdmin } = useAuth();
  const ctaTarget = isAuthenticated
    ? isInstructor || isAdmin
      ? ROUTES.instructor
      : ROUTES.dashboard
    : `${ROUTES.register}?next=${encodeURIComponent(ROUTES.teach)}`;
  const ctaLabel = isAuthenticated
    ? isInstructor || isAdmin
      ? 'Open instructor dashboard'
      : 'Apply from your dashboard'
    : 'Apply to teach';

  return (
    <>
      <Seo
        title="Teach on Lumen LMS"
        description="Share your expertise, reach motivated learners worldwide and earn from your courses. Join the Lumen LMS instructor program."
        url="/teach"
      />

      <div className="bg-bg">
        {/* Hero ------------------------------------------------------ */}
        <section className="relative isolate overflow-hidden border-b border-border">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 -z-10 bg-linear-to-br from-primary/15 via-transparent to-info/10"
          />
          <div className="mx-auto max-w-5xl px-6 py-20 sm:py-28">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              Teach on Lumen LMS
            </p>
            <h1 className="mt-4 text-4xl font-semibold leading-tight tracking-tight text-text sm:text-5xl">
              Turn what you ship into a course thousands of learners actually
              finish.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-text-muted">
              Lumen instructors keep up to 85% of revenue, get editorial
              support, and ship to a curated audience that&apos;s actively
              looking for what they&apos;re teaching.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link to={ctaTarget}>
                <Button size="lg" rightIcon={<Icon name="ArrowRight" size={18} />}>
                  {ctaLabel}
                </Button>
              </Link>
              <a href="#how-it-works">
                <Button
                  size="lg"
                  variant="outline"
                  leftIcon={<Icon name="Workflow" size={18} />}
                >
                  See how it works
                </Button>
              </a>
            </div>
          </div>
        </section>

        {/* Value props ----------------------------------------------- */}
        <section className="border-b border-border">
          <div className="mx-auto max-w-5xl px-6 py-20">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-text-subtle">
              Why teach with us
            </p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-text sm:text-3xl">
              Built for instructors who want to ship — not wrangle a CMS.
            </h2>

            <ul className="mt-10 grid gap-6 sm:grid-cols-2">
              {VALUE_PROPS.map((item) => (
                <li
                  key={item.title}
                  className="rounded-xl border border-border bg-bg p-6"
                >
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon name={item.icon} size={20} />
                  </span>
                  <h3 className="mt-4 text-lg font-semibold text-text">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-text-muted">
                    {item.body}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Steps ----------------------------------------------------- */}
        <section
          id="how-it-works"
          className="scroll-mt-24 border-b border-border bg-bg-muted/40"
        >
          <div className="mx-auto max-w-3xl px-6 py-20">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-text-subtle">
              How it works
            </p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-text sm:text-3xl">
              From pitch to first payout in four steps.
            </h2>

            <ol className="mt-10 space-y-6">
              {STEPS.map((step, index) => (
                <li
                  key={step.title}
                  className="relative rounded-xl border border-border bg-bg p-6"
                >
                  <span className="absolute -top-3 left-6 inline-flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-fg shadow">
                    {index + 1}
                  </span>
                  <h3 className="text-lg font-semibold text-text">
                    {step.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-text-muted">
                    {step.body}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Earnings hint --------------------------------------------- */}
        <section className="border-b border-border">
          <div className="mx-auto grid max-w-5xl items-center gap-10 px-6 py-20 lg:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-text-subtle">
                Earnings, plain and simple
              </p>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight text-text sm:text-3xl">
                You keep up to 85% of net revenue.
              </h2>
              <p className="mt-4 leading-relaxed text-text-muted">
                Net revenue is what reaches your account after payment-
                processor fees and applicable taxes. Lumen takes a flat 15%
                platform share — no opaque promotional discounts that quietly
                eat into your cut.
              </p>
              <ul className="mt-6 space-y-3 text-sm text-text-muted">
                <li className="flex items-start gap-2.5">
                  <Icon name="Check" size={16} className="mt-0.5 text-success" />
                  Twice-monthly payouts via Stripe Connect
                </li>
                <li className="flex items-start gap-2.5">
                  <Icon name="Check" size={16} className="mt-0.5 text-success" />
                  Itemised statements with refunds &amp; chargebacks broken out
                </li>
                <li className="flex items-start gap-2.5">
                  <Icon name="Check" size={16} className="mt-0.5 text-success" />
                  No cross-promotion clauses or forced discounts
                </li>
              </ul>
            </div>

            <div className="rounded-2xl border border-border bg-bg-muted/40 p-8">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-text-subtle">
                Sample monthly payout
              </p>
              <dl className="mt-6 space-y-3 text-sm">
                <div className="flex justify-between border-b border-border pb-3">
                  <dt className="text-text-muted">Enrollments (120 × $29)</dt>
                  <dd className="font-medium text-text">$3,480</dd>
                </div>
                <div className="flex justify-between border-b border-border pb-3">
                  <dt className="text-text-muted">Refunds (3)</dt>
                  <dd className="font-medium text-text">- $87</dd>
                </div>
                <div className="flex justify-between border-b border-border pb-3">
                  <dt className="text-text-muted">Processor fees</dt>
                  <dd className="font-medium text-text">- $108</dd>
                </div>
                <div className="flex justify-between border-b border-border pb-3">
                  <dt className="text-text-muted">Platform fee (15%)</dt>
                  <dd className="font-medium text-text">- $493</dd>
                </div>
                <div className="flex justify-between pt-2 text-base">
                  <dt className="font-semibold text-text">You receive</dt>
                  <dd className="font-semibold text-success">$2,792</dd>
                </div>
              </dl>
              <p className="mt-4 text-xs text-text-subtle">
                Illustrative only — your numbers depend on price, volume and
                applicable taxes.
              </p>
            </div>
          </div>
        </section>

        {/* FAQ ------------------------------------------------------- */}
        <section className="border-b border-border bg-bg-muted/40">
          <div className="mx-auto max-w-3xl px-6 py-20">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-text-subtle">
              Frequently asked
            </p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-text sm:text-3xl">
              The questions instructors ask before applying.
            </h2>

            <dl className="mt-10 space-y-6">
              {FAQ.map((item) => (
                <div
                  key={item.q}
                  className="rounded-xl border border-border bg-bg p-6"
                >
                  <dt className="text-base font-semibold text-text">
                    {item.q}
                  </dt>
                  <dd className="mt-2 text-sm leading-relaxed text-text-muted">
                    {item.a}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* CTA ------------------------------------------------------- */}
        <section className="bg-linear-to-br from-primary via-primary-hover to-info text-white">
          <div className="mx-auto max-w-3xl px-6 py-16 text-center">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Ready to teach what you ship?
            </h2>
            <p className="mt-3 leading-relaxed text-white/85">
              The application takes about ten minutes. We respond within
              five business days.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link to={ctaTarget}>
                <Button
                  size="lg"
                  variant="secondary"
                  rightIcon={<Icon name="ArrowRight" size={18} />}
                >
                  {ctaLabel}
                </Button>
              </Link>
              <a href="mailto:hello@lumen.lms?subject=Instructor%20application">
                <Button
                  size="lg"
                  variant="ghost"
                  className="text-white hover:bg-white/10"
                  leftIcon={<Icon name="Mail" size={18} />}
                >
                  Email the team
                </Button>
              </a>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
