/**
 * `useFocusTrap(ref, active = true)`
 *
 * Keyboard-focus trap for accessible modals and drawers. While `active`:
 *   - Focus is moved to the first tabbable element inside `ref` on mount.
 *   - Tab / Shift+Tab cycle focus inside the container, never escaping
 *     to the page underneath.
 *   - The previously focused element is restored when the trap deactivates,
 *     matching native dialog UX (assistive tech relies on this).
 *
 * Implemented without a third-party library to keep the dependency
 * surface lean (per project rule #4 — prefer native primitives).
 */

import { useEffect } from 'react';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

const getFocusable = (root) =>
  Array.from(root.querySelectorAll(FOCUSABLE_SELECTOR)).filter(
    (el) => !el.hasAttribute('aria-hidden') && el.offsetParent !== null,
  );

export const useFocusTrap = (ref, active = true) => {
  useEffect(() => {
    if (!active) return undefined;
    const root = ref?.current;
    if (!root || typeof document === 'undefined') return undefined;

    const previouslyFocused = document.activeElement;
    const focusables = getFocusable(root);
    (focusables[0] || root).focus({ preventScroll: true });

    const onKeyDown = (event) => {
      if (event.key !== 'Tab') return;
      const items = getFocusable(root);
      if (items.length === 0) {
        event.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const current = document.activeElement;

      if (event.shiftKey && current === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && current === last) {
        event.preventDefault();
        first.focus();
      }
    };

    root.addEventListener('keydown', onKeyDown);
    return () => {
      root.removeEventListener('keydown', onKeyDown);
      if (previouslyFocused instanceof HTMLElement) {
        previouslyFocused.focus({ preventScroll: true });
      }
    };
  }, [ref, active]);
};

export default useFocusTrap;
