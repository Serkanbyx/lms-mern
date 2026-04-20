/**
 * `useEscapeKey(handler, enabled = true)`
 *
 * Calls `handler(event)` when the user presses the Escape key. Used by
 * modal / dialog primitives to close on Esc without forcing every
 * caller to wire up its own keydown listener.
 *
 * The hook auto-detaches the listener when `enabled` flips to `false`,
 * so multiple stacked overlays don't all swallow the same Esc press.
 */

import { useEffect, useRef } from 'react';

export const useEscapeKey = (handler, enabled = true) => {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!enabled || typeof document === 'undefined') return undefined;

    const onKeyDown = (event) => {
      if (event.key === 'Escape') handlerRef.current(event);
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [enabled]);
};

export default useEscapeKey;
