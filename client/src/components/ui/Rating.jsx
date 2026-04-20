/**
 * `Rating` — read-only star rating display (course catalog cards, course
 * detail header). Supports half stars by clipping a filled overlay over a
 * ghost row of empty stars.
 *
 * Accessibility: announced via `role="img"` with an aria-label like
 * "Rated 4.5 out of 5 stars (1,234 reviews)". The visual stars are hidden
 * from assistive tech to avoid duplicate readout.
 *
 * v1 stays read-only by design (interactive ratings are reserved for a
 * future "leave a review" flow).
 */

import { cn } from '../../utils/cn.js';
import { Icon } from './Icon.jsx';

export function Rating({
  value = 0,
  max = 5,
  count,
  size = 14,
  showValue = true,
  className,
}) {
  const clamped = Math.max(0, Math.min(max, Number(value) || 0));
  const percent = (clamped / max) * 100;
  const label = `Rated ${clamped.toFixed(1)} out of ${max} stars${
    count != null ? ` (${count} ratings)` : ''
  }`;

  return (
    <span
      role="img"
      aria-label={label}
      className={cn('inline-flex items-center gap-1.5', className)}
    >
      <span
        className="relative inline-flex"
        aria-hidden="true"
        style={{ lineHeight: 0 }}
      >
        <span className="inline-flex text-border-strong">
          {Array.from({ length: max }).map((_, i) => (
            <Icon key={i} name="Star" size={size} />
          ))}
        </span>
        <span
          className="absolute inset-0 inline-flex overflow-hidden text-warning"
          style={{ width: `${percent}%` }}
        >
          {Array.from({ length: max }).map((_, i) => (
            <Icon
              key={i}
              name="Star"
              size={size}
              className="fill-current"
            />
          ))}
        </span>
      </span>
      {showValue && (
        <span className="text-xs text-text-muted tabular-nums">
          {clamped.toFixed(1)}
          {count != null && (
            <span className="text-text-subtle"> ({count})</span>
          )}
        </span>
      )}
    </span>
  );
}

export default Rating;
