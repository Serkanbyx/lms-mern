/**
 * `Tooltip` — minimal hover/focus tooltip without a heavy positioning lib.
 *
 * Anchored absolutely against the trigger via simple side placement
 * (top/bottom/left/right). Good enough for icon labels, KBD hints, and
 * disabled-state explanations. If we ever need true collision-aware
 * placement we can swap in `@floating-ui/react` here without changing the
 * call sites.
 *
 * Show triggers: `mouseenter` and `focus` (keyboard users get the hint
 * too). Hide on `mouseleave` / `blur`. Honors reduced motion via the
 * shared CSS rule (animation duration drops to ~0).
 */

import { useId, useState } from 'react';
import { cn } from '../../utils/cn.js';

const SIDE_CLASSES = {
  top: 'bottom-full left-1/2 -translate-x-1/2 mb-1.5',
  bottom: 'top-full left-1/2 -translate-x-1/2 mt-1.5',
  left: 'right-full top-1/2 -translate-y-1/2 mr-1.5',
  right: 'left-full top-1/2 -translate-y-1/2 ml-1.5',
};

export function Tooltip({
  content,
  side = 'top',
  delay = 150,
  className,
  children,
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  let timer;

  const show = () => {
    clearTimeout(timer);
    timer = setTimeout(() => setOpen(true), delay);
  };
  const hide = () => {
    clearTimeout(timer);
    setOpen(false);
  };

  if (!content) return children;

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      <span aria-describedby={open ? id : undefined}>{children}</span>
      {open && (
        <span
          id={id}
          role="tooltip"
          className={cn(
            'absolute z-50 px-2 py-1 text-xs font-medium rounded-md shadow-md',
            'bg-text text-bg whitespace-nowrap pointer-events-none',
            'animate-fade-in',
            SIDE_CLASSES[side],
            className,
          )}
        >
          {content}
        </span>
      )}
    </span>
  );
}

export default Tooltip;
