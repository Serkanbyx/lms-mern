/**
 * `RouteSkeleton` — generic Suspense fallback for lazy-loaded route
 * chunks (see STEP 43 for the full list of `React.lazy` imports).
 *
 * The shape is intentionally vague — a couple of stacked grey blocks —
 * because the same fallback covers every page. Page-level skeletons
 * (course cards, dashboard stats, etc.) live next to the page that
 * owns them and render once the chunk has resolved.
 */

import { Skeleton } from '../ui/Skeleton.jsx';

export function RouteSkeleton() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Loading page"
      className="max-w-5xl mx-auto px-6 py-12 space-y-6"
    >
      <Skeleton width="40%" height={28} />
      <Skeleton width="70%" height={14} />
      <Skeleton width="60%" height={14} />
      <div className="grid gap-4 md:grid-cols-3 pt-4">
        <Skeleton height={140} />
        <Skeleton height={140} />
        <Skeleton height={140} />
      </div>
    </div>
  );
}

export default RouteSkeleton;
