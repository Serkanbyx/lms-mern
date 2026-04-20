/**
 * `useScrollLock(active)`
 *
 * Locks `<body>` scrolling while a modal / drawer is open and restores
 * the previous overflow + padding-right when it closes. The padding
 * compensation prevents the well-known "page shifts when scrollbar
 * disappears" jank on Windows / fixed-scrollbar systems.
 *
 * A module-level counter lets multiple overlays stack safely: only the
 * outermost lock ever mutates `body.style`, so closing an inner modal
 * doesn't accidentally re-enable scrolling for the outer one.
 */

import { useEffect } from 'react';

let lockCount = 0;
let originalOverflow = '';
let originalPaddingRight = '';

const lockBodyScroll = () => {
  if (typeof document === 'undefined') return;
  if (lockCount === 0) {
    const { body, documentElement } = document;
    const scrollbarWidth = window.innerWidth - documentElement.clientWidth;
    originalOverflow = body.style.overflow;
    originalPaddingRight = body.style.paddingRight;
    body.style.overflow = 'hidden';
    if (scrollbarWidth > 0) {
      body.style.paddingRight = `${scrollbarWidth}px`;
    }
  }
  lockCount += 1;
};

const unlockBodyScroll = () => {
  if (typeof document === 'undefined') return;
  lockCount = Math.max(0, lockCount - 1);
  if (lockCount === 0) {
    document.body.style.overflow = originalOverflow;
    document.body.style.paddingRight = originalPaddingRight;
  }
};

export const useScrollLock = (active) => {
  useEffect(() => {
    if (!active) return undefined;
    lockBodyScroll();
    return unlockBodyScroll;
  }, [active]);
};

export default useScrollLock;
