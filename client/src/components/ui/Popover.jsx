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

/**
 * Compute the absolute (`top`/`left`) coordinates and the CSS `transform`
 * a popover should use to anchor itself relative to its trigger.
 *
 * `align` controls the cross-axis placement for vertical sides
 * (`top`/`bottom`):
 *   - `start`  → popover's left edge aligns with trigger's left edge.
 *   - `center` → popover is horizontally centred over the trigger.
 *   - `end`    → popover's right edge aligns with trigger's right edge.
 *     This is what user-menu avatars (right-pinned in the navbar) need
 *     so the menu opens leftwards instead of overflowing the viewport.
 *
 * For horizontal sides (`left`/`right`) `align` is ignored — they're
 * always centred vertically on the trigger to match tooltip conventions.
 */
const computePosition = (anchor, side, align = 'start', offset = 8) => {
  const rect = anchor.getBoundingClientRect();
  const top = rect.top + window.scrollY;
  const left = rect.left + window.scrollX;

  if (side === 'top' || side === 'bottom') {
    const verticalTop = side === 'top' ? top - offset : top + rect.height + offset;
    const verticalTransformY = side === 'top' ? '-100%' : '0';

    let horizontalLeft;
    let horizontalTransformX;
    if (align === 'end') {
      horizontalLeft = left + rect.width;
      horizontalTransformX = '-100%';
    } else if (align === 'center') {
      horizontalLeft = left + rect.width / 2;
      horizontalTransformX = '-50%';
    } else {
      horizontalLeft = left;
      horizontalTransformX = '0';
    }

    return {
      top: verticalTop,
      left: horizontalLeft,
      transform: `translate(${horizontalTransformX}, ${verticalTransformY})`,
    };
  }

  if (side === 'left') {
    return { top: top + rect.height / 2, left: left - offset, transform: 'translate(-100%, -50%)' };
  }
  if (side === 'right') {
    return { top: top + rect.height / 2, left: left + rect.width + offset, transform: 'translate(0, -50%)' };
  }
  return { top, left };
};

/**
 * Nudge a popover back inside the viewport once the browser has measured
 * its actual width/height. We only correct horizontal overflow on
 * vertical sides because that's where collisions almost always happen
 * (right-pinned menus on narrow screens). 8px gutter so the popover
 * never kisses the viewport edge.
 */
const clampToViewport = (rect, side, gutter = 8) => {
  if (typeof window === 'undefined' || !rect) return null;
  if (side !== 'top' && side !== 'bottom') return null;

  const viewportWidth = document.documentElement.clientWidth;
  let deltaX = 0;
  const overflowRight = rect.right - (viewportWidth - gutter);
  if (overflowRight > 0) deltaX -= overflowRight;
  const overflowLeft = gutter - rect.left;
  if (overflowLeft > 0) deltaX += overflowLeft;
  return deltaX;
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
      setPos(computePosition(triggerRef.current, side, align));
    }
  }, [open, side, align]);

  // Second pass: once the popover has actually rendered we know its
  // measured width and can shove it back inside the viewport if the
  // alignment alone wasn't enough (e.g. a 220px menu anchored to a
  // trigger that sits 60px from the right edge). We deliberately gate
  // on the primitive `pos.top`/`pos.left` instead of the whole `pos`
  // object so the effect only re-runs when the anchor actually moves;
  // depending on `pos` (the same object we mutate inside) would set up
  // an infinite measure → clamp → measure loop. The `if (deltaX !== 0)`
  // guard is the second safety net.
  useLayoutEffect(() => {
    if (!open || !pos || !contentRef.current) return;
    const measured = contentRef.current.getBoundingClientRect();
    const deltaX = clampToViewport(measured, side);
    if (deltaX && deltaX !== 0) {
      setPos((prev) => (prev ? { ...prev, left: prev.left + deltaX } : prev));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, pos?.top, pos?.left, side]);

  useEffect(() => {
    if (!open) return undefined;
    const onScroll = () => {
      if (triggerRef.current) {
        setPos(computePosition(triggerRef.current, side, align));
      }
    };
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [open, side, align]);

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
                  'z-120 min-w-45 rounded-lg border border-border bg-bg shadow-lg',
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
