/**
 * `VerifyEmailPage` — `/verify-email/:token`.
 *
 * Auto-submits the token from the URL the moment the page mounts so the
 * user only sees the result (success / expired / already verified) and
 * never has to click through an extra "Confirm" button.
 *
 * State machine:
 *   - "loading"     → calling the API
 *   - "success"     → email verified; CTA to dashboard or login
 *   - "error"       → invalid / expired link; CTA to resend
 *
 * SECURITY: the raw token is passed straight to the API and never logged
 * or stored locally beyond the URL itself.
 */

import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { Seo } from '../../components/seo/index.js';
import { Button, Icon, Spinner } from '../../components/ui/index.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import * as authService from '../../services/auth.service.js';
import { ROUTES } from '../../utils/constants.js';
import AuthShell from './_AuthShell.jsx';

export default function VerifyEmailPage() {
  useDocumentTitle('Verify email');
  const { token } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated, refreshUser } = useAuth();

  const [status, setStatus] = useState('loading');
  const [message, setMessage] = useState('');
  // StrictMode mounts effects twice in dev; this guard stops a double API hit.
  const submittedRef = useRef(false);

  useEffect(() => {
    if (submittedRef.current) return;
    submittedRef.current = true;

    let cancelled = false;
    const verify = async () => {
      try {
        await authService.verifyEmail(token);
        if (cancelled) return;
        setStatus('success');
        setMessage('Your email is verified. You can dive into your courses now.');
        if (isAuthenticated) refreshUser();
      } catch (err) {
        if (cancelled) return;
        setStatus('error');
        setMessage(err?.message || 'Verification link is invalid or has expired.');
      }
    };
    verify();

    return () => {
      cancelled = true;
    };
  }, [token, isAuthenticated, refreshUser]);

  const renderBody = () => {
    if (status === 'loading') {
      return (
        <div className="flex flex-col items-center text-center py-8 gap-4">
          <Spinner size="md" />
          <p className="text-sm text-text-muted">Verifying your email…</p>
        </div>
      );
    }
    if (status === 'success') {
      return (
        <div className="flex flex-col items-center text-center gap-5 py-4">
          <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-success/10 text-success">
            <Icon name="CheckCircle2" size={28} />
          </span>
          <p className="text-sm text-text-muted max-w-sm">{message}</p>
          <Button
            onClick={() =>
              navigate(isAuthenticated ? ROUTES.dashboard : ROUTES.login, {
                replace: true,
              })
            }
            rightIcon={<Icon name="ArrowRight" size={16} />}
            className="w-full"
            size="lg"
          >
            {isAuthenticated ? 'Go to dashboard' : 'Sign in to continue'}
          </Button>
        </div>
      );
    }
    return (
      <div className="flex flex-col items-center text-center gap-5 py-4">
        <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-danger/10 text-danger">
          <Icon name="AlertOctagon" size={28} />
        </span>
        <p className="text-sm text-text-muted max-w-sm">{message}</p>
        <div className="flex flex-col sm:flex-row gap-3 w-full">
          <Button
            as={Link}
            to={ROUTES.verifyEmailPending}
            variant="secondary"
            className="flex-1"
            leftIcon={<Icon name="MailPlus" size={16} />}
          >
            Resend verification
          </Button>
          <Button
            as={Link}
            to={ROUTES.login}
            className="flex-1"
            rightIcon={<Icon name="ArrowRight" size={16} />}
          >
            Back to sign in
          </Button>
        </div>
      </div>
    );
  };

  return (
    <>
      <Seo title="Verify email" noIndex />
      <AuthShell
        title="Email verification"
        subtitle="Confirming your account so we can keep it secure."
      >
        {renderBody()}
      </AuthShell>
    </>
  );
}
