/**
 * `PageTransition` — animated wrapper for the routed `<Outlet />`.
 *
 * Mounted once inside each layout (`MainLayout`, `AdminLayout`, …) around
 * the router outlet:
 *
 *   <main id="main">
 *     <PageTransition>
 *       <Outlet />
 *     </PageTransition>
 *   </main>
 *
 * Behaviour:
 *   - `AnimatePresence mode="wait"` keyed on `location.pathname` ensures
 *     the leaving page finishes its exit before the next enters — no
 *     overlapping animations, no layout jank.
 *   - Uses the shared `fadeUp` variant from `utils/motion.js` so every
 *     page transition feels identical regardless of layout.
 *   - `MotionConfig reducedMotion="user"` (mounted by `MotionProvider`)
 *     converts the variant to instant for users who opted out.
 *
 * Children are wrapped in a `motion.div` (not Fragment) because
 * `AnimatePresence` requires a single direct child with a stable `key`.
 */

import { AnimatePresence, motion } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import { fadeUp } from '../../utils/motion.js';

export function PageTransition({ children }) {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location.pathname}
        initial={fadeUp.initial}
        animate={fadeUp.animate}
        exit={fadeUp.exit}
        transition={fadeUp.transition}
        className="min-h-full"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

export default PageTransition;
