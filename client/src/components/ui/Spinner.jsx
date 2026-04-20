/**
 * `Spinner` — minimal CSS-only loading indicator.
 *
 * Avoids framer-motion to stay cheap (rendered inside buttons, lists, fetch
 * boundaries — anywhere we'd burn cycles spinning a heavy animation up).
 *
 * Sizes match icon scales so it can stand in for a leading icon inside a
 * `Button` without nudging the layout.
 *
 * Accessibility: when used as a standalone status (not inside an element
 * that already has `aria-busy`), pass `label` to expose a polite live
 * region announcement. By default the spinner is `aria-hidden`.
 */

import { cn } from '../../utils/cn.js';

const SIZE_CLASSES = {
  xs: 'h-3.5 w-3.5 border-[1.5px]',
  sm: 'h-4 w-4 border-2',
  md: 'h-6 w-6 border-2',
  lg: 'h-8 w-8 border-[3px]',
};

export function Spinner({ size = 'md', label, className, ...rest }) {
  return (
    <span
      role={label ? 'status' : undefined}
      aria-live={label ? 'polite' : undefined}
      aria-hidden={label ? undefined : 'true'}
      className={cn('inline-flex items-center gap-2', className)}
      {...rest}
    >
      <span
        className={cn(
          'inline-block rounded-full border-current border-t-transparent animate-spin',
          'text-current opacity-70',
          SIZE_CLASSES[size],
        )}
      />
      {label && <span className="text-sm text-text-muted">{label}</span>}
    </span>
  );
}

export default Spinner;
