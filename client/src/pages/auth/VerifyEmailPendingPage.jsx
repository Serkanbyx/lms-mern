/**
 * `VerifyEmailPendingPage` — `/verify-email/pending`.
 *
 * Landing page for the post-register flow and the "didn't get the email"
 * recovery path. Shows the user's address (when authenticated) and a
 * resend button protected by a 60-second client-side cooldown so a
 * panicked user can't click their way past the server-side rate limit.
 *
 * Anonymous visitors (e.g. somebody pasted the URL after closing the
 * browser tab) get a small email field so they can still kick off a
 * resend without signing in. The server returns the same generic envelope
 * regardless of whether the email exists, preserving the no-enumeration
 * guarantee.
 */

import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import { Seo } from '../../components/seo/index.js';
import {
  Alert,
  Button,
  FormField,
  Icon,
  Input,
  toast,
} from '../../components/ui/index.js';
import { useAuth } from '../../context/useAuth.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import * as authService from '../../services/auth.service.js';
import { ROUTES } from '../../utils/constants.js';
import AuthShell from './_AuthShell.jsx';

const RESEND_COOLDOWN_S = 60;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function VerifyEmailPendingPage() {
  useDocumentTitle('Verify your email');
  const { user, isAuthenticated, isEmailVerified } = useAuth();

  const knownEmail = user?.email ?? '';
  const [email, setEmail] = useState(knownEmail);
  const [emailError, setEmailError] = useState('');
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

  if (isAuthenticated && isEmailVerified) {
    return (
      <>
        <Seo title="Email verified" noIndex />
        <AuthShell
          title="You're all set"
          subtitle="Your email is already verified. Jump back into your dashboard whenever you're ready."
        >
          <Button
            as={Link}
            to={ROUTES.dashboard}
            className="w-full"
            size="lg"
            rightIcon={<Icon name="ArrowRight" size={16} />}
          >
            Go to dashboard
          </Button>
        </AuthShell>
      </>
    );
  }

  const handleResend = async (event) => {
    event?.preventDefault();
    if (cooldown > 0 || submitting) return;

    let target = knownEmail;
    if (!isAuthenticated) {
      const trimmed = email.trim();
      if (!trimmed) {
        setEmailError('Email is required.');
        return;
      }
      if (!EMAIL_REGEX.test(trimmed)) {
        setEmailError('Enter a valid email address.');
        return;
      }
      target = trimmed;
      setEmailError('');
    }

    setSubmitting(true);
    try {
      await authService.resendVerification(target);
      toast.success('If your account is unverified, a new link is on the way.');
      setCooldown(RESEND_COOLDOWN_S);
    } catch (err) {
      toast.error(err?.message || 'Could not resend right now. Try again shortly.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Seo title="Verify your email" noIndex />
      <AuthShell
        title="Check your inbox"
        subtitle={
          knownEmail
            ? `We sent a verification link to ${knownEmail}. Click it to activate your account.`
            : 'We sent a verification link to your email. Click it to activate your account.'
        }
        footerLink={
          <>
            Wrong account?{' '}
            <Link
              to={ROUTES.login}
              className="font-medium text-primary hover:underline underline-offset-4"
            >
              Sign in with a different one
            </Link>
          </>
        }
      >
        <div className="space-y-5">
          <Alert variant="info" title="Didn't get the email?">
            Check your spam folder, or click below to send it again. Links
            expire after 24 hours.
          </Alert>

          <form noValidate onSubmit={handleResend} className="flex flex-col gap-4">
            {!isAuthenticated && (
              <FormField label="Email" required error={emailError}>
                {(props) => (
                  <Input
                    {...props}
                    type="email"
                    autoComplete="email"
                    inputMode="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    leadingIcon={<Icon name="Mail" size={18} />}
                  />
                )}
              </FormField>
            )}

            <Button
              type="submit"
              size="lg"
              loading={submitting}
              disabled={cooldown > 0}
              leftIcon={!submitting && <Icon name="MailPlus" size={18} />}
              className="w-full"
            >
              {cooldown > 0
                ? `Resend in ${cooldown}s`
                : 'Resend verification email'}
            </Button>
          </form>
        </div>
      </AuthShell>
    </>
  );
}
