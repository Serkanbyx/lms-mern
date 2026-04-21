/**
 * `CourseCardSkeleton` — placeholder used by the catalog grid while the
 * `/api/courses` request is in flight.
 *
 * Matches the real `CourseCard` rhythm (16:9 thumbnail + body padding
 * + meta row) so the layout never shifts when data arrives — that
 * cumulative-layout-shift discipline is the whole point of using a
 * skeleton instead of a centred spinner.
 */

import { Skeleton } from '../ui/index.js';

export function CourseCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-bg shadow-xs">
      <Skeleton className="aspect-video w-full rounded-none" />
      <div className="space-y-3 p-5">
        <Skeleton variant="text" className="w-4/5" />
        <Skeleton variant="text" className="w-2/5" />
        <div className="flex items-center gap-3 pt-2">
          <Skeleton variant="circle" className="h-5 w-5" />
          <Skeleton variant="text" className="w-1/3" />
        </div>
        <div className="flex items-center justify-between border-t border-border pt-3">
          <Skeleton variant="text" className="w-1/4 h-5" />
          <Skeleton variant="text" className="w-1/5" />
        </div>
      </div>
    </div>
  );
}

export default CourseCardSkeleton;
