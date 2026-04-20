/**
 * `ProgressBar` — horizontal progress indicator.
 *
 * Color tracks completion bands (gray under 25%, primary 25-99, success at
 * 100) so a learner instantly recognises a "finished course" without
 * reading the number — a small dopamine hit that pays off in retention.
 *
 * Indeterminate variant runs a sliding gradient when total progress is
 * unknown (initial fetch, sync in flight). Honors reduced-motion through
 * the shared CSS animation guard.
 *
 * Accessibility: `role="progressbar"` with `aria-valuemin/max/now` so
 * screen readers announce "33%, in progress".
 */

import { cn } from '../../utils/cn.js';

const colorForValue = (value) => {
  if (value >= 100) return 'bg-success';
  if (value >= 25) return 'bg-primary';
  return 'bg-border-strong';
};

export function ProgressBar({
  value = 0,
  max = 100,
  indeterminate = false,
  showLabel = false,
  size = 'md',
  className,
  label,
  ...rest
}) {
  const clamped = Math.max(0, Math.min(max, value));
  const percent = (clamped / max) * 100;
  const heights = { sm: 'h-1', md: 'h-2', lg: 'h-3' };

  return (
    <div className={cn('w-full', className)}>
      {showLabel && (
        <div className="flex justify-between text-xs text-text-muted mb-1.5">
          <span>{label ?? 'Progress'}</span>
          {!indeterminate && (
            <span className="tabular-nums">{Math.round(percent)}%</span>
          )}
        </div>
      )}
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={indeterminate ? undefined : clamped}
        aria-label={label}
        className={cn(
          'w-full overflow-hidden rounded-full bg-bg-muted',
          heights[size],
        )}
        {...rest}
      >
        {indeterminate ? (
          <span className="block h-full w-1/3 rounded-full bg-primary animate-progress-indeterminate" />
        ) : (
          <span
            className={cn(
              'block h-full rounded-full transition-[width] duration-500 ease-out',
              colorForValue(percent),
            )}
            style={{ width: `${percent}%` }}
          />
        )}
      </div>
    </div>
  );
}

export default ProgressBar;
