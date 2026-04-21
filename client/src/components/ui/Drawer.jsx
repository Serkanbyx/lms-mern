/**
 * `Drawer` — side-panel overlay (left / right / bottom). Used for mobile
 * filter panels, course curriculum sidebar, and admin sidebar collapse.
 *
 * Same a11y rules as `Modal` (focus trap, scroll lock, Esc to close,
 * `role="dialog"` + `aria-modal`) — a Drawer is just a dialog that slides
 * from an edge instead of fading in centered.
 */

import { useRef } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '../../utils/cn.js';
import { useFocusTrap } from '../../hooks/useFocusTrap.js';
import { useScrollLock } from '../../hooks/useScrollLock.js';
import { useEscapeKey } from '../../hooks/useEscapeKey.js';
import { Icon } from './Icon.jsx';
import { IconButton } from './IconButton.jsx';

const SIDE_CLASSES = {
  left: 'left-0 top-0 h-full w-full max-w-sm border-r',
  right: 'right-0 top-0 h-full w-full max-w-sm border-l',
  bottom: 'left-0 right-0 bottom-0 w-full max-h-[80vh] border-t rounded-t-xl',
};

const SIDE_VARIANTS = {
  left: { x: '-100%' },
  right: { x: '100%' },
  bottom: { y: '100%' },
};

export function Drawer({
  open,
  onClose,
  side = 'right',
  title,
  showCloseButton = true,
  closeOnOverlayClick = true,
  className,
  children,
  footer,
}) {
  const panelRef = useRef(null);
  const titleId = title ? 'drawer-title' : undefined;

  useScrollLock(open);
  useFocusTrap(panelRef, open);
  useEscapeKey(onClose, open);

  if (typeof document === 'undefined') return null;
  const initial = SIDE_VARIANTS[side];

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-100"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          {/*
            Backdrop is rendered as a presentational <div> (not a <button>)
            on purpose. A second "Close drawer" button on top of the X in
            the header doubled the AT entry list and made the panel read
            as having two close affordances. Closing on overlay click is
            still supported via the click handler — keyboard / screen
            reader users get the same behaviour through Esc + the visible
            X button inside the focus trap.
          */}
          <div
            aria-hidden="true"
            onClick={closeOnOverlayClick ? onClose : undefined}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          />
          <motion.aside
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            initial={initial}
            animate={{ x: 0, y: 0 }}
            exit={initial}
            transition={{ duration: 0.25, ease: [0.2, 0.8, 0.2, 1] }}
            className={cn(
              'absolute bg-bg border-border shadow-lg flex flex-col',
              SIDE_CLASSES[side],
              className,
            )}
          >
            {(title || showCloseButton) && (
              <header className="flex items-center justify-between gap-4 px-5 py-4 border-b border-border shrink-0">
                {title ? (
                  <h2 id={titleId} className="text-base font-semibold text-text">
                    {title}
                  </h2>
                ) : (
                  <span />
                )}
                {showCloseButton && (
                  <IconButton aria-label="Close drawer" onClick={onClose}>
                    <Icon name="X" size={18} />
                  </IconButton>
                )}
              </header>
            )}
            <div className="flex-1 overflow-y-auto p-5">{children}</div>
            {footer && (
              <footer className="px-5 py-4 border-t border-border bg-bg-subtle shrink-0">
                {footer}
              </footer>
            )}
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

export default Drawer;
