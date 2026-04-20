/**
 * `Checkbox` — accessible checkbox with custom visual styling.
 *
 * Pattern: a real (visually hidden) `<input type="checkbox">` keeps native
 * keyboard, focus and form integration; a sibling `<span>` paints the box
 * we actually see, reacting to `peer-checked` / `peer-focus-visible` /
 * `peer-disabled` from the input.
 *
 * Indeterminate state is set imperatively (the only way the DOM exposes it)
 * via a ref-effect, then visually rendered with a dash icon.
 */

import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { cn } from '../../utils/cn.js';
import { Icon } from './Icon.jsx';

export const Checkbox = forwardRef(function Checkbox(
  {
    label,
    description,
    indeterminate = false,
    className,
    disabled,
    id,
    ...rest
  },
  ref,
) {
  const innerRef = useRef(null);
  useImperativeHandle(ref, () => innerRef.current, []);

  useEffect(() => {
    if (innerRef.current) innerRef.current.indeterminate = indeterminate;
  }, [indeterminate]);

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
          ref={innerRef}
          id={id}
          type="checkbox"
          disabled={disabled}
          className="peer sr-only"
          {...rest}
        />
        <span
          aria-hidden="true"
          className={cn(
            'h-[18px] w-[18px] rounded-md border border-border-strong bg-bg',
            'flex items-center justify-center transition-colors',
            'peer-checked:bg-primary peer-checked:border-primary',
            'peer-indeterminate:bg-primary peer-indeterminate:border-primary',
            'peer-focus-visible:ring-2 peer-focus-visible:ring-primary/30',
            'peer-disabled:bg-bg-muted',
            '[&_svg]:opacity-0 peer-checked:[&_svg]:opacity-100 peer-indeterminate:[&_svg]:opacity-100',
          )}
        >
          {indeterminate ? (
            <Icon name="Minus" size={12} className="text-primary-fg" />
          ) : (
            <Icon
              name="Check"
              size={12}
              strokeWidth={3}
              className="text-primary-fg transition-opacity"
            />
          )}
        </span>
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

export default Checkbox;
