/**
 * `useOnlineStatus` — reactive wrapper around `navigator.onLine`.
 *
 * The browser fires `online` / `offline` events whenever the connectivity
 * state flips; this hook subscribes to both and re-renders the consumer
 * with the latest boolean. It is SSR-safe (defaults to `true` when
 * `window` is undefined) so route components can call it unconditionally
 * even in a server-rendered context.
 *
 * Used by the global offline `Banner` (STEP 39) and any future feature
 * that wants to disable network-bound actions (queueing a quiz submit,
 * for example).
 */

import { useEffect, useState } from 'react';

const getInitialStatus = () => {
  if (typeof navigator === 'undefined') return true;
  return navigator.onLine !== false;
};

export const useOnlineStatus = () => {
  const [online, setOnline] = useState(getInitialStatus);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);

    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);

    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  return online;
};

export default useOnlineStatus;
