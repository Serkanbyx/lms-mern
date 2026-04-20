/**
 * `Badge` — small status / metadata pill used for course tags, status
 * markers, count chips, role indicators.
 *
 * Variants map to semantic tokens (success, warning, danger, info) so the
 * same badge re-themes correctly when a future palette ships. Colors use
 * `color-mix` against the semantic token to keep contrast readable in
 * both light and dark themes without hand-tuning per surface.
 */

import { forwardRef } from 'react';
import { cn } from '../../utils/cn.js';

const VARIANTS = {
  neutral: 'bg-bg-muted text-text-muted border-border',
  primary: 'bg-primary/10 text-primary border-primary/20',
  success: 'bg-success/10 text-success border-success/20',
  warning: 'bg-warning/10 text-warning border-warning/20',
  danger: 'bg-danger/10 text-danger border-danger/20',
  info: 'bg-info/10 text-info border-info/20',
};

const SIZES = {
  sm: 'h-5 px-1.5 text-[11px] gap-1',
  md: 'h-6 px-2 text-xs gap-1.5',
};

export const Badge = forwardRef(function Badge(
  { variant = 'neutral', size = 'sm', leftIcon, className, children, ...rest },
  ref,
) {
  return (
    <span
      ref={ref}
      className={cn(
        'inline-flex items-center font-medium rounded-full border whitespace-nowrap',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...rest}
    >
      {leftIcon}
      {children}
    </span>
  );
});

export default Badge;
