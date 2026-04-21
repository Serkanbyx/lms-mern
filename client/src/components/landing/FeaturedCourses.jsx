/**
 * `FeaturedCourses` — "Trending this week" block.
 *
 * Fetches the top 8 published courses sorted by `enrollmentCount` from
 * `GET /api/courses?sort=popular&limit=8` (see STEP 26 spec). The
 * canonical `CourseCard` ships with the catalog page in STEP 28; until
 * then we render a self-contained `LandingCourseCard` so the marketing
 * page can already showcase real catalog data without a forward
 * dependency on the catalog grid.
 *
 * Loading: 8 skeleton cards keep the layout stable so the section never
 * "jumps" once the API resolves.
 * Empty:   silently degrades to nothing (the section disappears) so the
 *          marketing page still scans well on a brand-new install.
 * Error:   inline `Alert` with retry hint — the rest of the page keeps
 *          rendering, the failure never blocks the funnel.
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

import { Alert, Badge, Icon, Skeleton } from '../ui/index.js';
import { Reveal } from '../layout/index.js';
import { listCourses } from '../../services/course.service.js';
import { ROUTES } from '../../utils/constants.js';
import { stagger, staggerItem } from '../../utils/motion.js';

const LIMIT = 8;

const formatPrice = (price) => {
  if (price == null || Number(price) === 0) return 'Free';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(Number(price));
};

const formatDuration = (minutes) => {
  if (!minutes) return '—';
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (!hours) return `${mins}m`;
  if (!mins) return `${hours}h`;
  return `${hours}h ${mins}m`;
};

const LEVEL_VARIANT = {
  beginner: 'success',
  intermediate: 'info',
  advanced: 'warning',
};

export function FeaturedCourses() {
  const [state, setState] = useState({
    status: 'loading',
    items: [],
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const data = await listCourses({ sort: 'popular', limit: LIMIT });
        if (cancelled) return;
        setState({ status: 'ready', items: data?.items ?? [], error: null });
      } catch (error) {
        if (cancelled) return;
        setState({
          status: 'error',
          items: [],
          error: error?.message ?? 'Could not load trending courses.',
        });
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (state.status === 'ready' && state.items.length === 0) return null;

  return (
    <section
      aria-labelledby="featured-heading"
      className="bg-bg-subtle border-y border-border"
    >
      <div className="mx-auto max-w-7xl px-6 py-16 lg:py-20">
        <Reveal className="flex items-end justify-between gap-4 mb-8">
          <div>
            <h2
              id="featured-heading"
              className="text-2xl sm:text-3xl font-semibold tracking-tight text-text"
            >
              Trending this week
            </h2>
            <p className="mt-2 text-text-muted">
              Popular picks chosen by your fellow learners.
            </p>
          </div>
          <Link
            to={`${ROUTES.catalog}?sort=popular`}
            className="hidden sm:inline-flex items-center gap-1 text-sm font-medium
              text-primary hover:text-primary-hover transition-colors"
          >
            View all
            <Icon name="ArrowRight" size={16} />
          </Link>
        </Reveal>

        {state.status === 'error' && (
          <Alert variant="warning" title="Couldn't load trending courses">
            {state.error}
          </Alert>
        )}

        {state.status === 'loading' && <FeaturedSkeleton />}

        {state.status === 'ready' && (
          <motion.ul
            {...stagger(0.05)}
            initial="initial"
            whileInView="animate"
            viewport={{ once: true, margin: '-80px' }}
            className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
          >
            {state.items.map((course) => (
              <motion.li key={course._id ?? course.slug} variants={staggerItem}>
                <LandingCourseCard course={course} />
              </motion.li>
            ))}
          </motion.ul>
        )}
      </div>
    </section>
  );
}

const LandingCourseCard = ({ course }) => {
  const instructorName = course.instructor?.name ?? 'Lumen Instructor';
  const lessons = course.totalLessons ?? 0;
  const duration = formatDuration(course.totalDuration);
  const enrolled = course.enrollmentCount ?? 0;
  const isFree = !course.price || Number(course.price) === 0;

  return (
    <Link
      to={ROUTES.courseDetail(course.slug)}
      className="group flex h-full flex-col overflow-hidden rounded-2xl border
        border-border bg-bg shadow-xs transition-all duration-200
        hover:-translate-y-0.5 hover:shadow-md hover:border-border-strong
        focus-visible:outline-2 focus-visible:outline-primary"
    >
      <div className="relative aspect-[16/9] overflow-hidden bg-bg-muted">
        {course.thumbnail ? (
          <img
            src={course.thumbnail}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300
              group-hover:scale-[1.04]"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-primary/30 via-info/20 to-bg-muted
            flex items-center justify-center text-primary/50">
            <Icon name="GraduationCap" size={32} />
          </div>
        )}
        {course.level && (
          <Badge
            variant={LEVEL_VARIANT[course.level] ?? 'neutral'}
            className="absolute top-3 left-3 backdrop-blur-sm"
          >
            {course.level}
          </Badge>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-3 p-5">
        <h3 className="text-base font-semibold text-text leading-snug line-clamp-2">
          {course.title}
        </h3>
        <p className="text-xs text-text-subtle">by {instructorName}</p>

        <ul className="mt-auto flex items-center gap-3 text-xs text-text-muted">
          <li className="inline-flex items-center gap-1">
            <Icon name="PlayCircle" size={14} />
            {lessons} lessons
          </li>
          <li className="inline-flex items-center gap-1">
            <Icon name="Clock" size={14} />
            {duration}
          </li>
          <li className="inline-flex items-center gap-1">
            <Icon name="Users" size={14} />
            {enrolled.toLocaleString()}
          </li>
        </ul>

        <div className="flex items-center justify-between pt-3 border-t border-border">
          <span className={`text-base font-semibold ${isFree ? 'text-success' : 'text-text'}`}>
            {formatPrice(course.price)}
          </span>
          <span className="inline-flex items-center gap-1 text-xs font-medium text-primary
            opacity-0 -translate-x-1 transition-all
            group-hover:opacity-100 group-hover:translate-x-0">
            View
            <Icon name="ArrowRight" size={14} />
          </span>
        </div>
      </div>
    </Link>
  );
};

const FeaturedSkeleton = () => (
  <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
    {Array.from({ length: LIMIT }).map((_, index) => (
      <li
        key={index}
        className="overflow-hidden rounded-2xl border border-border bg-bg"
      >
        <Skeleton className="aspect-[16/9] w-full rounded-none" />
        <div className="space-y-3 p-5">
          <Skeleton variant="text" className="w-3/4" />
          <Skeleton variant="text" className="w-1/2" />
          <Skeleton variant="text" className="w-2/5 mt-4" />
        </div>
      </li>
    ))}
  </ul>
);

export default FeaturedCourses;
