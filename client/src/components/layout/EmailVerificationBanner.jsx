/**
 * `EmailVerificationBanner` — global reminder mounted by `MainLayout`.
 *
 * Renders a thin banner at the very top of every page when a logged-in
 * user has not yet verified their email. Includes a one-click "Resend"
 * action so the user never has to hunt for the verification settings
 * page. The action shares the 60-second client-side cooldown logic with
 * `VerifyEmailPendingPage` so a frustrated user can't burn through the
 * server-side rate limit by hammering the button.
 *
 * Auto-hides for guests, verified users, and on the verification pages
 * themselves (where the same call-to-action would be redundant).
 */

import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';

import { Banner, Button, Icon, toast } from '../ui/index.js';
import { useAuth } from '../../context/useAuth.js';
import * as authService from '../../services/auth.service.js';

const RESEND_COOLDOWN_S = 60;

const HIDE_ON_PATHS = ['/verify-email', '/login', '/register', '/forgot-password', '/reset-password'];

export function EmailVerificationBanner() {
  const { isAuthenticated, isEmailVerified } = useAuth();
  const location = useLocation();
  const [submitting, setSubmitting] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    intervalRef.current = setInterval(() => {
      setCooldown((value) => (value <= 1 ? 0 : value - 1));
    }, 1000);
    return () => clearInterval(intervalRef.current);
  }, [cooldown]);

  if (!isAuthenticated || isEmailVerified) return null;
  if (HIDE_ON_PATHS.some((path) => location.pathname.startsWith(path))) return null;

  const handleResend = async () => {
    if (submitting || cooldown > 0) return;
    setSubmitting(true);
    try {
      await authService.resendVerification();
      toast.success('A new verification link is on the way.');
      setCooldown(RESEND_COOLDOWN_S);
    } catch (err) {
      toast.error(err?.message || 'Could not resend right now. Try again shortly.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Banner
      variant="warning"
      icon="MailWarning"
      action={
        <Button
          size="sm"
          variant="outline"
          loading={submitting}
          disabled={cooldown > 0}
          onClick={handleResend}
          leftIcon={!submitting && <Icon name="Send" size={14} />}
        >
          {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend email'}
        </Button>
      }
    >
      Please verify your email to unlock all features. We sent you a confirmation link.
    </Banner>
  );
}

export default EmailVerificationBanner;
