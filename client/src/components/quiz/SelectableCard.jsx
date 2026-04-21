/**
 * `SelectableCard` — a large, opinionated radio-style option card used
 * by the quiz player (and reusable by any "pick one from a list" UX).
 *
 * Why a card and not a plain `Radio`?
 *   - Quiz options regularly hold a sentence of text, sometimes wrapping
 *     onto two or three lines. A plain radio dot loses the affordance
 *     when the whole row is the click target — a full bordered card with
 *     a clear selected state reads better, scales to long answers, and
 *     gives keyboard / touch users a generous hit area.
 *
 * Behaviour:
 *   - Renders a hidden native `<input type="radio">` so the browser
 *     handles grouping (`name`), keyboard arrow-key cycling within the
 *     group, and form participation for free.
 *   - The card itself receives the focus ring through `focus-within`
 *     because the visible interactive surface is the `<label>`, but
 *     focus actually lives on the hidden input. This preserves the
 *     native a11y contract while keeping the visual styling on the card.
 *   - Selected state lifts the border to `primary`, tints the surface,
 *     and reveals the check chip. Hover gives a subtle 2px lift.
 *
 * Keyboard hint (`Press N`) is shown on `sm+` only — small viewports
 * usually mean touch where a key hint would be misleading.
 */

import { forwardRef } from 'react';

import { Icon } from '../ui/Icon.jsx';
import { cn } from '../../utils/cn.js';

export const SelectableCard = forwardRef(function SelectableCard(
  {
    name,
    value,
    selected = false,
    onSelect,
    label,
    hint,
    disabled = false,
    className,
    ...rest
  },
  ref,
) {
  const handleChange = () => {
    if (disabled) return;
    onSelect?.(value);
  };

  return (
    <label
      className={cn(
        'group relative flex w-full items-start gap-4 rounded-xl border-2 px-4 py-3.5 sm:px-5 sm:py-4',
        'cursor-pointer transition-all duration-200 ease-out select-none',
        'focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-primary',
        selected
          ? 'border-primary bg-primary/10 shadow-md'
          : 'border-border bg-bg-subtle hover:-translate-y-0.5 hover:border-border-strong hover:shadow-md',
        disabled && 'pointer-events-none opacity-60',
        className,
      )}
    >
      <input
        ref={ref}
        type="radio"
        name={name}
        value={value}
        checked={selected}
        onChange={handleChange}
        disabled={disabled}
        className="sr-only"
        {...rest}
      />

      <span
        aria-hidden="true"
        className={cn(
          'mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
          selected
            ? 'border-primary bg-primary text-primary-fg'
            : 'border-border-strong bg-bg text-transparent group-hover:border-primary',
        )}
      >
        <Icon name="Check" size={14} strokeWidth={3} />
      </span>

      <div className="min-w-0 flex-1">
        <span
          className={cn(
            'block text-sm sm:text-base leading-relaxed',
            selected ? 'text-text font-medium' : 'text-text',
          )}
        >
          {label}
        </span>
        {hint && (
          <span className="mt-0.5 block text-xs text-text-muted">{hint}</span>
        )}
      </div>
    </label>
  );
});

export default SelectableCard;
