/**
 * `OnboardingModal` — first-time experience after `/register` completes.
 *
 * Three guided steps that translate a brand-new account into a first
 * concrete next action:
 *   1. Welcome     — friendly hello with the account first name + brand mark.
 *   2. Interests   — multi-select chips (mapped 1:1 to course categories) so
 *                    the platform learns what to recommend without forcing
 *                    a long form.
 *   3. First course — pick the most popular published course in the user's
 *                    primary interest (falls back to the global most-popular
 *                    list if the user skipped interests). Surfaces a single
 *                    `CourseCard` plus a "Browse all courses" CTA.
 *
 * Behaviour rules:
 *   - A persistent "Skip for now" button lives in every step's footer so a
 *     learner can always escape — onboarding must never feel like a wall.
 *   - Both "Finish" and "Skip" stamp `preferences.onboardingCompletedAt`
 *     server-side via `PreferencesContext` so the flow doesn't re-trigger
 *     on the next login from a different device.
 *   - Modal is sized `lg` and uses an internal `<motion>` stage to keep
 *     step transitions feeling instant without a layout shift. The shared
 *     `Modal` primitive already handles focus-trap, scroll-lock and Esc.
 *
 * Render contract: the parent (currently `RegisterPage`) owns the `open`
 * boolean. We never read `auth.user` directly — the parent passes
 * `firstName` so we stay testable in the styleguide / Storybook.
 *
 * Navigation contract: `onClose({ skipped, interests, destination })` is
 * fired on every exit path. The optional `destination` field tells the
 * parent the user has already been routed elsewhere (e.g. the
 * recommended course page) so it should NOT issue its default redirect
 * to `/dashboard` and clobber the in-flight navigation.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import { CourseCard, CourseCardSkeleton } from '../course/index.js';
import { Logo } from '../brand/index.js';
import {
  Alert,
  Badge,
  Button,
  Icon,
  Modal,
  toast,
} from '../ui/index.js';
import { usePreferences } from '../../context/PreferencesContext.jsx';
import { listCourses } from '../../services/course.service.js';
import { LEARNING_INTERESTS, ROUTES } from '../../utils/constants.js';
import { cn } from '../../utils/cn.js';

const TOTAL_STEPS = 3;

const RECOMMENDATION_LIMIT = 1;

/* -------------------------------------------------------------------------- */
/*  Step 1 — Welcome                                                          */
/* -------------------------------------------------------------------------- */

