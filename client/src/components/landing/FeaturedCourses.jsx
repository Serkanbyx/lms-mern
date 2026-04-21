/**
 * `FeaturedCourses` — "Trending this week" block.
 *
 * Fetches the top 8 published courses sorted by `enrollmentCount` from
 * `GET /api/courses?sort=popular&limit=8`. Renders each result through
 * the shared, memoised `CourseCard` so a future visual tweak (radius,
 * hover, density) propagates everywhere from one place.
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

import { Alert, Icon, Skeleton } from '../ui/index.js';
import { Reveal } from '../layout/index.js';
import { CourseCard } from '../course/CourseCard.jsx';
import { listCourses } from '../../services/course.service.js';
import { ROUTES } from '../../utils/constants.js';
import { stagger, staggerItem } from '../../utils/motion.js';

const LIMIT = 8;

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
                <CourseCard course={course} />
              </motion.li>
            ))}
          </motion.ul>
        )}
      </div>
    </section>
  );
}

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
