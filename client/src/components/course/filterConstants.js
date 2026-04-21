/**
 * Catalog filter constants.
 *
 * The single source of truth for the catalog UI: category labels,
 * level pills, price bounds, duration buckets and the sort dropdown.
 * Mirrored values (category and level enum keys) MUST stay in sync
 * with the server's `COURSE_CATEGORIES` / `COURSE_LEVELS` enums in
 * `server/models/Course.model.js`.
 *
 * Centralising these lists here means the sidebar, the active-filter
 * chips, the URL serialiser and the empty-state helpers all share the
 * same vocabulary — no string drift between modules.
 */

export const CATEGORIES = Object.freeze([
  { id: 'programming', label: 'Programming', icon: 'Code2' },
  { id: 'design', label: 'Design', icon: 'Palette' },
  { id: 'business', label: 'Business', icon: 'Briefcase' },
  { id: 'marketing', label: 'Marketing', icon: 'Megaphone' },
  { id: 'data-science', label: 'Data Science', icon: 'LineChart' },
  { id: 'language', label: 'Language', icon: 'Languages' },
  { id: 'other', label: 'Other', icon: 'Sparkles' },
]);

export const LEVELS = Object.freeze([
  { id: 'beginner', label: 'Beginner' },
  { id: 'intermediate', label: 'Intermediate' },
  { id: 'advanced', label: 'Advanced' },
]);

export const PRICE_LIMITS = Object.freeze({ min: 0, max: 200 });

export const DURATION_BUCKETS = Object.freeze([
  { id: 'short', label: '< 2h', min: 0, max: 119 },
  { id: 'medium', label: '2 – 6h', min: 120, max: 360 },
  { id: 'long', label: '6h+', min: 361, max: null },
]);

export const SORT_OPTIONS = Object.freeze([
  { value: 'popular', label: 'Most popular' },
  { value: 'newest', label: 'Newest' },
  { value: 'price-asc', label: 'Price: Low to High' },
  { value: 'price-desc', label: 'Price: High to Low' },
]);

export const DEFAULT_SORT = 'popular';
export const DEFAULT_PRICE_MODE = 'all';

export const CATEGORY_LABELS = Object.freeze(
  Object.fromEntries(CATEGORIES.map((category) => [category.id, category.label])),
);

export const LEVEL_LABELS = Object.freeze(
  Object.fromEntries(LEVELS.map((level) => [level.id, level.label])),
);

export const DURATION_LABELS = Object.freeze(
  Object.fromEntries(DURATION_BUCKETS.map((bucket) => [bucket.id, bucket.label])),
);

export const findDurationBucket = (id) =>
  DURATION_BUCKETS.find((bucket) => bucket.id === id) ?? null;
