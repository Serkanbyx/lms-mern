/**
 * `Dropdown` — menu primitive with keyboard navigation.
 *
 * Built on top of `Popover` for positioning, but adds the menu semantics:
 *   - `role="menu"` container with `role="menuitem"` items.
 *   - ↑/↓ move active item, Enter/Space activate, Esc closes.
 *   - Auto-focuses the first enabled item when opened with the keyboard.
 *
 * `items` shape: `{ id, label, icon, onSelect, disabled, danger, separator }`.
 * Separators render a thin divider — they are NOT focusable.
 */

import { useEffect, useRef, useState } from 'react';
import { cn } from '../../utils/cn.js';
import { Popover } from './Popover.jsx';
import { Icon } from './Icon.jsx';

export function Dropdown({
  trigger,
  items = [],
  side = 'bottom',
  align = 'start',
  className,
}) {
  const [open, setOpen] = useState(false);
  const listRef = useRef(null);
  const [activeIndex, setActiveIndex] = useState(-1);

  const focusableIndexes = items
    .map((it, i) => (it.separator || it.disabled ? null : i))
    .filter((i) => i !== null);

  useEffect(() => {
    if (!open) {
      setActiveIndex(-1);
      return;
    }
    setActiveIndex(focusableIndexes[0] ?? -1);
  }, [open]);

  useEffect(() => {
    if (!open || activeIndex < 0) return;
    const node = listRef.current?.querySelector(
      `[data-menu-index="${activeIndex}"]`,
    );
    node?.focus();
  }, [activeIndex, open]);

  const move = (direction) => {
    if (focusableIndexes.length === 0) return;
    const currentPos = focusableIndexes.indexOf(activeIndex);
    const nextPos =
      (currentPos + direction + focusableIndexes.length) %
      focusableIndexes.length;
    setActiveIndex(focusableIndexes[nextPos]);
  };

  const handleKeyDown = (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      move(1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      move(-1);
    } else if (event.key === 'Home') {
      event.preventDefault();
      setActiveIndex(focusableIndexes[0] ?? -1);
    } else if (event.key === 'End') {
      event.preventDefault();
      setActiveIndex(focusableIndexes[focusableIndexes.length - 1] ?? -1);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen} trigger={trigger} side={side} align={align}>
      <ul
        ref={listRef}
        role="menu"
        onKeyDown={handleKeyDown}
        className={cn('py-1.5 min-w-[180px]', className)}
      >
        {items.map((item, index) => {
          if (item.separator) {
            return (
              <li
                key={item.id ?? `sep-${index}`}
                role="separator"
                className="my-1 h-px bg-border"
              />
            );
          }
          return (
            <li key={item.id ?? index} role="none">
              <button
                type="button"
                role="menuitem"
                disabled={item.disabled}
                tabIndex={index === activeIndex ? 0 : -1}
                data-menu-index={index}
                onClick={() => {
                  if (item.disabled) return;
                  item.onSelect?.();
                  setOpen(false);
                }}
                className={cn(
                  'flex w-full items-center gap-2.5 px-3 py-1.5 text-sm text-text outline-none',
                  'hover:bg-bg-muted focus:bg-bg-muted focus-visible:outline-0',
                  'disabled:opacity-50 disabled:pointer-events-none',
                  item.danger && 'text-danger hover:bg-danger/10',
                )}
              >
                {item.icon && (
                  <span className="shrink-0 text-current">
                    {typeof item.icon === 'string' ? (
                      <Icon name={item.icon} size={16} />
                    ) : (
                      item.icon
                    )}
                  </span>
                )}
                <span className="flex-1 text-left">{item.label}</span>
                {item.shortcut && (
                  <span className="text-xs text-text-subtle">
                    {item.shortcut}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </Popover>
  );
}

export default Dropdown;
