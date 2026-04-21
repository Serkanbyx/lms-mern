/**
 * `OfflineGate` — wraps a single interactive child (typically a `Button`)
 * so it becomes inert while the browser reports the device is offline.
 *
 * Use this around any control whose only job is to talk to the API:
 *
 *   <OfflineGate>
 *     <Button onClick={save}>Save</Button>
 *   </OfflineGate>
 *
 * Behaviour while offline:
 *  - The child is cloned with `disabled={true}` (works for `Button`,
 *    `IconButton`, native `<button>`).
 *  - A `Tooltip` explains why so the user doesn't think the button is
 *    just stuck.
 *  - Online → the child is rendered untouched (zero overhead, no extra
 *    DOM wrapper).
 *
 * Local-only actions (closing a modal, toggling a tab) should NOT be
 * wrapped — the user can keep using the offline-safe parts of the app.
 */

import { cloneElement, isValidElement } from 'react';

import { useOnlineStatus } from '../../hooks/useOnlineStatus.js';
import { Tooltip } from '../ui/Tooltip.jsx';

export function OfflineGate({
  children,
  message = 'You are offline. Reconnect to continue.',
  side = 'top',
}) {
  const online = useOnlineStatus();

  if (online || !isValidElement(children)) {
    return children;
  }

  return (
    <Tooltip content={message} side={side}>
      {cloneElement(children, {
        disabled: true,
        'aria-disabled': true,
      })}
    </Tooltip>
  );
}

export default OfflineGate;
