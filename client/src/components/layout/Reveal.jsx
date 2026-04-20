/**
 * `Reveal` — scroll-triggered fade-up wrapper for landing-page sections.
 *
 * Built on Framer Motion's `whileInView`, which uses an internal
 * `IntersectionObserver` to fire the animation the first time the
 * element enters the viewport (margin offset by 80px so the reveal
 * happens slightly before the section is fully visible).
 *
 * Defaults match the shared `revealOnView` variant in `utils/motion.js`
 * but every parameter is overridable so callers can stagger or delay
 * specific blocks (e.g. each feature card in a grid).
 *
 * Reduced motion: handled globally by `<MotionProvider />` — the variant
 * is automatically replaced with an instant snap, so no opt-out logic is
 * needed here.
 *
 * Usage:
 *   <Reveal as="section" delay={0.1}>...</Reveal>
 *   <Reveal y={32} once={false}>...</Reveal>
 */

import { motion } from 'framer-motion';
import { durations, ease } from '../../utils/motion.js';

export function Reveal({
  as = 'div',
  children,
  delay = 0,
  duration = durations.slow,
  y = 16,
  once = true,
  margin = '-80px',
  className,
  ...rest
}) {
  const Component = motion[as] ?? motion.div;

  return (
    <Component
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once, margin }}
      transition={{ duration, ease, delay }}
      className={className}
      {...rest}
    >
      {children}
    </Component>
  );
}

export default Reveal;
