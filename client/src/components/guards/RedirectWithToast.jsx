/**
 * `RedirectWithToast` — tiny helper used by the auth/role guards.
 *
 * Why it exists:
 *   Guards need to (a) bounce the user away from a route they cannot
 *   access and (b) explain *why* with a toast. Calling `toast.*`
 *   directly in a guard's render path is a footgun: under React 18
 *   `StrictMode` the render runs twice in development, so the toast
 *   would double-fire. Wrapping the side-effect in `useEffect` (with a
 *   dedupe key) keeps it to one toast per redirect, regardless of how
 *   many times React renders the guard.
 *
 * Usage:
 *   return (
 *     <RedirectWithToast
 *       to={ROUTES.home}
 *       message="Enroll to access this lesson"
 *       variant="info"
 *     />
 *   );
 */

import { useEffect, useRef } from 'react';
import { Navigate } from 'react-router-dom';

import { toast } from '../ui/index.js';

const VARIANTS = new Set(['success', 'error', 'info']);

export function RedirectWithToast({
  to,
  message,
  variant = 'info',
  replace = true,
  state,
}) {
  const firedRef = useRef(false);

  useEffect(() => {
    if (firedRef.current || !message) return;
    firedRef.current = true;
    const fn = VARIANTS.has(variant) ? toast[variant] : toast.info;
    fn(message);
  }, [message, variant]);

  return <Navigate to={to} replace={replace} state={state} />;
}

export default RedirectWithToast;
