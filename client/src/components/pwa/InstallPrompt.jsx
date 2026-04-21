/**
 * `InstallPrompt` — non-intrusive "Install Lumen" banner.
 *
 * Why a custom banner instead of letting Chrome show the mini-infobar?
 *  - We get to pick the moment (after meaningful engagement, never on
 *    first paint) and the wording so it matches our brand voice.
 *  - We can suppress the prompt entirely on iOS, which doesn't fire the
 *    `beforeinstallprompt` event but supports "Add to Home Screen" via
 *    Safari share menu (a future enhancement could surface a tip).
 *
 * Visibility heuristic (`utils/pwa.js`):
 *  - Hidden in `display-mode: standalone` (already installed).
 *  - Hidden if the user dismissed in the last 30 days.
 *  - Shown only after the 2nd visit OR after the first enrollment.
 *
 * Lifecycle:
 *  1. We always preventDefault the `beforeinstallprompt` event so the
 *     browser doesn't surface its own UI; we stash the event for later.
 *  2. When the heuristic flips to "ready", we render a `<Banner>`.
 *  3. "Install app" calls `prompt.prompt()`, awaits the choice, then
 *     dismisses regardless of outcome (Chrome only fires the event
 *     once per session — there's no point re-showing it).
 *  4. "Maybe later" records the dismissal (30-day cooldown).
 *  5. `appinstalled` clears the prompt and hides the banner.
 */

import { useEffect, useRef, useState } from 'react';

import { Banner, Button } from '../ui/index.js';
import {
  dismissInstallPrompt,
  isStandaloneDisplay,
  recordPwaVisit,
  shouldOfferInstall,
} from '../../utils/pwa.js';

const RECHECK_INTERVAL_MS = 1000;

export function InstallPrompt() {
  const deferredPromptRef = useRef(null);
  const [hasPrompt, setHasPrompt] = useState(false);
  const [eligible, setEligible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // 1. Count the visit exactly once per session and run an initial gate
  //    check. We re-check on a short interval because enrollment can
  //    flip the gate mid-session without remounting the layout.
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    if (isStandaloneDisplay()) return undefined;

    recordPwaVisit();
    setEligible(shouldOfferInstall());

    const interval = window.setInterval(() => {
      setEligible((prev) => {
        const next = shouldOfferInstall();
        return prev === next ? prev : next;
      });
    }, RECHECK_INTERVAL_MS);

    return () => window.clearInterval(interval);
  }, []);

  // 2. Stash the install prompt as soon as the browser offers it.
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const onBeforeInstallPrompt = (event) => {
      event.preventDefault();
      deferredPromptRef.current = event;
      setHasPrompt(true);
    };

    const onInstalled = () => {
      deferredPromptRef.current = null;
      setHasPrompt(false);
      setDismissed(true);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const handleInstall = async () => {
    const deferred = deferredPromptRef.current;
    if (!deferred) return;
    try {
      await deferred.prompt();
      // Some browsers reject the choice promise; we still want to dismiss
      // because Chrome only fires `beforeinstallprompt` once per session.
      await deferred.userChoice.catch(() => null);
    } catch {
      // User-gesture timing or third-party blockers — fall through to
      // dismissal so the banner doesn't get stuck on screen.
    } finally {
      deferredPromptRef.current = null;
      setHasPrompt(false);
      setDismissed(true);
    }
  };

  const handleDismiss = () => {
    dismissInstallPrompt();
    setDismissed(true);
  };

  if (dismissed || !eligible || !hasPrompt) return null;

  return (
    <Banner
      variant="primary"
      icon="Download"
      onDismiss={handleDismiss}
      action={
        <Button size="sm" variant="primary" onClick={handleInstall}>
          Install app
        </Button>
      }
    >
      <span className="font-medium">Install Lumen on your device</span>
      <span className="hidden sm:inline text-text-muted">
        {' '}
        — faster launch, offline access, full-screen learning.
      </span>
    </Banner>
  );
}

export default InstallPrompt;
