/**
 * `ChipInput` — tag input. Type a value, press Enter or comma to commit it
 * as a chip; press Backspace inside an empty field to remove the previous
 * chip (matches Gmail / Linear muscle memory).
 *
 * Designed for: course tags, learning outcomes, "what you'll learn", quiz
 * keywords, instructor expertise, course requirements.
 *
 * Controlled-only: callers own the `value` array, since chips are usually
 * persisted to a form / API. Enforces `maxItems` and ignores duplicates
 * (case-insensitive) by default.
 */

import { forwardRef, useRef, useState } from 'react';
import { cn } from '../../utils/cn.js';
import { Icon } from './Icon.jsx';

export const ChipInput = forwardRef(function ChipInput(
  {
    value = [],
    onChange,
    placeholder = 'Type and press Enter…',
    maxItems = 20,
    allowDuplicates = false,
    className,
    disabled,
    'aria-invalid': ariaInvalid,
    ...rest
  },
  ref,
) {
  const [draft, setDraft] = useState('');
  const inputRef = useRef(null);
  const invalid = ariaInvalid === true || ariaInvalid === 'true';

  const addChip = (raw) => {
    const next = raw.trim();
    if (!next) return;
    if (value.length >= maxItems) return;
    if (
      !allowDuplicates &&
      value.some((v) => v.toLowerCase() === next.toLowerCase())
    ) {
      return;
    }
    onChange?.([...value, next]);
    setDraft('');
  };

  const removeChip = (index) => {
    onChange?.(value.filter((_, i) => i !== index));
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      addChip(draft);
    } else if (event.key === 'Backspace' && draft === '' && value.length > 0) {
      removeChip(value.length - 1);
    }
  };

  // The wrapper passes any tap-anywhere through to the real <input> so the
  // chip area behaves like a single text field. The native <input> still
  // owns focus + keyboard, so the wrapper's click handler is purely a
  // hit-area expander — keyboard users never need it.
  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
    <div
      ref={ref}
      onClick={() => inputRef.current?.focus()}
      className={cn(
        'flex flex-wrap items-center gap-1.5 min-h-10 rounded-lg border bg-bg p-1.5 transition-colors',
        'focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20',
        invalid
          ? 'border-danger focus-within:border-danger focus-within:ring-danger/20'
          : 'border-border-strong',
        disabled && 'opacity-60 pointer-events-none',
        className,
      )}
    >
      {value.map((chip, index) => (
        <span
          key={`${chip}-${index}`}
          className="inline-flex items-center gap-1 h-7 pl-2.5 pr-1 rounded-md bg-bg-muted text-xs text-text"
        >
          {chip}
          <button
            type="button"
            aria-label={`Remove ${chip}`}
            onClick={(event) => {
              event.stopPropagation();
              removeChip(index);
            }}
            className="inline-flex h-5 w-5 items-center justify-center rounded hover:bg-border text-text-muted hover:text-text"
          >
            <Icon name="X" size={12} />
          </button>
        </span>
      ))}
      <input
        ref={inputRef}
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => addChip(draft)}
        placeholder={value.length === 0 ? placeholder : undefined}
        disabled={disabled}
        className="flex-1 min-w-[8ch] bg-transparent outline-none text-sm text-text placeholder:text-text-subtle px-1"
        {...rest}
      />
    </div>
  );
});

export default ChipInput;
