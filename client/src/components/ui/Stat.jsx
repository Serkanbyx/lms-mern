/**
 * `Stat` — dashboard tile showing a label + big value + optional delta.
 *
 * `delta` is a number; sign drives the arrow + color (green up, red down,
 * neutral when zero). Pass `format` to customise how the value is rendered
 * (currency, percent, duration). Keeps the dashboard composition trivial.
 */

import { cn } from '../../utils/cn.js';
import { Icon } from './Icon.jsx';

export function Stat({
  label,
  value,
  delta,
  format = (v) => v,
  hint,
  icon,
  className,
}) {
  const trend =
    typeof delta === 'number'
      ? delta > 0
        ? 'up'
        : delta < 0
          ? 'down'
          : 'flat'
      : null;

  const trendStyle = {
    up: 'text-success',
    down: 'text-danger',
    flat: 'text-text-muted',
  }[trend];

  return (
    <div
      className={cn(
        'flex flex-col gap-2 p-5 rounded-xl border border-border bg-bg-subtle shadow-xs',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-wider text-text-subtle">
          {label}
        </span>
        {icon && <span className="text-text-muted">{icon}</span>}
      </div>
      <div className="text-3xl font-semibold text-text tabular-nums leading-tight">
        {format(value)}
      </div>
      {(trend || hint) && (
        <div className="flex items-center gap-1.5 text-xs">
          {trend && (
            <span className={cn('inline-flex items-center gap-0.5', trendStyle)}>
              <Icon
                name={
                  trend === 'up'
                    ? 'TrendingUp'
                    : trend === 'down'
                      ? 'TrendingDown'
                      : 'Minus'
                }
                size={14}
              />
              {Math.abs(delta)}%
            </span>
          )}
          {hint && <span className="text-text-muted">{hint}</span>}
        </div>
      )}
    </div>
  );
}

export default Stat;
