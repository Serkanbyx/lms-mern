/**
 * `Toggle` — accessible switch (on/off) used for binary preferences
 * (theme override, "send me notifications", "dark mode", "free preview").
 *
 * Uses `role="switch"` + `aria-checked` instead of a checkbox so screen
 * readers announce "switch, on/off" — semantically truer than "checkbox,
 * checked".
 *
 * Controlled via `checked` + `onChange(nextBoolean)` for ergonomic React
 * usage, but also accepts uncontrolled `defaultChecked` for the rare
 * uncontrolled case.
 */

import { forwardRef, useState } from 'react';
import { cn } from '../../utils/cn.js';

export const Toggle = forwardRef(function Toggle(
  {
    checked,
    defaultChecked = false,
    onChange,
    label,
    description,
    disabled = false,
    size = 'md',
    className,
    id,
    ...rest
  },
  ref,
) {
  const [uncontrolled, setUncontrolled] = useState(defaultChecked);
  const isControlled = checked !== undefined;
  const value = isControlled ? checked : uncontrolled;

  const handleToggle = () => {
    if (disabled) return;
    const next = !value;
    if (!isControlled) setUncontrolled(next);
    onChange?.(next);
  };

  const sizes = {
    sm: { track: 'h-4 w-7', thumb: 'h-3 w-3', translate: 'translate-x-3' },
    md: { track: 'h-5 w-9', thumb: 'h-4 w-4', translate: 'translate-x-4' },
    lg: { track: 'h-6 w-11', thumb: 'h-5 w-5', translate: 'translate-x-5' },
  };
  const s = sizes[size];

  return (
    <label
      htmlFor={id}
      className={cn(
        'inline-flex items-center gap-3 cursor-pointer select-none',
        disabled && 'opacity-60 cursor-not-allowed',
        className,
      )}
    >
      <button
        ref={ref}
        id={id}
        type="button"
        role="switch"
        aria-checked={value}
        aria-label={label && typeof label === 'string' ? label : undefined}
        disabled={disabled}
        onClick={handleToggle}
        className={cn(
          'relative shrink-0 inline-flex items-center rounded-full transition-colors',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
          value ? 'bg-primary' : 'bg-border-strong',
          s.track,
        )}
        {...rest}
      >
        <span
          className={cn(
            'inline-block translate-x-0.5 rounded-full bg-white shadow-xs',
            'transition-transform duration-200 ease-out',
            s.thumb,
            value && s.translate,
          )}
        />
      </button>
      {(label || description) && (
        <span className="flex flex-col leading-tight">
          {label && <span className="text-sm text-text">{label}</span>}
          {description && (
            <span className="text-xs text-text-muted">{description}</span>
          )}
        </span>
      )}
    </label>
  );
});

export default Toggle;
