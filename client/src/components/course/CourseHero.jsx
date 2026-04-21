/**
 * `CourseHero` — full-bleed marketing band at the top of the public
 * course detail page.
 *
 * The thumbnail (or a brand gradient fallback) is layered behind a
 * dark gradient overlay so the white headline copy keeps WCAG AA
 * contrast regardless of the underlying image. The right column is
 * intentionally left empty in the markup — `CourseDetailPage`
 * positions the sticky `EnrollmentCard` over that grid track on
 * desktop so the card visually anchors to the hero without us
 * needing to thread the enrollment state through this component.
 */

import { Link } from 'react-router-dom';

import { Avatar, Badge, Breadcrumbs, Icon } from '../ui/index.js';
import { ROUTES } from '../../utils/constants.js';
import { formatDuration } from '../../utils/formatDuration.js';
import {
  cloudinaryPresets,
  cloudinarySrcSet,
} from '../../utils/cloudinaryUrl.js';
import { CATEGORY_LABELS, LEVEL_LABELS } from './filterConstants.js';

const HERO_THUMB_WIDTHS = [640, 960, 1280, 1600];
const HERO_THUMB_SIZES = '100vw';

const formatEnrolled = (count) => {
  const safe = Number(count) || 0;
  if (safe < 1000) return safe.toLocaleString();
  if (safe < 1_000_000) return `${(safe / 1000).toFixed(safe < 10_000 ? 1 : 0)}k`;
  return `${(safe / 1_000_000).toFixed(1)}M`;
};

const formatUpdated = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    year: 'numeric',
  }).format(date);
};

const LEVEL_VARIANT = {
  beginner: 'success',
  intermediate: 'info',
  advanced: 'warning',
};

export function CourseHero({ course }) {
  if (!course) return null;

  const instructor = course.instructor ?? {};
  const instructorId = instructor._id ?? instructor.id;
  const categoryLabel = CATEGORY_LABELS[course.category] ?? course.category;
  const levelLabel = LEVEL_LABELS[course.level] ?? course.level;
  const updatedAt = formatUpdated(course.updatedAt ?? course.publishedAt);
  const language = course.language?.toUpperCase?.();

  const breadcrumbs = [
    { label: 'Home', to: ROUTES.home },
    { label: 'Courses', to: ROUTES.catalog },
    categoryLabel
      ? {
          label: categoryLabel,
          to: `${ROUTES.catalog}?category=${course.category}`,
        }
      : null,
    { label: course.title },
  ].filter(Boolean);

  const thumbnailUrl =
    typeof course.thumbnail === 'string' ? course.thumbnail : course.thumbnail?.url;
  const heroSrc = thumbnailUrl ? cloudinaryPresets.heroThumb(thumbnailUrl) : null;
  const heroSrcSet = thumbnailUrl ? cloudinarySrcSet(thumbnailUrl, HERO_THUMB_WIDTHS) : '';

  return (
    <section className="relative isolate overflow-hidden bg-bg-subtle border-b border-border text-white">
      <div aria-hidden="true" className="absolute inset-0 -z-10">
        {heroSrc ? (
          <img
            src={heroSrc}
            srcSet={heroSrcSet || undefined}
            sizes={heroSrcSet ? HERO_THUMB_SIZES : undefined}
            alt=""
            loading="eager"
            decoding="async"
            fetchPriority="high"
            width="1600"
            height="600"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-primary via-primary/70 to-info" />
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/70 to-black/40" />
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-10 lg:py-14">
        <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-10">
          <div className="max-w-3xl">
            <Breadcrumbs
              items={breadcrumbs}
              linkAs={Link}
              className="text-white/70 [&_a:hover]:text-white [&_[aria-current='page']]:text-white"
            />

            {course.category && (
              <Badge variant="primary" className="mt-4 bg-white/10 text-white border-white/20">
                {categoryLabel}
              </Badge>
            )}

            <h1 className="mt-3 text-3xl sm:text-4xl lg:text-5xl font-semibold tracking-tight">
              {course.title}
            </h1>

            {course.shortDescription && (
              <p className="mt-4 text-base sm:text-lg text-white/80 leading-relaxed">
                {course.shortDescription}
              </p>
            )}

            <ul className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-white/80">
              {course.level && (
                <li>
                  <Badge
                    variant={LEVEL_VARIANT[course.level] ?? 'neutral'}
                    className="bg-white/15 text-white border-white/20"
                  >
                    {levelLabel}
                  </Badge>
                </li>
              )}
              {language && (
                <li className="inline-flex items-center gap-1.5">
                  <Icon name="Languages" size={14} />
                  <span>{language}</span>
                </li>
              )}
              <li className="inline-flex items-center gap-1.5">
                <Icon name="PlayCircle" size={14} />
                <span>{course.totalLessons ?? 0} lessons</span>
              </li>
              <li className="inline-flex items-center gap-1.5">
                <Icon name="Clock" size={14} />
                <span>{formatDuration(course.totalDuration)}</span>
              </li>
              <li className="inline-flex items-center gap-1.5">
                <Icon name="Users" size={14} />
                <span>{formatEnrolled(course.enrollmentCount)} enrolled</span>
              </li>
              {updatedAt && (
                <li className="inline-flex items-center gap-1.5">
                  <Icon name="Calendar" size={14} />
                  <span>Updated {updatedAt}</span>
                </li>
              )}
            </ul>

            <div className="mt-7 inline-flex items-center gap-3 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/15 px-4 py-3">
              <Avatar
                size="md"
                src={instructor.avatar}
                name={instructor.name ?? 'Instructor'}
              />
              <div className="min-w-0">
                <p className="text-xs text-white/70">Instructor</p>
                {instructorId ? (
                  <Link
                    to={ROUTES.profile(instructorId)}
                    className="block text-sm font-semibold text-white hover:underline underline-offset-4 truncate"
                  >
                    {instructor.name ?? 'Lumen Instructor'}
                  </Link>
                ) : (
                  <span className="block text-sm font-semibold text-white truncate">
                    {instructor.name ?? 'Lumen Instructor'}
                  </span>
                )}
                {instructor.headline && (
                  <p className="text-xs text-white/70 truncate max-w-[16rem]">
                    {instructor.headline}
                  </p>
                )}
              </div>
            </div>
          </div>

          <div aria-hidden="true" className="hidden lg:block" />
        </div>
      </div>
    </section>
  );
}

export default CourseHero;
