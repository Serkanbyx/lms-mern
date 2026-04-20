/**
 * `Input` — themed text input with optional prefix/suffix slots and a
 * consistent invalid state. Designed to be wrapped by `FormField` for
 * label + helper + error wiring; can also stand alone (search bar in
 * the navbar, modal filters, etc).
 *
 * Slots:
 *   - `leadingIcon` / `trailingIcon` — render adornments (search icon,
 *     unit suffix, clear button). They sit inside the bordered shell so
 *     focus ring stays around the whole control.
 *
 * Sizing matches `Button`'s `sm/md/lg` so an inline filter row composed of
 * a Button + Input + Select stays visually aligned without ad-hoc tweaks.
 */

import { forwardRef } from 'react';
import { cn } from '../../utils/cn.js';

const SIZE_CLASSES = {
  sm: 'h-8 text-sm',
  md: 'h-10 text-sm',
  lg: 'h-12 text-base',
};

export const Input = forwardRef(function Input(
  {
    size = 'md',
    leadingIcon,
    trailingIcon,
    className,
    'aria-invalid': ariaInvalid,
    disabled,
    ...rest
  },
  ref,
) {
  const invalid = ariaInvalid === true || ariaInvalid === 'true';

  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-lg border bg-bg px-3 transition-colors',
        'focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20',
        invalid
          ? 'border-danger focus-within:border-danger focus-within:ring-danger/20'
          : 'border-border-strong',
        disabled && 'opacity-60 pointer-events-none',
        SIZE_CLASSES[size],
        className,
      )}
    >
      {leadingIcon && (
        <span className="text-text-muted shrink-0" aria-hidden="true">
          {leadingIcon}
        </span>
      )}
      <input
        ref={ref}
        disabled={disabled}
        aria-invalid={ariaInvalid}
        className={cn(
          'flex-1 bg-transparent outline-none',
          'placeholder:text-text-subtle text-text',
          'disabled:cursor-not-allowed',
        )}
        {...rest}
      />
      {trailingIcon && (
        <span className="text-text-muted shrink-0">{trailingIcon}</span>
      )}
    </div>
  );
});

export default Input;
