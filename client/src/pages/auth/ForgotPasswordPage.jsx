/**
 * `ForgotPasswordPage` — `/forgot-password`.
 *
 * UX:
 *  - Single email input. On submit the API ALWAYS returns 200 + a generic
 *    "if an account exists…" message regardless of whether the email is
 *    registered. Mirroring that on the client (no error states based on
 *    existence) closes the user-enumeration loophole on the front end too.
 *  - Once the request resolves we swap the form for a confirmation panel
 *    so the user gets unambiguous feedback that the request has landed.
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
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import * as authService from '../../services/auth.service.js';
import { ROUTES } from '../../utils/constants.js';
import AuthShell from './_AuthShell.jsx';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ForgotPasswordPage() {
  useDocumentTitle('Forgot password');

  const emailRef = useRef(null);
  const [email, setEmail] = useState('');
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submittedFor, setSubmittedFor] = useState('');

  useEffect(() => {
    emailRef.current?.focus();
  }, []);

  const validate = (value) => {
    if (!value) return 'Email is required.';
    if (!EMAIL_REGEX.test(value)) return 'Enter a valid email address.';
    return '';
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setTouched(true);
    const validation = validate(email);
    setError(validation);
    if (validation) return;

    setSubmitting(true);
    try {
      await authService.forgotPassword(email.trim());
      setSubmittedFor(email.trim());
      toast.success('If an account exists, a reset link is on its way.');
    } catch (err) {
      // Server-side validation / rate-limit failures are the only branches
      // that reach here — actual existence is never leaked.
      const message = err?.message || 'Could not request a reset right now.';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Seo title="Forgot password" noIndex />
      <AuthShell
        title={submittedFor ? 'Check your email' : 'Forgot your password?'}
        subtitle={
          submittedFor
            ? `If an account exists for ${submittedFor}, you'll receive a password reset link shortly.`
            : 'Enter the email associated with your account and we\u2019ll send you a reset link.'
        }
        footerLink={
          <>
            Remembered it?{' '}
            <Link
              to={ROUTES.login}
              className="font-medium text-primary hover:underline underline-offset-4"
            >
              Back to sign in
            </Link>
          </>
        }
      >
        {submittedFor ? (
          <div className="space-y-5">
            <Alert variant="success" title="Reset link sent">
              The link expires in 15 minutes. Be sure to check your spam folder
              if you don&apos;t see it within a couple of minutes.
            </Alert>

            <div className="flex gap-3">
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setSubmittedFor('');
                  setEmail('');
                }}
                leftIcon={<Icon name="RotateCcw" size={16} />}
              >
                Try a different email
              </Button>
              <Button
                as={Link}
                to={ROUTES.login}
                rightIcon={<Icon name="ArrowRight" size={16} />}
              >
                Back to sign in
              </Button>
            </div>
          </div>
        ) : (
          <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-5">
            <FormField label="Email" required error={touched ? error : undefined}>
              {(props) => (
                <Input
                  {...props}
                  ref={emailRef}
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  onBlur={() => {
                    setTouched(true);
                    setError(validate(email));
                  }}
                  leadingIcon={<Icon name="Mail" size={18} />}
                />
              )}
            </FormField>

            <Button
              type="submit"
              size="lg"
              loading={submitting}
              className="w-full"
              rightIcon={!submitting && <Icon name="ArrowRight" size={18} />}
            >
              Send reset link
            </Button>
          </form>
        )}
      </AuthShell>
    </>
  );
}
