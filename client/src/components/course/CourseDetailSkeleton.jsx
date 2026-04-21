/**
 * `CourseDetailSkeleton` — shimmer placeholder for the public detail page.
 *
 * Mirrors the structure of the real page (hero band + sticky enrollment
 * card + tabbed body + curriculum accordion) so the layout never jumps
 * once data resolves. We deliberately render skeletons inside the same
 * container widths the live page uses; if either ever drifts the page
 * gets a visible layout shift, which the shared structure should catch
 * during review.
 */

import { Skeleton } from '../ui/index.js';

export function CourseDetailSkeleton() {
  return (
    <div aria-busy="true" aria-live="polite">
      <div className="bg-bg-subtle border-b border-border">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-10 lg:py-14">
          <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-10">
            <div className="space-y-5">
              <Skeleton variant="text" className="w-1/2" />
              <Skeleton className="h-9 w-3/4" />
              <Skeleton className="h-9 w-2/3" />
              <Skeleton variant="text" className="w-full" />
              <Skeleton variant="text" className="w-5/6" />

              <div className="flex flex-wrap gap-3 pt-2">
                {Array.from({ length: 5 }).map((_, index) => (
                  <Skeleton key={index} className="h-6 w-20" />
                ))}
              </div>

              <div className="flex items-center gap-3 pt-2">
                <Skeleton variant="circle" className="h-10 w-10" />
                <div className="space-y-2">
                  <Skeleton variant="text" className="w-32" />
                  <Skeleton variant="text" className="w-20" />
                </div>
              </div>
            </div>

            <div className="hidden lg:block">
              <div className="rounded-2xl border border-border bg-bg shadow-sm overflow-hidden">
                <Skeleton className="aspect-video w-full rounded-none" />
                <div className="p-5 space-y-4">
                  <Skeleton className="h-7 w-1/2" />
                  <Skeleton className="h-11 w-full rounded-lg" />
                  <div className="space-y-2 pt-2">
                    {Array.from({ length: 5 }).map((_, index) => (
                      <Skeleton key={index} variant="text" className="w-4/5" />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-10">
        <div className="flex items-center gap-2 border-b border-border pb-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-8 w-24" />
          ))}
        </div>

        <div className="mt-6 space-y-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  );
}

export default CourseDetailSkeleton;
