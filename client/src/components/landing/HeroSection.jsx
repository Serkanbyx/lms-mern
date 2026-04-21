/**
 * `HeroSection` — above-the-fold marketing hero for `/`.
 *
 * Layout: two-column on desktop (copy left, decorative SVG right), stacked
 * on mobile so the headline + CTAs are always the first thing rendered.
 *
 * Polish:
 *  - Subtle radial gradient backdrop using the brand primary at low alpha.
 *  - Decorative SVG blob with `animate-float` keyframe; the keyframe is
 *    short-circuited by `prefers-reduced-motion` and the in-app
 *    "Reduce animations" toggle (see `index.css`).
 *  - The hero is the only place the floating animation is used, so it
 *    earns visual focus without competing with the rest of the page.
 *
 * A11y:
 *  - The decorative shape is `aria-hidden`.
 *  - CTAs are real anchors via `<Button as="a">` so keyboard / screen
 *    reader users get native link semantics (right-click "open in new
 *    tab", etc).
 */

import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

import { Button, Icon } from '../ui/index.js';
import { ROUTES } from '../../utils/constants.js';
import { durations, ease } from '../../utils/motion.js';
import { prefetchCatalog } from '../../utils/prefetch.js';

const HEADLINE = 'Master new skills, on your schedule.';
const SUBCOPY =
  'Project-based courses taught by working professionals — learn by building, not by memorising.';

const SOCIAL_PROOF = [
  { value: '12k+', label: 'active learners' },
  { value: '850+', label: 'expert-led courses' },
  { value: '4.8★', label: 'average rating' },
];

export function HeroSection() {
  return (
    <section
      aria-labelledby="hero-headline"
      className="relative overflow-hidden"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10
          bg-[radial-gradient(60%_50%_at_50%_0%,color-mix(in_oklab,var(--color-primary)_18%,transparent)_0%,transparent_70%)]"
      />

      <div className="mx-auto max-w-7xl px-6 pt-16 pb-20 lg:pt-24 lg:pb-28
        grid gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: durations.slow, ease }}
          className="max-w-2xl"
        >
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full
            border border-primary/20 bg-primary/10 text-primary text-xs font-medium">
            <Icon name="Sparkles" size={14} />
            New cohort starts every Monday
          </span>

          <h1
            id="hero-headline"
            className="mt-5 text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight text-text"
          >
            {HEADLINE}
          </h1>

          <p className="mt-5 text-lg text-text-muted leading-relaxed">
            {SUBCOPY}
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button
              as={Link}
              to={ROUTES.catalog}
              size="lg"
              rightIcon={<Icon name="ArrowRight" size={18} />}
              onMouseEnter={() => prefetchCatalog()}
              onFocus={() => prefetchCatalog()}
              onTouchStart={() => prefetchCatalog()}
            >
              Browse courses
            </Button>
            <Button
              as={Link}
              to={ROUTES.teach}
              size="lg"
              variant="outline"
            >
              Become an instructor
            </Button>
          </div>

          <dl className="mt-10 grid grid-cols-3 gap-6 max-w-md">
            {SOCIAL_PROOF.map((item) => (
              <div key={item.label}>
                <dt className="text-2xl font-semibold text-text">
                  {item.value}
                </dt>
                <dd className="text-xs text-text-subtle mt-1">{item.label}</dd>
              </div>
            ))}
          </dl>
        </motion.div>

        <HeroDecoration />
      </div>
    </section>
  );
}

const HeroDecoration = () => (
  <motion.div
    initial={{ opacity: 0, scale: 0.96 }}
    animate={{ opacity: 1, scale: 1 }}
    transition={{ duration: durations.slow, ease, delay: 0.1 }}
    aria-hidden="true"
    className="relative hidden lg:flex items-center justify-center min-h-[420px]"
  >
    <div
      className="absolute -top-10 -right-10 h-72 w-72 rounded-full
        bg-primary/30 blur-3xl animate-blob"
    />
    <div
      className="absolute bottom-0 -left-6 h-56 w-56 rounded-full
        bg-info/20 blur-3xl animate-blob"
      style={{ animationDelay: '-4s' }}
    />

    <div className="relative w-full max-w-md aspect-4/5 animate-float">
      <div className="absolute inset-0 rounded-3xl border border-border bg-bg-subtle/80
        backdrop-blur-sm shadow-lg overflow-hidden">
        <div className="h-1.5 bg-linear-to-r from-primary via-info to-primary" />

        <div className="p-6 space-y-5">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/15 text-primary
              flex items-center justify-center">
              <Icon name="GraduationCap" size={20} />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-text">
                Modern React Patterns
              </p>
              <p className="text-xs text-text-subtle">12 lessons · 3h 40m</p>
            </div>
            <span className="text-xs font-medium text-success">+ 3 today</span>
          </div>

          <div>
            <div className="flex items-center justify-between text-xs text-text-muted mb-1.5">
              <span>Course progress</span>
              <span className="font-medium text-text">68%</span>
            </div>
            <div className="h-2 rounded-full bg-bg-muted overflow-hidden">
              <div className="h-full w-[68%] rounded-full bg-linear-to-r from-primary to-info" />
            </div>
          </div>

          <ul className="space-y-2.5">
            {[
              { icon: 'CheckCircle2', label: 'Hooks & composition', done: true },
              { icon: 'CheckCircle2', label: 'Suspense in practice', done: true },
              { icon: 'PlayCircle', label: 'Server components', done: false },
              { icon: 'Lock', label: 'Project capstone', done: false },
            ].map((row) => (
              <li key={row.label} className="flex items-center gap-3 text-sm">
                <Icon
                  name={row.icon}
                  size={18}
                  className={row.done ? 'text-success' : 'text-text-subtle'}
                />
                <span className={row.done ? 'text-text' : 'text-text-muted'}>
                  {row.label}
                </span>
              </li>
            ))}
          </ul>

          <div className="flex items-center gap-2 pt-3 border-t border-border">
            <div className="flex -space-x-2">
              {['#6366f1', '#0ea5e9', '#16a34a'].map((color) => (
                <span
                  key={color}
                  className="h-7 w-7 rounded-full border-2 border-bg-subtle"
                  style={{ background: color }}
                />
              ))}
            </div>
            <span className="text-xs text-text-subtle">
              + 2,430 learners enrolled this week
            </span>
          </div>
        </div>
      </div>
    </div>
  </motion.div>
);

export default HeroSection;
