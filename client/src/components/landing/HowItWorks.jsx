/**
 * `HowItWorks` — three-step explainer ("Pick a course → Learn → Earn a
 * certificate"). Sets expectations for first-time visitors so the
 * conversion path feels obvious before they hit the catalog.
 *
 * Each step is staggered into view via the shared landing-section
 * reveal pattern; the connecting dotted line on desktop turns the row
 * into a visual flow instead of three disconnected cards.
 */

import { motion } from 'framer-motion';

import { Icon } from '../ui/index.js';
import { Reveal } from '../layout/index.js';
import { stagger, staggerItem } from '../../utils/motion.js';

const STEPS = [
  {
    title: 'Pick a course',
    description:
      'Browse 800+ courses across programming, design, data and more — filter by level, length and price.',
    icon: 'Search',
  },
  {
    title: 'Learn at your pace',
    description:
      'Watch on-demand lessons, complete hands-on quizzes and track your progress across every device.',
    icon: 'PlayCircle',
  },
  {
    title: 'Earn a certificate',
    description:
      'Finish the course, pass the final quiz, and download a verifiable certificate to share with employers.',
    icon: 'Award',
  },
];

export function HowItWorks() {
  return (
    <section
      aria-labelledby="how-it-works-heading"
      className="mx-auto max-w-7xl px-6 py-16 lg:py-20"
    >
      <Reveal className="text-center max-w-2xl mx-auto mb-14">
        <p className="text-xs font-semibold uppercase tracking-wider text-primary">
          How it works
        </p>
        <h2
          id="how-it-works-heading"
          className="mt-3 text-2xl sm:text-3xl font-semibold tracking-tight text-text"
        >
          From curious to confident in three steps
        </h2>
      </Reveal>

      <motion.ol
        {...stagger(0.08)}
        initial="initial"
        whileInView="animate"
        viewport={{ once: true, margin: '-80px' }}
        className="relative grid gap-10 md:grid-cols-3 md:gap-8"
      >
        <div
          aria-hidden="true"
          className="hidden md:block absolute top-7 left-[16.6%] right-[16.6%]
            h-px border-t-2 border-dashed border-border-strong/60"
        />

        {STEPS.map((step, index) => (
          <motion.li
            key={step.title}
            variants={staggerItem}
            className="relative text-center md:text-left"
          >
            <div className="relative z-10 mx-auto md:mx-0 inline-flex h-14 w-14
              items-center justify-center rounded-2xl bg-bg border border-border-strong
              shadow-md text-primary">
              <Icon name={step.icon} size={24} />
              <span className="absolute -top-2 -right-2 inline-flex h-6 w-6
                items-center justify-center rounded-full bg-primary text-primary-fg
                text-xs font-semibold shadow-md">
                {index + 1}
              </span>
            </div>

            <h3 className="mt-5 text-lg font-semibold text-text">{step.title}</h3>
            <p className="mt-2 text-sm text-text-muted leading-relaxed">
              {step.description}
            </p>
          </motion.li>
        ))}
      </motion.ol>
    </section>
  );
}

export default HowItWorks;
