/**
 * `TestimonialGrid` — three social-proof quotes from placeholder learners.
 *
 * Static for v1. When real reviews ship later, swap the `TESTIMONIALS`
 * array for an API-backed list — the card markup is already shaped to
 * receive it.
 */

import { motion } from 'framer-motion';

import { Avatar, Icon } from '../ui/index.js';
import { Reveal } from '../layout/index.js';
import { stagger, staggerItem } from '../../utils/motion.js';

const TESTIMONIALS = [
  {
    name: 'Maya Patel',
    role: 'Front-end developer · Berlin',
    quote:
      'I tried four other platforms before Lumen. The hands-on quizzes are what finally made the lessons stick — I shipped my first portfolio site in three weeks.',
  },
  {
    name: 'Jordan Reyes',
    role: 'Career switcher · Toronto',
    quote:
      'The progress tracking kept me going on the days I almost quit. Earning the certificate genuinely felt like crossing a finish line.',
  },
  {
    name: 'Aiko Tanaka',
    role: 'Product designer · Tokyo',
    quote:
      'Course quality is a notch above anything else I have used. Instructors actually answer questions and the curriculum feels thoughtfully sequenced.',
  },
];

export function TestimonialGrid() {
  return (
    <section
      aria-labelledby="testimonials-heading"
      className="bg-bg-subtle border-y border-border"
    >
      <div className="mx-auto max-w-7xl px-6 py-16 lg:py-20">
        <Reveal className="text-center max-w-2xl mx-auto mb-12">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">
            Loved by learners
          </p>
          <h2
            id="testimonials-heading"
            className="mt-3 text-2xl sm:text-3xl font-semibold tracking-tight text-text"
          >
            People who finished, in their own words
          </h2>
        </Reveal>

        <motion.ul
          {...stagger(0.07)}
          initial="initial"
          whileInView="animate"
          viewport={{ once: true, margin: '-80px' }}
          className="grid gap-5 md:grid-cols-3"
        >
          {TESTIMONIALS.map((testimonial) => (
            <motion.li
              key={testimonial.name}
              variants={staggerItem}
              className="relative rounded-2xl border border-border bg-bg p-6 shadow-xs"
            >
              <Icon
                name="Quote"
                size={28}
                className="absolute top-5 right-5 text-primary/20"
              />

              <blockquote className="text-sm text-text leading-relaxed">
                &ldquo;{testimonial.quote}&rdquo;
              </blockquote>

              <div className="mt-5 flex items-center gap-3">
                <Avatar name={testimonial.name} size="md" />
                <div>
                  <p className="text-sm font-semibold text-text">
                    {testimonial.name}
                  </p>
                  <p className="text-xs text-text-subtle">{testimonial.role}</p>
                </div>
              </div>
            </motion.li>
          ))}
        </motion.ul>
      </div>
    </section>
  );
}

export default TestimonialGrid;
