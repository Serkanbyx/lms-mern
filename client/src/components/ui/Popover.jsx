/**
 * `Popover` — generic floating UI anchored to a trigger element.
 *
 * Implementation philosophy: keep the dependency surface lean. We use
 * simple side-based placement (top/bottom/left/right) which covers 95% of
 * cases (dropdowns, tooltips, mini-forms). If alignment becomes complex
 * (collision detection, virtual references) swap in `@floating-ui/react`
 * inside this file without touching call sites.
 *
 * Compose with: `Trigger` is rendered as-is (consumer wires the click);
 * `Content` is portalled and animated with framer-motion. Click-outside
 * + Esc both close the popover.
 */

import {
  cloneElement,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '../../utils/cn.js';
import { useEscapeKey } from '../../hooks/useEscapeKey.js';

const computePosition = (anchor, side, offset = 8) => {
  const rect = anchor.getBoundingClientRect();
  const top = rect.top + window.scrollY;
  const left = rect.left + window.scrollX;
  switch (side) {
    case 'top':
      return { top: top - offset, left: left + rect.width / 2, transform: 'translate(-50%, -100%)' };
    case 'bottom':
      return { top: top + rect.height + offset, left: left + rect.width / 2, transform: 'translate(-50%, 0)' };
    case 'left':
      return { top: top + rect.height / 2, left: left - offset, transform: 'translate(-100%, -50%)' };
    case 'right':
      return { top: top + rect.height / 2, left: left + rect.width + offset, transform: 'translate(0, -50%)' };
    default:
      return { top, left };
  }
};

export function Popover({
  open,
  onOpenChange,
  trigger,
  side = 'bottom',
  align = 'start',
  className,
  children,
}) {
  const triggerRef = useRef(null);
  const contentRef = useRef(null);
  const [pos, setPos] = useState(null);
  const id = useId();

  useEscapeKey(() => onOpenChange?.(false), open);

  useEffect(() => {
    if (!open) return undefined;
    const handle = (event) => {
      const t = triggerRef.current;
      const c = contentRef.current;
      if (!t || !c) return;
      if (t.contains(event.target) || c.contains(event.target)) return;
      onOpenChange?.(false);
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [open, onOpenChange]);

  useLayoutEffect(() => {
    if (open && triggerRef.current) {
      setPos(computePosition(triggerRef.current, side));
    }
  }, [open, side]);

  useEffect(() => {
    if (!open) return undefined;
    const onScroll = () => {
      if (triggerRef.current) {
        setPos(computePosition(triggerRef.current, side));
      }
    };
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [open, side]);

  const enhancedTrigger = cloneElement(trigger, {
    ref: (node) => {
      triggerRef.current = node;
      const { ref } = trigger;
      if (typeof ref === 'function') ref(node);
      else if (ref && typeof ref === 'object') ref.current = node;
    },
    'aria-haspopup': 'dialog',
    'aria-expanded': open,
    'aria-controls': id,
    onClick: (event) => {
      trigger.props.onClick?.(event);
      onOpenChange?.(!open);
    },
  });

  return (
    <>
      {enhancedTrigger}
      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {open && pos && (
              <motion.div
                ref={contentRef}
                id={id}
                role="dialog"
                data-align={align}
                style={{ position: 'absolute', top: pos.top, left: pos.left, transform: pos.transform }}
                initial={{ opacity: 0, y: side === 'bottom' ? -4 : side === 'top' ? 4 : 0, x: side === 'right' ? -4 : side === 'left' ? 4 : 0 }}
                animate={{ opacity: 1, y: 0, x: 0 }}
                exit={{ opacity: 0, y: side === 'bottom' ? -4 : side === 'top' ? 4 : 0 }}
                transition={{ duration: 0.12 }}
                className={cn(
                  'z-[120] min-w-[180px] rounded-lg border border-border bg-bg shadow-lg',
                  className,
                )}
              >
                {children}
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </>
  );
}

export default Popover;
