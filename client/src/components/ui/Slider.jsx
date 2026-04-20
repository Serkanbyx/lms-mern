/**
 * `Slider` — single-handle range slider built on top of native `<input
 * type="range">` so we keep all OS keyboard a11y (←/→, PageUp/Down, Home/End)
 * and screen-reader announcement for free.
 *
 * The native track is hidden and we paint our own filled track via a
 * gradient computed from the current value — this keeps cross-browser
 * styling consistent (Chromium, Firefox, Safari each shipped a different
 * pseudo-element story).
 *
 * Use cases: course price, quiz passing score, video playback rate.
 */

import { forwardRef, useState } from 'react';
import { cn } from '../../utils/cn.js';

export const Slider = forwardRef(function Slider(
  {
    min = 0,
    max = 100,
    step = 1,
    value,
    defaultValue = 0,
    onChange,
    showValue = true,
    formatValue,
    className,
    disabled,
    ...rest
  },
  ref,
) {
  const [uncontrolled, setUncontrolled] = useState(defaultValue);
  const isControlled = value !== undefined;
  const current = isControlled ? value : uncontrolled;
  const percent = Math.max(
    0,
    Math.min(100, ((Number(current) - min) / (max - min)) * 100),
  );

  const handleChange = (event) => {
    const next = Number(event.target.value);
    if (!isControlled) setUncontrolled(next);
    onChange?.(next, event);
  };

  return (
    <div className={cn('flex items-center gap-3 w-full', className)}>
      <input
        ref={ref}
        type="range"
        min={min}
        max={max}
        step={step}
        value={current}
        onChange={handleChange}
        disabled={disabled}
        className={cn(
          'flex-1 h-2 appearance-none rounded-full cursor-pointer outline-none',
          'focus-visible:ring-2 focus-visible:ring-primary/30',
          'disabled:opacity-60 disabled:cursor-not-allowed',
          '[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4',
          '[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary',
          '[&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-bg',
          '[&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:border-0',
          '[&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-primary',
        )}
        style={{
          background: `linear-gradient(to right, var(--color-primary) 0%, var(--color-primary) ${percent}%, var(--color-border) ${percent}%, var(--color-border) 100%)`,
        }}
        {...rest}
      />
      {showValue && (
        <span className="min-w-[3ch] text-sm text-text-muted tabular-nums text-right">
          {formatValue ? formatValue(current) : current}
        </span>
      )}
    </div>
  );
});

export default Slider;
