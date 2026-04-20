/**
 * `Radio` — single radio option styled to match `Checkbox`.
 *
 * Usually rendered inside a `RadioGroup`-like container (`role="radiogroup"`)
 * with a shared `name` so the browser handles single-selection semantics.
 * Visual pattern mirrors `Checkbox`: hidden native input + painted sibling.
 */

import { forwardRef } from 'react';
import { cn } from '../../utils/cn.js';

export const Radio = forwardRef(function Radio(
  { label, description, className, disabled, id, ...rest },
  ref,
) {
  return (
    <label
      htmlFor={id}
      className={cn(
        'inline-flex items-start gap-2.5 cursor-pointer select-none',
        disabled && 'opacity-60 cursor-not-allowed',
        className,
      )}
    >
      <span className="relative inline-flex shrink-0 mt-0.5">
        <input
          ref={ref}
          id={id}
          type="radio"
          disabled={disabled}
          className="peer sr-only"
          {...rest}
        />
        <span
          aria-hidden="true"
          className={cn(
            'h-[18px] w-[18px] rounded-full border border-border-strong bg-bg',
            'flex items-center justify-center transition-colors',
            'peer-checked:border-primary',
            'peer-focus-visible:ring-2 peer-focus-visible:ring-primary/30',
            'peer-disabled:bg-bg-muted',
            'before:content-[""] before:h-2 before:w-2 before:rounded-full before:bg-primary',
            'before:scale-0 peer-checked:before:scale-100 before:transition-transform',
          )}
        />
      </span>
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

export default Radio;
