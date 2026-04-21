/**
 * `EnrollmentCard` — sticky purchase / continue-learning panel.
 *
 * Lives in the right column on desktop (sticks beneath the navbar as
 * the user scrolls the body) and collapses to a fixed bar pinned to
 * the bottom of the viewport on mobile so the primary CTA is always
 * one tap away.
 *
 * The CTA is context-aware:
 *   1. Anonymous visitor → "Sign up to enroll" (deep-links back to
 *      this page after registration).
 *   2. Authenticated, not enrolled → "Enroll – $X" or "Enroll for
 *      free", which fires `onEnroll` and lets the parent surface the
 *      success toast + refresh enrollment state.
 *   3. Enrolled  → "Continue learning" with a slim progress bar.
 *   4. Course owner → "Edit course" jumps into the authoring shell.
 *
 * The thumbnail is a real `<button>` when `previewLesson` is supplied
 * so keyboard users can launch the preview player without reaching
 * for a separate "Preview" link.
 */

import { Link } from 'react-router-dom';

import { Button, Icon, ProgressBar } from '../ui/index.js';
import { ROUTES } from '../../utils/constants.js';

const formatPrice = (price) => {
  const numeric = Number(price);
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(numeric);
};

const INCLUSIONS = (course) => {
  const lessons = course?.totalLessons ?? 0;
  const items = [
    { icon: 'PlayCircle', label: `${lessons} on-demand video lessons` },
    { icon: 'FileText', label: 'Reading material & resources' },
    { icon: 'BadgeCheck', label: 'Certificate of completion' },
    { icon: 'Infinity', label: 'Lifetime access' },
    { icon: 'Smartphone', label: 'Watch on mobile, tablet & desktop' },
  ];
  return items;
};

export function EnrollmentCard({
  course,
  enrollment,
  progress,
  isAuthenticated,
  isOwner,
  enrolling = false,
  onEnroll,
  previewLesson,
  onPreview,
  className,
}) {
  if (!course) return null;

  const priceLabel = formatPrice(course.price);
  const isFree = priceLabel === null;
  const isEnrolled = Boolean(enrollment);
  const progressPercent = Math.round(progress?.progressPercent ?? 0);

  const continueHref = (() => {
    const slug = course.slug;
    const lastLessonId =
      progress?.lastAccessedLesson ?? enrollment?.lastAccessedLesson;
    if (!slug) return ROUTES.dashboard;
    return lastLessonId ? ROUTES.lesson(slug, lastLessonId) : ROUTES.courseLearn(slug);
  })();

  const renderCta = () => {
    if (isOwner) {
      return (
        <Link to={ROUTES.instructorCourseEdit(course._id ?? course.id)} className="block">
          <Button variant="outline" size="lg" className="w-full" leftIcon={<Icon name="Settings" size={16} />}>
            Edit course
          </Button>
        </Link>
      );
    }

    if (isEnrolled) {
      return (
        <div className="space-y-3">
          <Link to={continueHref} className="block">
            <Button size="lg" className="w-full" rightIcon={<Icon name="ArrowRight" size={16} />}>
              Continue learning
            </Button>
          </Link>
          <ProgressBar
            value={progressPercent}
            showLabel
            label="Your progress"
            size="sm"
          />
        </div>
      );
    }

    if (!isAuthenticated) {
      const nextHref = `${ROUTES.register}?next=${encodeURIComponent(
        ROUTES.courseDetail(course.slug),
      )}`;
      return (
        <Link to={nextHref} className="block">
          <Button size="lg" className="w-full">
            Sign up to enroll
          </Button>
        </Link>
      );
    }

    return (
      <Button
        size="lg"
        className="w-full"
        loading={enrolling}
        onClick={onEnroll}
      >
        {isFree ? 'Enroll for free' : `Enroll · ${priceLabel}`}
      </Button>
    );
  };

  const thumbnailUrl =
    typeof course.thumbnail === 'string' ? course.thumbnail : course.thumbnail?.url;

  const canPreview = Boolean(previewLesson) && typeof onPreview === 'function';

  const ThumbnailWrapper = canPreview ? 'button' : 'div';

  return (
    <div
      className={[
        'rounded-2xl border border-border bg-bg shadow-md overflow-hidden',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <ThumbnailWrapper
        type={canPreview ? 'button' : undefined}
        onClick={canPreview ? () => onPreview(previewLesson) : undefined}
        aria-label={canPreview ? `Play preview: ${previewLesson.title}` : undefined}
        className={[
          'group relative block w-full aspect-video bg-bg-muted',
          canPreview &&
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt=""
            loading="lazy"
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <div
            aria-hidden="true"
            className="absolute inset-0 flex items-center justify-center bg-linear-to-br
              from-primary/30 via-info/20 to-bg-muted text-primary/70"
          >
            <Icon name="GraduationCap" size={42} />
          </div>
        )}
        {canPreview && (
          <>
            <span
              aria-hidden="true"
              className="absolute inset-0 bg-black/35 transition-colors group-hover:bg-black/50"
            />
            <span
              aria-hidden="true"
              className="absolute inset-0 flex items-center justify-center"
            >
              <span className="inline-flex items-center gap-2 rounded-full bg-white/95 px-4 py-2 text-sm font-medium text-text shadow-md transition-transform group-hover:scale-[1.04]">
                <Icon name="PlayCircle" size={18} className="text-primary" />
                Preview this course
              </span>
            </span>
          </>
        )}
      </ThumbnailWrapper>

      <div className="p-5 space-y-5">
        <div className="flex items-baseline justify-between gap-3">
          <span
            className={[
              'text-3xl font-semibold tracking-tight',
              isFree ? 'text-success' : 'text-text',
            ].join(' ')}
          >
            {isFree ? 'Free' : priceLabel}
          </span>
          {isEnrolled && (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-success">
              <Icon name="CheckCircle2" size={14} />
              Enrolled
            </span>
          )}
        </div>

        {renderCta()}

        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-2">
            What&apos;s included
          </h3>
          <ul className="space-y-2 text-sm text-text">
            {INCLUSIONS(course).map((item) => (
              <li key={item.label} className="flex items-start gap-2">
                <Icon
                  name={item.icon}
                  size={16}
                  className="mt-0.5 shrink-0 text-primary"
                />
                <span>{item.label}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

export default EnrollmentCard;
