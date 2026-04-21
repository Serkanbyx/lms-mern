/**
 * `ResetPasswordPage` — `/reset-password/:token`.
 *
 * UX:
 *  - Two password inputs (new + confirm) with the same strength meter
 *    used on `/register`.
 *  - On success the user is bounced to `/login` with a toast — we do NOT
 *    auto-login because the server bumps `tokenVersion` on reset and the
 *    fresh login confirms the new credentials work end-to-end.
 *  - Expired / invalid token responses are surfaced inline along with a
 *    quick path back to "Request a new link".
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { Seo } from '../../components/seo/index.js';
import {
  Alert,
  Button,
  FormField,
  Icon,
  IconButton,
  Input,
  toast,
  Tooltip,
} from '../../components/ui/index.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import * as authService from '../../services/auth.service.js';
import { ROUTES } from '../../utils/constants.js';
import AuthShell from './_AuthShell.jsx';

const MIN_PASSWORD_LENGTH = 8;

const scorePassword = (value) => {
  if (!value) return { score: 0, label: '', tone: 'muted' };
  let score = 0;
  if (value.length >= MIN_PASSWORD_LENGTH) score += 1;
  if (value.length >= 12) score += 1;
  if (/[A-Z]/.test(value) && /[a-z]/.test(value)) score += 1;
  if (/\d/.test(value)) score += 1;
  if (/[^A-Za-z0-9]/.test(value)) score += 1;
  if (score <= 2) return { score: 1, label: 'Weak', tone: 'danger' };
  if (score === 3) return { score: 2, label: 'Fair', tone: 'warning' };
  return { score: 3, label: 'Strong', tone: 'success' };
};

const TONE_BAR = {
  muted: 'bg-bg-muted',
  danger: 'bg-danger',
  warning: 'bg-warning',
  success: 'bg-success',
};

const TONE_TEXT = {
  muted: 'text-text-subtle',
  danger: 'text-danger',
  warning: 'text-warning',
  success: 'text-success',
};

const StrengthMeter = ({ password }) => {
  const meta = useMemo(() => scorePassword(password), [password]);
  return (
    <div className="mt-2" aria-live="polite">
      <div className="flex items-center gap-1.5">
        {[1, 2, 3].map((index) => (
          <span
            key={index}
            className={`h-1 flex-1 rounded-full transition-colors ${
              index <= meta.score ? TONE_BAR[meta.tone] : 'bg-bg-muted'
            }`}
          />
        ))}
        {meta.label && (
          <span className={`ml-1 text-xs font-medium ${TONE_TEXT[meta.tone]}`}>
            {meta.label}
          </span>
        )}
      </div>
      <p className="mt-1 text-xs text-text-subtle">
        At least {MIN_PASSWORD_LENGTH} characters with letters and numbers.
      </p>
    </div>
  );
};

const validate = ({ password, confirm }) => {
  const errors = {};
  if (!password) errors.password = 'Password is required.';
  else if (password.length < MIN_PASSWORD_LENGTH) {
    errors.password = `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  } else if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    errors.password = 'Mix at least one letter and one number.';
  }
  if (!confirm) errors.confirm = 'Please confirm your password.';
  else if (confirm !== password) errors.confirm = 'Passwords do not match.';
  return errors;
};

export default function ResetPasswordPage() {
  useDocumentTitle('Reset password');
  const { token } = useParams();
  const navigate = useNavigate();
  const passwordRef = useRef(null);

  const [values, setValues] = useState({ password: '', confirm: '' });
  const [touched, setTouched] = useState({});
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [capsOn, setCapsOn] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);

  useEffect(() => {
    passwordRef.current?.focus();
  }, []);

  const handleChange = (field) => (event) => {
    const next = { ...values, [field]: event.target.value };
    setValues(next);
    if (touched[field]) setErrors(validate(next));
  };

  const handleBlur = (field) => () => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    setErrors(validate(values));
  };

  const handlePasswordKey = (event) => {
    setCapsOn(event.getModifierState?.('CapsLock') === true);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const nextErrors = validate(values);
    setErrors(nextErrors);
    setTouched({ password: true, confirm: true });
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    setFormError(null);
    try {
      await authService.resetPassword({ token, password: values.password });
      toast.success('Password reset. Please sign in with your new password.');
      navigate(ROUTES.login, { replace: true });
    } catch (err) {
      const message = err?.message || 'Could not reset your password.';
      setFormError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Seo title="Reset password" noIndex />
      <AuthShell
        title="Choose a new password"
        subtitle="Make it something memorable but hard to guess. Once reset, every other device will be signed out."
        footerLink={
          <>
            Need a new link?{' '}
            <Link
              to={ROUTES.forgotPassword}
              className="font-medium text-primary hover:underline underline-offset-4"
            >
              Request another reset
            </Link>
          </>
        }
      >
        <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-5">
          {formError && (
            <Alert variant="danger" title="Couldn't reset password">
              {formError}
            </Alert>
          )}

          <FormField
            label="New password"
            required
            error={touched.password ? errors.password : undefined}
          >
            {(props) => (
              <>
                <Input
                  {...props}
                  ref={passwordRef}
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="••••••••"
                  value={values.password}
                  onChange={handleChange('password')}
                  onBlur={(event) => {
                    handleBlur('password')(event);
                    setCapsOn(false);
                  }}
                  onKeyDown={handlePasswordKey}
                  onKeyUp={handlePasswordKey}
                  leadingIcon={<Icon name="Lock" size={18} />}
                  trailingIcon={
                    <span className="flex items-center gap-1">
                      {capsOn && (
                        <Tooltip content="Caps Lock is on" side="top">
                          <span
                            className="inline-flex items-center justify-center
                              h-6 w-6 rounded-md text-warning"
                            aria-label="Caps Lock is on"
                          >
                            <Icon name="ArrowBigUp" size={16} />
                          </span>
                        </Tooltip>
                      )}
                      <IconButton
                        type="button"
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        onClick={() => setShowPassword((value) => !value)}
                        className="h-8 w-8"
                      >
                        <Icon name={showPassword ? 'EyeOff' : 'Eye'} size={16} />
                      </IconButton>
                    </span>
                  }
                />
                <StrengthMeter password={values.password} />
              </>
            )}
          </FormField>

          <FormField
            label="Confirm new password"
            required
            error={touched.confirm ? errors.confirm : undefined}
          >
            {(props) => (
              <Input
                {...props}
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="••••••••"
                value={values.confirm}
                onChange={handleChange('confirm')}
                onBlur={handleBlur('confirm')}
                leadingIcon={<Icon name="ShieldCheck" size={18} />}
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
            Reset password
          </Button>
        </form>
      </AuthShell>
    </>
  );
}
