/**
 * `useOnClickOutside(ref, handler)`
 *
 * Calls `handler(event)` when a `mousedown` or `touchstart` lands
 * outside the element pointed to by `ref`. Drives popovers, dropdown
 * menus, and the curriculum drawer's "click-outside-to-close" behaviour.
 *
 * The handler is captured in a ref so consumers can pass an inline
 * arrow function without re-binding the global listener on every render.
 */

import { useEffect, useRef } from 'react';

export const useOnClickOutside = (ref, handler) => {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;

    const listener = (event) => {
      const node = ref?.current;
      if (!node || node.contains(event.target)) return;
      handlerRef.current(event);
    };

    document.addEventListener('mousedown', listener);
    document.addEventListener('touchstart', listener, { passive: true });

    return () => {
      document.removeEventListener('mousedown', listener);
      document.removeEventListener('touchstart', listener);
    };
  }, [ref]);
};

export default useOnClickOutside;
