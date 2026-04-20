/**
 * `Tabs` — accessible tab list with arrow-key navigation and an animated
 * underline that uses framer-motion's `layoutId` for the shared-element
 * transition.
 *
 * Usage:
 *   <Tabs value={tab} onChange={setTab} items={[
 *     { id: 'overview', label: 'Overview' },
 *     { id: 'curriculum', label: 'Curriculum' },
 *   ]}>
 *     {tab === 'overview' && <Overview />}
 *     {tab === 'curriculum' && <Curriculum />}
 *   </Tabs>
 *
 * The component renders a proper `role="tablist"` with `role="tab"`
 * children. ←/→ cycle focus between tabs; Home/End jump to first/last.
 */

import { useId, useRef } from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../utils/cn.js';

export function Tabs({
  value,
  onChange,
  items = [],
  className,
  fullWidth = false,
  children,
}) {
  const baseId = useId();
  const refs = useRef({});

  const focusTab = (id) => refs.current[id]?.focus();

  const handleKeyDown = (event) => {
    const ids = items.map((it) => it.id);
    const currentIndex = ids.indexOf(value);
    if (currentIndex === -1) return;

    if (event.key === 'ArrowRight') {
      event.preventDefault();
      const next = ids[(currentIndex + 1) % ids.length];
      onChange?.(next);
      focusTab(next);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      const next = ids[(currentIndex - 1 + ids.length) % ids.length];
      onChange?.(next);
      focusTab(next);
    } else if (event.key === 'Home') {
      event.preventDefault();
      onChange?.(ids[0]);
      focusTab(ids[0]);
    } else if (event.key === 'End') {
      event.preventDefault();
      const last = ids[ids.length - 1];
      onChange?.(last);
      focusTab(last);
    }
  };

  return (
    <div className={className}>
      <div
        role="tablist"
        aria-orientation="horizontal"
        onKeyDown={handleKeyDown}
        className={cn(
          'flex items-center border-b border-border',
          fullWidth ? 'gap-0' : 'gap-1',
        )}
      >
        {items.map((item) => {
          const selected = value === item.id;
          const tabId = `${baseId}-tab-${item.id}`;
          const panelId = `${baseId}-panel-${item.id}`;
          return (
            <button
              key={item.id}
              ref={(node) => {
                refs.current[item.id] = node;
              }}
              type="button"
              role="tab"
              id={tabId}
              aria-selected={selected}
              aria-controls={panelId}
              tabIndex={selected ? 0 : -1}
              onClick={() => onChange?.(item.id)}
              className={cn(
                'relative px-4 py-2.5 text-sm font-medium outline-none transition-colors',
                'focus-visible:bg-bg-muted',
                fullWidth && 'flex-1',
                selected
                  ? 'text-text'
                  : 'text-text-muted hover:text-text',
              )}
            >
              {item.label}
              {selected && (
                <motion.span
                  layoutId={`${baseId}-indicator`}
                  className="absolute left-0 right-0 -bottom-px h-0.5 bg-primary rounded-full"
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                />
              )}
            </button>
          );
        })}
      </div>
      {children && (
        <div
          role="tabpanel"
          id={`${baseId}-panel-${value}`}
          aria-labelledby={`${baseId}-tab-${value}`}
          className="pt-4"
        >
          {children}
        </div>
      )}
    </div>
  );
}

export default Tabs;
