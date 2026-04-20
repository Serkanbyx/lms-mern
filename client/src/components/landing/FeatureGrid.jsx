/**
 * `FeatureGrid` — "Why learners choose us" section.
 *
 * Four equal tiles that reinforce the marketing pillars derived from the
 * product feature set: video lessons, auto-graded quizzes, progress
 * tracking, downloadable certificates. Each tile is intentionally short
 * (one icon + one headline + one line) so it scans during a quick scroll.
 */

import { motion } from 'framer-motion';

import { Icon } from '../ui/index.js';
import { Reveal } from '../layout/index.js';
import { stagger, staggerItem } from '../../utils/motion.js';

const FEATURES = [
  {
    icon: 'Video',
    title: 'HD video lessons',
    description: 'Crisp, professionally produced lessons that play smoothly on every device.',
    accent: 'text-primary bg-primary/10',
  },
  {
    icon: 'ClipboardCheck',
    title: 'Auto-graded quizzes',
    description: 'Reinforce what you learn with instant feedback after every section.',
    accent: 'text-info bg-info/10',
  },
  {
    icon: 'TrendingUp',
    title: 'Progress tracking',
    description: 'See exactly where you left off and how far you have come on every course.',
    accent: 'text-success bg-success/10',
  },
  {
    icon: 'Award',
    title: 'Verifiable certificates',
    description: 'Download a shareable certificate when you finish — perfect for LinkedIn.',
    accent: 'text-warning bg-warning/10',
  },
];

export function FeatureGrid() {
  return (
    <section
      aria-labelledby="features-heading"
      className="bg-bg-subtle border-y border-border"
    >
      <div className="mx-auto max-w-7xl px-6 py-16 lg:py-20">
        <Reveal className="max-w-2xl mb-12">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">
            Why Lumen
          </p>
          <h2
            id="features-heading"
            className="mt-3 text-2xl sm:text-3xl font-semibold tracking-tight text-text"
          >
            Built for learners who want to actually finish
          </h2>
          <p className="mt-3 text-text-muted">
            Every feature is designed around the moments where most online
            courses lose people — the gap between watching and doing.
          </p>
        </Reveal>

        <motion.ul
          {...stagger(0.05)}
          initial="initial"
          whileInView="animate"
          viewport={{ once: true, margin: '-80px' }}
          className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4"
        >
          {FEATURES.map((feature) => (
            <motion.li
              key={feature.title}
              variants={staggerItem}
              className="rounded-2xl border border-border bg-bg p-6 transition-all
                duration-200 hover:-translate-y-0.5 hover:shadow-md
                hover:border-border-strong"
            >
              <span
                className={`inline-flex h-11 w-11 items-center justify-center
                  rounded-xl ${feature.accent}`}
              >
                <Icon name={feature.icon} size={22} />
              </span>
              <h3 className="mt-4 text-base font-semibold text-text">
                {feature.title}
              </h3>
              <p className="mt-2 text-sm text-text-muted leading-relaxed">
                {feature.description}
              </p>
            </motion.li>
          ))}
        </motion.ul>
      </div>
    </section>
  );
}

export default FeatureGrid;
