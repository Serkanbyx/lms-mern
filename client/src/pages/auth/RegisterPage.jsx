/**
 * `RegisterPage` — `/register`.
 *
 * Two-column auth shell with the new-account form on the left and brand
 * panel on the right (see `AuthShell`).
 *
 * UX details
 *  - Auto-focus the name field on mount; `Enter` submits the form.
 *  - Inline blur validation: name required, email format, password rules
 *    (min 8 chars + at least one letter + one digit), confirmation match.
 *  - Show/hide password via an eye `IconButton`. Caps Lock detection on
 *    both password fields surfaces a `Tooltip` warning.
 *  - Live password-strength meter (weak / fair / strong) computed
 *    client-side from length + character classes — purely UX. The server
 *    still enforces the canonical rules.
 *  - Terms-of-Service checkbox (links open in a new tab) gates submit.
 *  - On success: `register()` already auto-logs the user in (it stores the
 *    JWT in `AuthContext`); we toast, mount the post-register
 *    `OnboardingModal`, and only redirect to `?next=` / `/dashboard`
 *    after the modal closes (whether the user finished or skipped).
 *    Persisting the navigation through the modal lifecycle means a
 *    learner who taps "Open course" on the recommendation panel lands
 *    on the course detail page instead of the dashboard.
 *
 * SECURITY: no `role` selector — server defaults new accounts to `student`.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

import { OnboardingModal } from '../../components/onboarding/index.js';
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
import { useAuth } from '../../context/useAuth.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { ROUTES } from '../../utils/constants.js';
import AuthShell from './_AuthShell.jsx';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

/**
 * Score password 0–4 based on length + character class diversity.
 * Returns a labelled bucket the meter component renders directly.
 */
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

