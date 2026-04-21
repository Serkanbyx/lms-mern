/**
 * `OfflineBanner` — global connectivity warning mounted by `MainLayout`.
 *
 * Listens to `navigator.onLine` via `useOnlineStatus` and renders a thin
 * `Banner` along the top of the viewport while the browser reports it is
 * offline. Auto-disappears the moment connectivity returns — no manual
 * dismiss is required (the banner is purely informational and would be
 * confusing if it lingered after the network came back).
 *
 * Implementation notes:
 *  - We start by treating the `navigator.onLine` "true" state as the
 *    happy path so the banner never flashes during initial hydration.
 *  - A short fade transition (via Tailwind's built-in opacity utilities)
 *    keeps the banner from popping in jarringly. The motion is plain CSS
 *    and respects the reduced-motion override applied globally.
 */

import { useEffect, useState } from 'react';

import { Banner } from '../ui/index.js';
import { useOnlineStatus } from '../../hooks/useOnlineStatus.js';

export function OfflineBanner() {
  const online = useOnlineStatus();
  // Mounted slightly behind the actual signal so a quick blip
  // (offline → online within 200ms during a Wi-Fi handover) doesn't
  // surface a banner that immediately disappears again.
  const [visible, setVisible] = useState(!online);

  useEffect(() => {
    if (online) {
      setVisible(false);
      return undefined;
    }
    const timer = setTimeout(() => setVisible(true), 200);
    return () => clearTimeout(timer);
  }, [online]);

  if (!visible) return null;

  return (
    <Banner variant="warning" icon="WifiOff" role="status">
      You&apos;re offline. Some features may not work until your connection is back.
    </Banner>
  );
}

export default OfflineBanner;
