/**
 * `CategoryGrid` — discover-by-topic block on the landing page.
 *
 * Categories are kept in sync with the server enum (see
 * `server/models/Course.model.js → CATEGORIES`); each card links to the
 * filtered catalog. Course counts are static placeholders for v1 — the
 * real numbers will land alongside an aggregated `/api/categories`
 * endpoint.
 *
 * On mobile the grid switches to a horizontal swipe lane so the section
 * never collapses into a tall tower of cards. On desktop it's a 4-column
 * grid that lines up with the rest of the marketing rhythm.
 */

import { Link } from 'react-router-dom';

import { Icon } from '../ui/index.js';
import { Reveal } from '../layout/index.js';
import { ROUTES } from '../../utils/constants.js';
import { stagger, staggerItem } from '../../utils/motion.js';
import { motion } from 'framer-motion';

const CATEGORIES = [
  {
    id: 'programming',
    label: 'Programming',
    icon: 'Code2',
    count: 312,
    accent: 'from-primary/15 to-primary/5 text-primary',
  },
  {
    id: 'design',
    label: 'Design',
    icon: 'Palette',
    count: 184,
    accent: 'from-info/15 to-info/5 text-info',
  },
  {
    id: 'business',
    label: 'Business',
    icon: 'Briefcase',
    count: 142,
    accent: 'from-warning/15 to-warning/5 text-warning',
  },
  {
    id: 'marketing',
    label: 'Marketing',
    icon: 'Megaphone',
    count: 98,
    accent: 'from-success/15 to-success/5 text-success',
  },
  {
    id: 'data-science',
    label: 'Data Science',
    icon: 'LineChart',
    count: 121,
    accent: 'from-primary/15 to-primary/5 text-primary',
  },
  {
    id: 'language',
    label: 'Language',
    icon: 'Languages',
    count: 76,
    accent: 'from-info/15 to-info/5 text-info',
  },
];

export function CategoryGrid() {
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
          flex gap-4 overflow-x-auto pb-2 -mx-6 px-6 snap-x snap-mandatory
          sm:grid sm:grid-cols-2 sm:gap-4 sm:overflow-visible sm:mx-0 sm:px-0
          lg:grid-cols-3 xl:grid-cols-6
        "
      >
        {CATEGORIES.map((category) => (
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
                  bg-gradient-to-br ${category.accent}`}
              >
                <Icon name={category.icon} size={22} />
              </div>
              <p className="mt-4 text-base font-semibold text-text">
                {category.label}
              </p>
              <p className="mt-1 text-xs text-text-subtle">
                {category.count} courses
              </p>

              <span className="mt-4 inline-flex items-center gap-1 text-xs font-medium
                text-primary opacity-0 -translate-x-1 transition-all
                group-hover:opacity-100 group-hover:translate-x-0">
                Explore
                <Icon name="ArrowRight" size={14} />
              </span>
            </Link>
          </motion.li>
        ))}
      </motion.ul>
    </section>
  );
}

export default CategoryGrid;
