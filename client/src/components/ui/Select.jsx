/**
 * `Select` — native `<select>` styled to visually match `Input`.
 *
 * We deliberately keep the native control (instead of a custom dropdown)
 * because:
 *   - It inherits OS-level keyboard navigation, type-ahead, and mobile
 *     wheel pickers for free.
 *   - It avoids the long tail of accessibility bugs that custom listboxes
 *     ship with.
 *
 * Options can be passed via the `options` prop (recommended) or as JSX
 * children (`<option>`s) when grouping (`<optgroup>`) is needed.
 */

import { forwardRef } from 'react';
import { cn } from '../../utils/cn.js';
import { Icon } from './Icon.jsx';

const SIZE_CLASSES = {
  sm: 'h-8 text-sm pl-3 pr-8',
  md: 'h-10 text-sm pl-3 pr-9',
  lg: 'h-12 text-base pl-4 pr-10',
};

export const Select = forwardRef(function Select(
  {
    size = 'md',
    options,
    placeholder,
    className,
    'aria-invalid': ariaInvalid,
    disabled,
    children,
    ...rest
  },
  ref,
) {
  const invalid = ariaInvalid === true || ariaInvalid === 'true';

  return (
    <div className={cn('relative inline-flex w-full', className)}>
      <select
        ref={ref}
        disabled={disabled}
        aria-invalid={ariaInvalid}
        className={cn(
          'w-full appearance-none rounded-lg border bg-bg text-text outline-none transition-colors',
          'focus:border-primary focus:ring-2 focus:ring-primary/20',
          invalid
            ? 'border-danger focus:border-danger focus:ring-danger/20'
            : 'border-border-strong',
          'disabled:opacity-60 disabled:cursor-not-allowed',
          SIZE_CLASSES[size],
        )}
        {...rest}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options
          ? options.map((opt) => (
              <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                {opt.label}
              </option>
            ))
          : children}
      </select>
      <Icon
        name="ChevronDown"
        size={16}
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-text-muted"
      />
    </div>
  );
});

export default Select;
