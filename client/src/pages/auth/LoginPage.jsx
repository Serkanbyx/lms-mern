/**
 * `LoginPage` — `/login`.
 *
 * Two-column auth shell with email + password form on the left and brand
 * panel on the right (see `AuthShell`).
 *
 * UX details
 *  - Auto-focus the email field on mount; `Enter` submits the form.
 *  - Inline blur validation for email format and required password.
 *  - Show/hide password via an eye `IconButton` inside the input shell.
 *  - Caps Lock detection on the password field surfaces a `Tooltip`
 *    warning so users don't fail silently.
 *  - "Remember me" is UI only — the JWT TTL is decided by the server.
 *  - Submit shows `loading` state, disables the button, and surfaces
 *    server-side validation in both inline (`error`) and form-level
 *    (`Alert`) form.
 *  - On success: toast + redirect to `?next=` or `/dashboard`.
 */

import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

import {
  Alert,
  Button,
  Checkbox,
  FormField,
  Icon,
  IconButton,
  Input,
  toast,
  Tooltip,
} from '../../components/ui/index.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { ROUTES } from '../../utils/constants.js';
import AuthShell from './_AuthShell.jsx';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const validate = ({ email, password }) => {
  const errors = {};
  if (!email) errors.email = 'Email is required.';
  else if (!EMAIL_REGEX.test(email)) errors.email = 'Enter a valid email address.';
  if (!password) errors.password = 'Password is required.';
  return errors;
};

export default function LoginPage() {
  useDocumentTitle('Log in');

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const emailRef = useRef(null);

  const [values, setValues] = useState({ email: '', password: '' });
  const [touched, setTouched] = useState({});
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [capsOn, setCapsOn] = useState(false);
  const [remember, setRemember] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);

  useEffect(() => {
    emailRef.current?.focus();
  }, []);

  const handleChange = (field) => (event) => {
    const next = { ...values, [field]: event.target.value };
    setValues(next);
    if (touched[field]) {
      setErrors(validate(next));
    }
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
    setTouched({ email: true, password: true });
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    setFormError(null);
    try {
      await login(values.email.trim(), values.password);
      toast.success('Welcome back!');
      const next = new URLSearchParams(location.search).get('next');
      navigate(next || ROUTES.dashboard, { replace: true });
    } catch (err) {
      const message = err?.message || 'Unable to sign in. Please try again.';
      setFormError(message);
      // Map server-provided field errors when present.
      if (err?.details && typeof err.details === 'object') {
        setErrors((prev) => ({ ...prev, ...err.details }));
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to continue learning where you left off."
      footerLink={
        <>
          New to Lumen LMS?{' '}
          <Link
            to={ROUTES.register}
            className="font-medium text-primary hover:underline underline-offset-4"
          >
            Create an account
          </Link>
        </>
      }
    >
      <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-5">
        {formError && (
          <Alert variant="danger" title="Sign in failed">
            {formError}
          </Alert>
        )}

        <FormField
          label="Email"
          required
          error={touched.email ? errors.email : undefined}
        >
          {(props) => (
            <Input
              {...props}
              ref={emailRef}
              type="email"
              autoComplete="email"
              inputMode="email"
              placeholder="you@example.com"
              value={values.email}
              onChange={handleChange('email')}
              onBlur={handleBlur('email')}
              leadingIcon={<Icon name="Mail" size={18} />}
            />
          )}
        </FormField>

        <FormField
          label="Password"
          required
          error={touched.password ? errors.password : undefined}
        >
          {(props) => (
            <Input
              {...props}
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
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
          )}
        </FormField>

        <div className="flex items-center justify-between">
          <Checkbox
            id="auth-remember"
            label="Remember me"
            checked={remember}
            onChange={(event) => setRemember(event.target.checked)}
          />
          <Link
            to={ROUTES.forgotPassword}
            className="text-sm font-medium text-primary hover:underline underline-offset-4"
          >
            Forgot password?
          </Link>
        </div>

        <Button
          type="submit"
          size="lg"
          loading={submitting}
          className="w-full"
          rightIcon={!submitting && <Icon name="ArrowRight" size={18} />}
        >
          Sign in
        </Button>
      </form>
    </AuthShell>
  );
}
