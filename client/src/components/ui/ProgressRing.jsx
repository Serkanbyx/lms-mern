/**
 * `ProgressRing` — circular SVG progress indicator. Used for quiz scores,
 * course completion percentage on dashboard tiles, and the lesson player
 * mini-completion badge.
 *
 * Implementation:
 *   - Two stacked SVG circles. The foreground stroke uses `stroke-dasharray`
 *     equal to the circumference and `stroke-dashoffset` derived from the
 *     value — the canonical SVG ring trick that animates smoothly without
 *     any layout work.
 *   - Color follows the same band rule as `ProgressBar` so the visual
 *     language is consistent.
 */

import { cn } from '../../utils/cn.js';

const colorForValue = (v) => {
  if (v >= 100) return 'stroke-success';
  if (v >= 25) return 'stroke-primary';
  return 'stroke-border-strong';
};

export function ProgressRing({
  value = 0,
  max = 100,
  size = 64,
  strokeWidth = 6,
  showValue = true,
  label,
  className,
}) {
  const clamped = Math.max(0, Math.min(max, value));
  const percent = (clamped / max) * 100;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - percent / 100);

  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={clamped}
      aria-label={label}
      className={cn('relative inline-flex items-center justify-center', className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          fill="none"
          className="stroke-bg-muted"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={cn(
            'transition-[stroke-dashoffset] duration-500 ease-out',
            colorForValue(percent),
          )}
        />
      </svg>
      {showValue && (
        <span className="absolute text-xs font-semibold tabular-nums text-text">
          {Math.round(percent)}%
        </span>
      )}
    </div>
  );
}

export default ProgressRing;
