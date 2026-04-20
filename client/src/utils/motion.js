/**
 * Shared Framer Motion vocabulary used across the app.
 *
 * One small, opinionated set of variants — never hand-roll a transition
 * inline in a component. If a new pattern is needed, add it here so motion
 * remains coherent, performant, and auditable.
 *
 * Conventions
 * -----------
 *  - Durations are kept short (≤ 320ms) so motion never blocks interaction.
 *  - Easings live in `easings` and follow Material's "emphasized" curve as
 *    a default — the same curve is exported as `ease` for ergonomic use in
 *    one-off transitions.
 *  - All variants are plain objects (not functions) so they can be passed
 *    directly to `motion.*` props as `initial`, `animate`, `exit`.
 *  - `prefers-reduced-motion` is honoured globally by `<MotionProvider />`
 *    via `MotionConfig reducedMotion="user"`, so individual call sites do
 *    not need to gate themselves.
 */

export const easings = {
  emphasized: [0.2, 0.8, 0.2, 1],
  standard: [0.4, 0, 0.2, 1],
  decelerate: [0, 0, 0.2, 1],
  accelerate: [0.4, 0, 1, 1],
};

export const ease = easings.emphasized;

export const durations = {
  instant: 0.12,
  fast: 0.18,
  base: 0.22,
  slow: 0.32,
};

export const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: durations.fast, ease },
};

export const fadeUp = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: durations.base, ease },
};

export const fadeDown = {
  initial: { opacity: 0, y: -8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: 8 },
  transition: { duration: durations.base, ease },
};

export const scaleIn = {
  initial: { opacity: 0, scale: 0.96 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.96 },
  transition: { duration: durations.fast, ease },
};

export const popIn = {
  initial: { opacity: 0, scale: 0.92, y: 4 },
  animate: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.96, y: 4 },
  transition: { duration: durations.base, ease },
};

export const slideInRight = {
  initial: { x: '100%' },
  animate: { x: 0 },
  exit: { x: '100%' },
  transition: { duration: durations.base, ease },
};

export const slideInLeft = {
  initial: { x: '-100%' },
  animate: { x: 0 },
  exit: { x: '-100%' },
  transition: { duration: durations.base, ease },
};

export const slideInBottom = {
  initial: { y: '100%' },
  animate: { y: 0 },
  exit: { y: '100%' },
  transition: { duration: durations.base, ease },
};

/**
 * Container variants that orchestrate child entrance animations.
 * Use together with one of the *Item* variants below on direct children.
 */
export const stagger = (delay = 0.05, delayChildren = 0) => ({
  initial: {},
  animate: {
    transition: { staggerChildren: delay, delayChildren },
  },
  exit: {
    transition: { staggerChildren: delay / 2, staggerDirection: -1 },
  },
});

export const staggerItem = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: { duration: durations.base, ease } },
  exit: { opacity: 0, y: -8, transition: { duration: durations.fast, ease } },
};

/**
 * Tap / hover presets for interactive surfaces. Apply via:
 *   <motion.button {...press}>...</motion.button>
 */
export const press = {
  whileTap: { scale: 0.98 },
  transition: { duration: durations.instant, ease },
};

export const hoverLift = {
  whileHover: { y: -2 },
  transition: { duration: durations.base, ease },
};

/**
 * Viewport reveal preset for scroll-triggered animations on landing
 * sections. Keep `once: true` so the effect doesn't re-fire on scroll-up.
 */
export const revealOnView = {
  initial: { opacity: 0, y: 16 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-80px' },
  transition: { duration: durations.slow, ease },
};

/**
 * `tween` produces a width/height/opacity tween with the standard ease —
 * handy for progress bars, accordion height, etc.
 */
export const tween = (duration = durations.base) => ({
  type: 'tween',
  ease,
  duration,
});

export default {
  easings,
  ease,
  durations,
  fadeIn,
  fadeUp,
  fadeDown,
  scaleIn,
  popIn,
  slideInRight,
  slideInLeft,
  slideInBottom,
  stagger,
  staggerItem,
  press,
  hoverLift,
  revealOnView,
  tween,
};
