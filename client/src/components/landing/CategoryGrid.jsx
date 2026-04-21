/**
 * `CategoryGrid` — discover-by-topic block on the landing page.
 *
 * Categories are kept in sync with the server enum (see
 * `server/models/Course.model.js → CATEGORIES`); each card links to the
 * filtered catalog. Counts are fetched live from
 * `GET /api/courses/categories` so the marketing surface always
 * reflects the real published catalog. While the request is in flight
 * we render a soft loading state ("— courses") instead of misleading
 * placeholder numbers; if the request fails we silently fall back to
 * the same neutral label so the section still renders.
 *
 * On mobile the grid switches to a horizontal swipe lane so the section
 * never collapses into a tall tower of cards. On desktop it's a 4-column
 * grid that lines up with the rest of the marketing rhythm.
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

import { Icon } from '../ui/index.js';
import { Reveal } from '../layout/index.js';
import { ROUTES } from '../../utils/constants.js';
import { stagger, staggerItem } from '../../utils/motion.js';
import { getCategoryStats } from '../../services/course.service.js';

const CATEGORIES = [
  {
    id: 'programming',
    label: 'Programming',
    icon: 'Code2',
    accent: 'from-primary/15 to-primary/5 text-primary',
  },
  {
    id: 'design',
    label: 'Design',
    icon: 'Palette',
    accent: 'from-info/15 to-info/5 text-info',
  },
  {
    id: 'business',
    label: 'Business',
    icon: 'Briefcase',
    accent: 'from-warning/15 to-warning/5 text-warning',
  },
  {
    id: 'marketing',
    label: 'Marketing',
    icon: 'Megaphone',
    accent: 'from-success/15 to-success/5 text-success',
  },
  {
    id: 'data-science',
    label: 'Data Science',
    icon: 'LineChart',
    accent: 'from-primary/15 to-primary/5 text-primary',
  },
  {
    id: 'language',
    label: 'Language',
    icon: 'Languages',
    accent: 'from-info/15 to-info/5 text-info',
  },
];

const formatCountLabel = (count) => {
  if (count === null || count === undefined) return '— courses';
  if (count === 1) return '1 course';
  return `${count} courses`;
};

export function CategoryGrid() {
  const [counts, setCounts] = useState(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const response = await getCategoryStats();
        if (cancelled) return;
        const map = Object.fromEntries(
          (response?.data?.items ?? []).map(({ category, count }) => [category, count]),
        );
        setCounts(map);
      } catch {
        // Silent fallback — the UI degrades to a neutral "— courses"
        // label instead of crashing the marketing page over a single
        // analytics request.
        if (!cancelled) setCounts({});
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section
      aria-labelledby="categories-heading"
      className="mx-auto max-w-7xl px-6 py-16 lg:py-20"
    >
      <Reveal className="flex items-end justify-between gap-4 mb-8">
        <div>
          <h2
            id="categories-heading"
            className="text-2xl sm:text-3xl font-semibold tracking-tight text-text"
          >
            Browse by category
          </h2>
          <p className="mt-2 text-text-muted">
            Find the right path — every topic is taught by working professionals.
          </p>
        </div>
        <Link
          to={ROUTES.catalog}
          className="hidden sm:inline-flex items-center gap-1 text-sm font-medium
            text-primary hover:text-primary-hover transition-colors"
        >
          All categories
          <Icon name="ArrowRight" size={16} />
        </Link>
      </Reveal>

      <motion.ul
        {...stagger(0.06)}
        initial="initial"
        whileInView="animate"
        viewport={{ once: true, margin: '-80px' }}
        className="
          flex gap-4 overflow-x-auto pb-2 -mx-6 px-6 snap-x snap-mandatory no-scrollbar
          sm:grid sm:grid-cols-2 sm:gap-4 sm:overflow-visible sm:mx-0 sm:px-0
          lg:grid-cols-3 xl:grid-cols-6
        "
      >
        {CATEGORIES.map((category) => {
          const count = counts?.[category.id];
          return (
            <motion.li
              key={category.id}
              variants={staggerItem}
              className="snap-start shrink-0 w-56 sm:w-auto"
            >
              <Link
                to={`${ROUTES.catalog}?category=${category.id}`}
                className="group block h-full rounded-2xl border border-border bg-bg-subtle
                  p-5 transition-all duration-200 hover:-translate-y-0.5
                  hover:border-border-strong hover:shadow-md focus-visible:outline-2
                  focus-visible:outline-primary"
              >
                <div
                  className={`inline-flex h-11 w-11 items-center justify-center rounded-xl
                    bg-linear-to-br ${category.accent}`}
                >
                  <Icon name={category.icon} size={22} />
                </div>
                <p className="mt-4 text-base font-semibold text-text">
                  {category.label}
                </p>
                <p
                  className="mt-1 text-xs text-text-subtle"
                  aria-live="polite"
                >
                  {formatCountLabel(count)}
                </p>

                <span className="mt-4 inline-flex items-center gap-1 text-xs font-medium
                  text-primary opacity-0 -translate-x-1 transition-all
                  group-hover:opacity-100 group-hover:translate-x-0">
                  Explore
                  <Icon name="ArrowRight" size={14} />
                </span>
              </Link>
            </motion.li>
          );
        })}
      </motion.ul>
    </section>
  );
}

export default CategoryGrid;
