/**
 * `Textarea` — multi-line input with optional autosize + character counter.
 *
 * Autosize:
 *   - When `autosize` is true, height tracks `scrollHeight` on every input,
 *     letting the field grow with content (capped by `maxRows`).
 *   - Implemented with a ref-driven effect, no third-party dep, no measuring
 *     ghost element — modern browsers expose `scrollHeight` reliably.
 *
 * Character counter:
 *   - Pass `maxLength` + `showCounter` to render a "current / max" hint
 *     beneath the field. The counter is wrapped in `aria-live="polite"`
 *     so screen readers announce it as the user types, but only on
 *     significant updates (we throttle in `aria-live` semantics).
 */

import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { cn } from '../../utils/cn.js';

export const Textarea = forwardRef(function Textarea(
  {
    autosize = false,
    rows = 4,
    maxRows = 10,
    showCounter = false,
    maxLength,
    className,
    onChange,
    value,
    defaultValue,
    'aria-invalid': ariaInvalid,
    disabled,
    ...rest
  },
  ref,
) {
  const innerRef = useRef(null);
  useImperativeHandle(ref, () => innerRef.current, []);

  const invalid = ariaInvalid === true || ariaInvalid === 'true';
  const length = (value ?? defaultValue ?? '').toString().length;

  const resize = () => {
    const node = innerRef.current;
    if (!node || !autosize) return;
    node.style.height = 'auto';
    const lineHeight = parseFloat(getComputedStyle(node).lineHeight) || 20;
    const max = lineHeight * maxRows;
    node.style.height = `${Math.min(node.scrollHeight, max)}px`;
    node.style.overflowY = node.scrollHeight > max ? 'auto' : 'hidden';
  };

  useEffect(() => {
    resize();
  }, [value, autosize, maxRows]);

  const handleChange = (event) => {
    onChange?.(event);
    if (autosize) resize();
  };

  return (
    <div
      className={cn(
        'rounded-lg border bg-bg px-3 py-2 transition-colors',
        'focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20',
        invalid
          ? 'border-danger focus-within:border-danger focus-within:ring-danger/20'
          : 'border-border-strong',
        disabled && 'opacity-60',
        className,
      )}
    >
      <textarea
        ref={innerRef}
        rows={rows}
        maxLength={maxLength}
        disabled={disabled}
        value={value}
        defaultValue={defaultValue}
        onChange={handleChange}
        aria-invalid={ariaInvalid}
        className={cn(
          'w-full resize-none bg-transparent outline-none text-sm text-text',
          'placeholder:text-text-subtle disabled:cursor-not-allowed',
        )}
        {...rest}
      />
      {showCounter && maxLength != null && (
        <div
          className="mt-1 text-xs text-text-subtle text-right"
          aria-live="polite"
        >
          {length} / {maxLength}
        </div>
      )}
    </div>
  );
});

export default Textarea;
