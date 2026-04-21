/**
 * `CoursesGrid` — render-state machine for the catalog grid.
 *
 * Owns the four UI states the catalog cycles through:
 *   - `loading` → 8 skeleton cards (no layout shift when data lands)
 *   - `error`   → inline `Alert` with a retry CTA; layout stays intact
 *   - `empty`   → `EmptyState` with reset CTA
 *   - `ready`   → animated grid of `CourseCard`s
 *
 * The component is presentational; the page above owns fetching,
 * pagination and URL state. Items appear with a staggered reveal so
 * the grid feels alive without distracting from the content (motion
 * gated globally via `MotionProvider`).
 */

import { motion } from 'framer-motion';

import { Alert, Button, EmptyState, Icon } from '../ui/index.js';
import { stagger, staggerItem } from '../../utils/motion.js';
import { CourseCard } from './CourseCard.jsx';
import { CourseCardSkeleton } from './CourseCardSkeleton.jsx';
import { cn } from '../../utils/cn.js';

const SKELETON_COUNT = 8;

const GRID_CLASSES =
  'grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4';

export function CoursesGrid({
  status,
  items,
  error,
  onRetry,
  onResetFilters,
  className,
}) {
  if (status === 'loading') {
    return (
      <ul className={cn(GRID_CLASSES, className)} aria-busy="true">
        {Array.from({ length: SKELETON_COUNT }).map((_, index) => (
          <li key={index}>
            <CourseCardSkeleton />
          </li>
        ))}
      </ul>
    );
  }

  if (status === 'error') {
    return (
      <div className={cn('space-y-4', className)}>
        <Alert variant="danger" title="Couldn't load courses">
          {error ?? 'Please check your connection and try again.'}
        </Alert>
        {onRetry && (
          <Button
            size="sm"
            variant="outline"
            onClick={onRetry}
            leftIcon={<Icon name="RotateCcw" size={14} />}
          >
            Try again
          </Button>
        )}
      </div>
    );
  }

  if (status === 'ready' && items.length === 0) {
    return (
      <EmptyState
        icon="SearchX"
        title="No courses match your filters"
        description="Try removing a filter or two — there's a lot waiting to be discovered."
        action={
          onResetFilters ? (
            <Button onClick={onResetFilters} leftIcon={<Icon name="RotateCcw" size={14} />}>
              Reset filters
            </Button>
          ) : null
        }
        className={className}
      />
    );
  }

  return (
    <motion.ul
      {...stagger(0.04)}
      initial="initial"
      animate="animate"
      className={cn(GRID_CLASSES, className)}
    >
      {items.map((course) => (
        <motion.li key={course._id ?? course.slug} variants={staggerItem}>
          <CourseCard course={course} />
        </motion.li>
      ))}
    </motion.ul>
  );
}

export default CoursesGrid;