const validate = ({ name, email, password, confirmPassword }, { acceptedTerms }) => {
  const errors = {};
  if (!name.trim()) errors.name = 'Your name is required.';
  else if (name.trim().length < 2) errors.name = 'Name is too short.';

  if (!email) errors.email = 'Email is required.';
  else if (!EMAIL_REGEX.test(email)) errors.email = 'Enter a valid email address.';

  if (!password) errors.password = 'Password is required.';
  else if (password.length < MIN_PASSWORD_LENGTH) {
    errors.password = `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  } else if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    errors.password = 'Mix at least one letter and one number.';
  }

  if (!confirmPassword) errors.confirmPassword = 'Please confirm your password.';
  else if (confirmPassword !== password) errors.confirmPassword = 'Passwords do not match.';

  if (!acceptedTerms) errors.terms = 'You must agree to the Terms to continue.';

  return errors;
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
  const segments = [1, 2, 3];

  return (
    <div className="mt-2" aria-live="polite">
      <div className="flex items-center gap-1.5">
        {segments.map((index) => (
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

export default function RegisterPage() {
  useDocumentTitle('Create account');

  const { register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const nameRef = useRef(null);

  const [values, setValues] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [touched, setTouched] = useState({});
  const [errors, setErrors] = useState({});
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [capsOn, setCapsOn] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);
  const [onboarding, setOnboarding] = useState({
    open: false,
    firstName: '',
  });

  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  // Resolve where to send the learner once the onboarding modal closes.
  // Honours the `?next=` redirect contract that protected routes use to
  // bounce users back to where they came from after authenticating.
  const resolveNextDestination = () => {
    const next = new URLSearchParams(location.search).get('next');
    return next || ROUTES.dashboard;
  };

  // Onboarding closes via three paths: (1) the user finishes the flow
  // and clicks "Open course" / "Browse all courses" — both of which are
  // `<Link>`s that have already kicked off a navigation and pass the
  // target in `destination`; (2) "Finish" when no recommendation
  // surfaced; (3) "Skip" or backdrop dismiss. In paths (2) and (3) we
  // navigate to the resolved next destination so the user is never left
  // stranded on a closed-modal Register page; in path (1) we DON'T —
  // overriding it would clobber the in-flight navigation the user
  // explicitly chose.
  const handleOnboardingClose = ({ destination } = {}) => {
    setOnboarding((prev) => ({ ...prev, open: false }));
    if (destination) return;
    navigate(resolveNextDestination(), { replace: true });
  };

  const handleChange = (field) => (event) => {
    const next = { ...values, [field]: event.target.value };
    setValues(next);
    if (touched[field]) {
      setErrors(validate(next, { acceptedTerms }));
    }
  };

  const handleBlur = (field) => () => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    setErrors(validate(values, { acceptedTerms }));
  };

  const handlePasswordKey = (event) => {
    setCapsOn(event.getModifierState?.('CapsLock') === true);
  };

  const handleTermsChange = (event) => {
    const next = event.target.checked;
    setAcceptedTerms(next);
    if (touched.terms) {
      setErrors(validate(values, { acceptedTerms: next }));
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const nextErrors = validate(values, { acceptedTerms });
    setErrors(nextErrors);
    setTouched({
      name: true,
      email: true,
      password: true,
      confirmPassword: true,
      terms: true,
    });
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    setFormError(null);
    try {
      await register(values.name.trim(), values.email.trim(), values.password);
      // The shared welcome toast is intentional even though the modal
      // also greets the user — it acknowledges the form submit
      // independently of the modal that mounts on top.
      toast.success('Welcome to Lumen LMS!');
      const firstName = values.name.trim().split(/\s+/)[0] ?? '';
      setOnboarding({ open: true, firstName });
    } catch (err) {
      const message = err?.message || 'Unable to create your account. Please try again.';
      setFormError(message);
      if (err?.details && typeof err.details === 'object') {
        setErrors((prev) => ({ ...prev, ...err.details }));
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
    <AuthShell
      title="Create your account"
      subtitle="Free forever for learners. No credit card required."
      footerLink={
        <>
          Already have an account?{' '}
          <Link
            to={ROUTES.login}
            className="font-medium text-primary hover:underline underline-offset-4"
          >
            Sign in
          </Link>
        </>
      }
    >
      <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-5">
        {formError && (
          <Alert variant="danger" title="Could not create account">
            {formError}
          </Alert>
        )}

        <FormField
          label="Full name"
          required
          error={touched.name ? errors.name : undefined}
        >
          {(props) => (
            <Input
              {...props}
              ref={nameRef}
              type="text"
              autoComplete="name"
              placeholder="Ada Lovelace"
              value={values.name}
              onChange={handleChange('name')}
              onBlur={handleBlur('name')}
              leadingIcon={<Icon name="User" size={18} />}
            />
          )}
        </FormField>

        <FormField
          label="Email"
          required
          error={touched.email ? errors.email : undefined}
        >
          {(props) => (
            <Input
              {...props}
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
            <>
              <Input
                {...props}
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
          label="Confirm password"
          required
          error={touched.confirmPassword ? errors.confirmPassword : undefined}
        >
          {(props) => (
            <Input
              {...props}
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="••••••••"
              value={values.confirmPassword}
              onChange={handleChange('confirmPassword')}
              onBlur={(event) => {
                handleBlur('confirmPassword')(event);
                setCapsOn(false);
              }}
              onKeyDown={handlePasswordKey}
              onKeyUp={handlePasswordKey}
              leadingIcon={<Icon name="ShieldCheck" size={18} />}
            />
          )}
        </FormField>

        {/* The Checkbox renders its own wrapping <label>, so we keep the
            terms copy outside it and use a real <label htmlFor> on the
            "I agree" prefix. That avoids nesting the policy <a> tags
            inside an interactive label. */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-start gap-2.5">
            <Checkbox
              id="auth-terms"
              checked={acceptedTerms}
              onChange={handleTermsChange}
            />
            <p className="text-sm text-text leading-snug">
              <label htmlFor="auth-terms" className="cursor-pointer">
                I agree to the{' '}
              </label>
              <Link
                to={ROUTES.terms}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-primary hover:underline underline-offset-4"
              >
                Terms of Service
              </Link>{' '}
              and{' '}
              <Link
                to={ROUTES.privacy}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-primary hover:underline underline-offset-4"
              >
                Privacy Policy
              </Link>
              .
            </p>
          </div>
          {touched.terms && errors.terms && (
            <p className="text-xs text-danger ml-7" role="alert">
              {errors.terms}
            </p>
          )}
        </div>

        <Button
          type="submit"
          size="lg"
          loading={submitting}
          className="w-full"
          rightIcon={!submitting && <Icon name="ArrowRight" size={18} />}
        >
          Create account
        </Button>
      </form>
    </AuthShell>

    <OnboardingModal
      open={onboarding.open}
      firstName={onboarding.firstName}
      onClose={handleOnboardingClose}
    />
    </>
  );
}
