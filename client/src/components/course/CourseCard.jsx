/**
 * `CourseCard` — canonical catalog card.
 *
 * One card layout shared by the marketing landing page, the public
 * catalog grid and the public instructor profile. Previously the
 * landing page shipped its own `LandingCourseCard`; now every surface
 * pulls from this primitive so a future visual change happens in
 * exactly one place.
 *
 * Layout (mobile-first):
 *   ┌──────────────────────────────┐
 *   │ 16:9 thumbnail · level badge │
 *   ├──────────────────────────────┤
 *   │ Title (clamp 2)              │
 *   │ Avatar · instructor name     │
 *   │ Lessons · duration · learners│
 *   │ ───────                      │
 *   │ Price       View →           │
 *   └──────────────────────────────┘
 *
 * Hover/focus motion (lift + shadow upgrade + thumbnail zoom) follows
 * the STEP 23 motion vocabulary and self-disables under
 * `prefers-reduced-motion` because all transitions live inside Tailwind
 * utilities that the global CSS rule already overrides.
 */

import { Link } from 'react-router-dom';

import { Avatar, Badge, Icon } from '../ui/index.js';
import { ROUTES } from '../../utils/constants.js';
import { formatDuration } from '../../utils/formatDuration.js';
import { cn } from '../../utils/cn.js';

const LEVEL_VARIANT = {
  beginner: 'success',
  intermediate: 'info',
  advanced: 'warning',
};

const LEVEL_LABEL = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
};

const formatPrice = (price) => {
  if (price === null || price === undefined || Number(price) === 0) return null;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(Number(price));
};

const formatEnrolled = (count) => {
  const safe = Number(count) || 0;
  if (safe < 1000) return safe.toLocaleString();
  if (safe < 1_000_000) return `${(safe / 1000).toFixed(safe < 10_000 ? 1 : 0)}k`;
  return `${(safe / 1_000_000).toFixed(1)}M`;
};

export function CourseCard({ course, className }) {
  if (!course) return null;

  const instructorName = course.instructor?.name ?? 'Lumen Instructor';
  const instructorAvatar = course.instructor?.avatar;
  const lessons = course.totalLessons ?? 0;
  const duration = formatDuration(course.totalDuration);
  const enrolled = formatEnrolled(course.enrollmentCount);
  const priceLabel = formatPrice(course.price);
  const isFree = priceLabel === null;

  return (
    <Link
      to={ROUTES.courseDetail(course.slug)}
      aria-label={`${course.title} by ${instructorName}`}
      className={cn(
        'group flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-bg shadow-xs',
        'transition-all duration-200 ease-out',
        'hover:-translate-y-1 hover:shadow-md hover:border-border-strong',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
        className,
      )}
    >
      <div className="relative aspect-[16/9] overflow-hidden bg-bg-muted">
        {course.thumbnail?.url || typeof course.thumbnail === 'string' ? (
          <img
            src={course.thumbnail?.url ?? course.thumbnail}
            alt=""
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition-transform duration-500 ease-out
              group-hover:scale-[1.06]"
          />
        ) : (
          <div
            aria-hidden="true"
            className="absolute inset-0 flex items-center justify-center bg-gradient-to-br
              from-primary/25 via-info/15 to-bg-muted text-primary/60"
          >
            <Icon name="GraduationCap" size={36} />
          </div>
        )}

        {course.level && (
          <Badge
            variant={LEVEL_VARIANT[course.level] ?? 'neutral'}
            className="absolute left-3 top-3 backdrop-blur-sm"
          >
            {LEVEL_LABEL[course.level] ?? course.level}
          </Badge>
        )}

        {isFree && (
          <Badge variant="success" className="absolute right-3 top-3 backdrop-blur-sm">
            Free
          </Badge>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-3 p-5">
        <h3 className="text-base font-semibold leading-snug text-text line-clamp-2">
          {course.title}
        </h3>

        <div className="flex items-center gap-2 text-xs text-text-muted">
          <Avatar
            size="xs"
            src={instructorAvatar}
            name={instructorName}
            alt={instructorName}
          />
          <span className="truncate">{instructorName}</span>
        </div>

        <ul className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-muted">
          <li className="inline-flex items-center gap-1">
            <Icon name="PlayCircle" size={14} />
            <span>{lessons} lessons</span>
          </li>
          <li aria-hidden="true" className="text-text-subtle">
            ·
          </li>
          <li className="inline-flex items-center gap-1">
            <Icon name="Clock" size={14} />
            <span>{duration}</span>
          </li>
          <li aria-hidden="true" className="text-text-subtle">
            ·
          </li>
          <li className="inline-flex items-center gap-1">
            <Icon name="Users" size={14} />
            <span>{enrolled}</span>
          </li>
        </ul>

        <div className="flex items-center justify-between border-t border-border pt-3">
          <span
            className={cn(
              'text-lg font-semibold tracking-tight',
              isFree ? 'text-success' : 'text-text',
            )}
          >
            {isFree ? 'Free' : priceLabel}
          </span>
          <span
            aria-hidden="true"
            className="inline-flex items-center gap-1 text-xs font-medium text-primary
              opacity-0 -translate-x-1 transition-all duration-200
              group-hover:opacity-100 group-hover:translate-x-0
              group-focus-visible:opacity-100 group-focus-visible:translate-x-0"
          >
            View course
            <Icon name="ArrowRight" size={14} />
          </span>
        </div>
      </div>
    </Link>
  );
}

export default CourseCard;