function WelcomeStep({ firstName }) {
  return (
    <div className="flex flex-col items-center text-center py-4">
      <div
        aria-hidden="true"
        className="relative mb-6 inline-flex h-24 w-24 items-center justify-center rounded-3xl
          bg-gradient-to-br from-primary/20 via-info/15 to-bg-muted"
      >
        <Logo variant="mark" size={56} className="text-primary" decorative />
        <span
          className="absolute -bottom-2 -right-2 inline-flex h-9 w-9 items-center
            justify-center rounded-full bg-bg ring-2 ring-bg shadow-md text-warning"
        >
          <Icon name="Sparkles" size={18} />
        </span>
      </div>

      <h3 className="text-2xl font-semibold tracking-tight text-text">
        Welcome to Lumen LMS{firstName ? `, ${firstName}` : ''}!
      </h3>
      <p className="mt-3 max-w-md text-sm text-text-muted">
        Let&apos;s personalise your home screen in under a minute. We&apos;ll ask
        what you&apos;re excited to learn, then suggest a great place to start.
      </p>

      <ul className="mt-6 grid w-full max-w-md gap-2.5 text-left">
        {[
          { icon: 'Target', label: 'Pick the topics you care about' },
          { icon: 'BookOpen', label: 'Get a tailored first-course suggestion' },
          { icon: 'Settings2', label: 'Tweak preferences any time in Settings' },
        ].map((item) => (
          <li
            key={item.label}
            className="flex items-center gap-3 rounded-xl border border-border bg-bg-subtle px-4 py-3"
          >
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Icon name={item.icon} size={16} />
            </span>
            <span className="text-sm text-text">{item.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Step 2 — Interests                                                        */
/* -------------------------------------------------------------------------- */

function InterestsStep({ interests, onToggle }) {
  return (
    <div className="py-2">
      <header className="text-center">
        <h3 className="text-xl font-semibold text-text">
          What brings you here?
        </h3>
        <p className="mt-1.5 text-sm text-text-muted">
          Pick a few topics — we&apos;ll prioritise them across the catalog and
          recommendations.
        </p>
      </header>

      <ul
        role="list"
        className="mt-6 grid grid-cols-2 gap-2.5 sm:grid-cols-3"
      >
        {LEARNING_INTERESTS.map((interest) => {
          const selected = interests.includes(interest.value);
          return (
            <li key={interest.value}>
              <button
                type="button"
                role="checkbox"
                aria-checked={selected}
                onClick={() => onToggle(interest.value)}
                className={cn(
                  'group relative w-full rounded-xl border p-4 text-left transition-all',
                  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
                  selected
                    ? 'border-primary bg-primary/5 shadow-xs'
                    : 'border-border bg-bg hover:border-border-strong hover:bg-bg-subtle',
                )}
              >
                <span
                  className={cn(
                    'inline-flex h-9 w-9 items-center justify-center rounded-lg transition-colors',
                    selected ? 'bg-primary text-primary-fg' : 'bg-bg-muted text-text-muted',
                  )}
                >
                  <Icon name={interest.icon} size={18} />
                </span>
                <p className="mt-3 text-sm font-medium text-text">
                  {interest.label}
                </p>
                {selected && (
                  <span
                    aria-hidden="true"
                    className="absolute right-2.5 top-2.5 inline-flex h-5 w-5 items-center
                      justify-center rounded-full bg-primary text-primary-fg"
                  >
                    <Icon name="Check" size={12} />
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      <p className="mt-4 text-center text-xs text-text-subtle">
        {interests.length === 0
          ? 'You can always change these later in Settings.'
          : `${interests.length} topic${interests.length === 1 ? '' : 's'} selected`}
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Step 3 — First course recommendation                                      */
/* -------------------------------------------------------------------------- */

function FirstCourseStep({ interests, recommendation }) {
  const { status, course, error } = recommendation;
  const primaryInterest = interests[0]
    ? LEARNING_INTERESTS.find((entry) => entry.value === interests[0])
    : null;

  return (
    <div className="py-2">
      <header className="text-center">
        <h3 className="text-xl font-semibold text-text">
          {primaryInterest
            ? `A great place to start in ${primaryInterest.label}`
            : 'A great place to start'}
        </h3>
        <p className="mt-1.5 text-sm text-text-muted">
          {primaryInterest
            ? "Here's the most loved course in that topic. Open it now or browse the full catalog."
            : "Here's one of the most loved courses on Lumen. Open it now or browse the full catalog."}
        </p>
      </header>

      <div className="mt-6">
        {status === 'loading' && <CourseCardSkeleton />}

        {status === 'error' && (
          <Alert variant="warning" title="Couldn't load a recommendation">
            {error ?? 'No worries — head straight to the catalog instead.'}
          </Alert>
        )}

        {status === 'ready' && course && (
          <div className="mx-auto max-w-md">
            <Badge
              variant="primary"
              leftIcon={<Icon name="Sparkles" size={12} />}
              className="mb-3"
            >
              Recommended for you
            </Badge>
            <CourseCard course={course} />
          </div>
        )}

        {status === 'ready' && !course && (
          <div className="rounded-xl border border-dashed border-border bg-bg-subtle p-6 text-center">
            <Icon
              name="Compass"
              size={28}
              className="mx-auto text-text-subtle"
            />
            <p className="mt-3 text-sm text-text">
              No matching courses just yet — but the catalog is the best place
              to explore.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  ProgressDots                                                              */
/* -------------------------------------------------------------------------- */

function ProgressDots({ current, total }) {
  return (
    <ol
      role="list"
      aria-label={`Step ${current} of ${total}`}
      className="flex items-center justify-center gap-2"
    >
      {Array.from({ length: total }).map((_, index) => {
        const stepIndex = index + 1;
        const reached = stepIndex <= current;
        return (
          // eslint-disable-next-line react/no-array-index-key
          <li key={index}>
            <span
              aria-hidden="true"
              className={cn(
                'block h-1.5 rounded-full transition-all duration-300',
                stepIndex === current
                  ? 'w-8 bg-primary'
                  : reached
                    ? 'w-2 bg-primary/60'
                    : 'w-2 bg-bg-muted',
              )}
            />
          </li>
        );
      })}
    </ol>
  );
}

/* -------------------------------------------------------------------------- */
/*  OnboardingModal                                                           */
/* -------------------------------------------------------------------------- */

export function OnboardingModal({ open, onClose, firstName }) {
  const { updatePreference } = usePreferences();

  const [step, setStep] = useState(1);
  const [interests, setInterests] = useState([]);
  const [recommendation, setRecommendation] = useState({
    status: 'idle',
    course: null,
    error: null,
  });
  const [submitting, setSubmitting] = useState(false);

  // Reset internal state every time the modal opens so re-mounting on a
  // second registration in the same browser tab never inherits stale data.
  useEffect(() => {
    if (open) {
      setStep(1);
      setInterests([]);
      setRecommendation({ status: 'idle', course: null, error: null });
      setSubmitting(false);
    }
  }, [open]);

  const toggleInterest = (value) => {
    setInterests((prev) =>
      prev.includes(value) ? prev.filter((entry) => entry !== value) : [...prev, value],
    );
  };

  // Out-of-order guard for the recommendation fetch — the user can flip
  // back to step 2, change interests and reach step 3 again before the
  // first request resolved. Only the latest fetch wins.
  const recommendRequestId = useRef(0);

  useEffect(() => {
    if (!open || step !== 3) return;

    recommendRequestId.current += 1;
    const myId = recommendRequestId.current;
    setRecommendation({ status: 'loading', course: null, error: null });

    const params = { sort: 'popular', page: 1, limit: RECOMMENDATION_LIMIT };
    if (interests[0]) params.category = interests[0];

    listCourses(params)
      .then((payload) => {
        if (myId !== recommendRequestId.current) return;
        const items = payload?.data?.items ?? payload?.items ?? [];
        setRecommendation({
          status: 'ready',
          course: items[0] ?? null,
          error: null,
        });
      })
      .catch((error) => {
        if (myId !== recommendRequestId.current) return;
        setRecommendation({
          status: 'error',
          course: null,
          error: error?.message ?? 'Could not load a recommendation right now.',
        });
      });
  }, [open, step, interests]);

  const persistAndClose = async ({ skipped, destination = null }) => {
    if (submitting) return;
    setSubmitting(true);
    try {
      // PreferencesContext debounces writes to the server; surfacing both
      // mutations through it (instead of a raw axios call) keeps the
      // optimistic state in lockstep with what the navbar / settings see.
      if (!skipped && interests.length > 0) {
        updatePreference('interests', interests);
      }
      updatePreference('onboardingCompletedAt', new Date().toISOString());

      if (!skipped) {
        toast.success("You're all set — happy learning!");
      }
      onClose?.({ skipped, interests, destination });
    } finally {
      setSubmitting(false);
    }
  };

  const stepTitle = useMemo(() => {
    if (step === 1) return 'Welcome aboard';
    if (step === 2) return 'Tell us what you love';
    return 'Your first course';
  }, [step]);

  const recommendedHref = recommendation.course?.slug
    ? ROUTES.courseDetail(recommendation.course.slug)
    : null;

  return (
    <Modal
      open={open}
      // Backdrop / Esc dismissal counts as "skip" so we still mark the
      // flow complete — otherwise the user would see this modal forever.
      onClose={() => persistAndClose({ skipped: true })}
      size="lg"
      showCloseButton={false}
      title={stepTitle}
      description={`Step ${step} of ${TOTAL_STEPS}`}
      footer={
        <div className="flex w-full items-center justify-between gap-3">
          <Button
            variant="ghost"
            onClick={() => persistAndClose({ skipped: true })}
            disabled={submitting}
          >
            Skip for now
          </Button>

          <div className="flex items-center gap-2">
            {step > 1 && (
              <Button
                variant="outline"
                onClick={() => setStep((current) => current - 1)}
                disabled={submitting}
                leftIcon={<Icon name="ArrowLeft" size={16} />}
              >
                Back
              </Button>
            )}

            {step < TOTAL_STEPS && (
              <Button
                onClick={() => setStep((current) => current + 1)}
                disabled={submitting}
                rightIcon={<Icon name="ArrowRight" size={16} />}
              >
                {step === 1 ? "Let's go" : 'Continue'}
              </Button>
            )}

            {step === TOTAL_STEPS && (
              <>
                <Link to={ROUTES.catalog}>
                  <Button
                    variant="outline"
                    onClick={() =>
                      persistAndClose({
                        skipped: false,
                        destination: ROUTES.catalog,
                      })
                    }
                    disabled={submitting}
                  >
                    Browse all courses
                  </Button>
                </Link>
                {recommendedHref ? (
                  <Link to={recommendedHref}>
                    <Button
                      onClick={() =>
                        persistAndClose({
                          skipped: false,
                          destination: recommendedHref,
                        })
                      }
                      loading={submitting}
                      rightIcon={<Icon name="ArrowRight" size={16} />}
                    >
                      Open course
                    </Button>
                  </Link>
                ) : (
                  <Button
                    onClick={() => persistAndClose({ skipped: false })}
                    loading={submitting}
                  >
                    Finish
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-6">
        <ProgressDots current={step} total={TOTAL_STEPS} />

        {step === 1 && <WelcomeStep firstName={firstName} />}
        {step === 2 && (
          <InterestsStep interests={interests} onToggle={toggleInterest} />
        )}
        {step === 3 && (
          <FirstCourseStep
            interests={interests}
            recommendation={recommendation}
          />
        )}
      </div>
    </Modal>
  );
}

export default OnboardingModal;
