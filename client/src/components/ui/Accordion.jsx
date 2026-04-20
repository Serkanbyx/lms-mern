/**
 * `Accordion` — collapsible section list. Supports single-open or
 * multi-open mode (`type="single" | "multiple"`).
 *
 * Used by: course curriculum (sections collapse to lesson lists), FAQ
 * blocks on the landing page, settings groupings.
 *
 * Animation: framer-motion's `AnimatePresence` + `motion.div` with an
 * animated `height: 'auto'` via initial 0 → animate 'auto'. Works with
 * variable-length content without measuring.
 *
 * Accessibility: each header is a real `<button>` with `aria-expanded`
 * and `aria-controls` pointing at its panel id, matching the WAI-ARIA
 * Disclosure pattern (we intentionally do NOT use the deprecated
 * accordion-pattern keyboard shortcuts beyond Tab — most users expect
 * disclosure semantics).
 */

import { useId, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '../../utils/cn.js';
import { Icon } from './Icon.jsx';

export function Accordion({
  items = [],
  type = 'single',
  defaultOpen,
  className,
}) {
  const baseId = useId();
  const [openIds, setOpenIds] = useState(() => {
    if (Array.isArray(defaultOpen)) return new Set(defaultOpen);
    if (defaultOpen != null) return new Set([defaultOpen]);
    return new Set();
  });

  const toggle = (id) => {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (type === 'single') {
        if (next.has(id)) next.delete(id);
        else {
          next.clear();
          next.add(id);
        }
      } else if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <div className={cn('divide-y divide-border border border-border rounded-xl overflow-hidden bg-bg-subtle', className)}>
      {items.map((item) => {
        const isOpen = openIds.has(item.id);
        const headerId = `${baseId}-header-${item.id}`;
        const panelId = `${baseId}-panel-${item.id}`;
        return (
          <div key={item.id}>
            <button
              type="button"
              id={headerId}
              aria-expanded={isOpen}
              aria-controls={panelId}
              onClick={() => toggle(item.id)}
              className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left text-sm font-medium text-text hover:bg-bg-muted transition-colors"
            >
              <span className="flex-1">{item.title}</span>
              {item.meta && (
                <span className="text-xs text-text-muted">{item.meta}</span>
              )}
              <Icon
                name="ChevronDown"
                size={18}
                className={cn(
                  'shrink-0 text-text-muted transition-transform duration-200',
                  isOpen && 'rotate-180',
                )}
              />
            </button>
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  id={panelId}
                  role="region"
                  aria-labelledby={headerId}
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
                  className="overflow-hidden"
                >
                  <div className="px-5 pb-4 pt-1 text-sm text-text-muted">
                    {item.content}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}

export default Accordion;
