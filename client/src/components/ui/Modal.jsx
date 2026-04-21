/**
 * `Modal` — accessible dialog rendered into a document-level portal.
 *
 * Hard requirements (WAI-ARIA Modal Dialog Pattern):
 *   1. `role="dialog"` + `aria-modal="true"`.
 *   2. Focus trap inside the dialog while open (`useFocusTrap`).
 *   3. Body scroll locked while open (`useScrollLock`).
 *   4. `Esc` closes the dialog (`useEscapeKey`).
 *   5. Backdrop click closes (configurable via `closeOnOverlayClick`).
 *   6. Title is exposed via `aria-labelledby`.
 *
 * Animation: framer-motion handles fade for the overlay and scale-in for
 * the panel. `MotionConfig reducedMotion="user"` at the app root makes
 * both fall back to instant.
 *
 * Sizing: `size` prop maps to a max-width, defaulting to `md` (good for
 * confirmation flows). Use `lg`/`xl` for forms.
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

const SIZE_CLASSES = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  full: 'max-w-[95vw] max-h-[95vh]',
};

export function Modal({
  open,
  onClose,
  title,
  description,
  size = 'md',
  closeOnOverlayClick = true,
  showCloseButton = true,
  initialFocusRef,
  className,
  footer,
  children,
}) {
  const panelRef = useRef(null);
  const titleId = title ? 'modal-title' : undefined;
  const descId = description ? 'modal-desc' : undefined;

  useScrollLock(open);
  useFocusTrap(panelRef, open);
  useEscapeKey(onClose, open);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-100 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          <button
            type="button"
            tabIndex={-1}
            aria-label="Close dialog"
            onClick={closeOnOverlayClick ? onClose : undefined}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm cursor-default"
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={descId}
            tabIndex={-1}
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
            className={cn(
              'relative w-full bg-bg border border-border rounded-xl shadow-lg',
              'flex flex-col max-h-[90vh] overflow-hidden',
              SIZE_CLASSES[size],
              className,
            )}
          >
            {(title || showCloseButton) && (
              <header className="flex items-start justify-between gap-4 px-6 pt-5 pb-3 border-b border-border">
                <div className="flex-1 min-w-0">
                  {title && (
                    <h2
                      id={titleId}
                      className="text-lg font-semibold text-text"
                    >
                      {title}
                    </h2>
                  )}
                  {description && (
                    <p
                      id={descId}
                      className="text-sm text-text-muted mt-0.5"
                    >
                      {description}
                    </p>
                  )}
                </div>
                {showCloseButton && (
                  <IconButton
                    aria-label="Close dialog"
                    onClick={onClose}
                    ref={initialFocusRef}
                  >
                    <Icon name="X" size={18} />
                  </IconButton>
                )}
              </header>
            )}
            <div className="flex-1 overflow-y-auto px-6 py-4">{children}</div>
            {footer && (
              <footer className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border bg-bg-subtle">
                {footer}
              </footer>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

export default Modal;
