/**
 * Public surface for catalog / course-presentation components.
 *
 * Pages should import from this barrel — never reach for the
 * individual files — so a future renaming or refactor of any card
 * variant happens in exactly one place.
 */

export { CourseCard } from './CourseCard.jsx';
export { CourseCardSkeleton } from './CourseCardSkeleton.jsx';
export { CoursesGrid } from './CoursesGrid.jsx';
export { CourseHero } from './CourseHero.jsx';
export { CourseDetailSkeleton } from './CourseDetailSkeleton.jsx';
export { EnrollmentCard } from './EnrollmentCard.jsx';
export { CurriculumOutline } from './CurriculumOutline.jsx';
export { FiltersSidebar, ActiveFiltersBadge } from './FiltersSidebar.jsx';
export { ActiveFilterChips, countActiveFilters } from './ActiveFilterChips.jsx';
export {
  CATEGORIES,
  LEVELS,
  PRICE_LIMITS,
  DURATION_BUCKETS,
  SORT_OPTIONS,
  DEFAULT_SORT,
  DEFAULT_PRICE_MODE,
  CATEGORY_LABELS,
  LEVEL_LABELS,
  DURATION_LABELS,
  findDurationBucket,
} from './filterConstants.js';
