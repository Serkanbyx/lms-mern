/**
 * `/api/courses` route group.
 *
 * Three distinct middleware stacks share this router:
 *
 *   PUBLIC   (optionalAuth)              — catalog list, detail, curriculum
 *   STUDENT  (protect)                   — enroll / unenroll / progress / per-course enrollment
 *   AUTHOR   (protect + instructorOrAdmin) — create/update/delete + lifecycle
 *
 * Routes are declared in that order. Express only applies a `router.use`
 * middleware to routes declared AFTER it, so the public surface stays
 * anonymous-accessible, the student surface only requires a valid JWT,
 * and the instructor gate locks down everything below it.
 *
 * Route ordering rules:
 *   1. `GET /` (public catalog) and `GET /mine` (instructor only) live
 *      BEFORE the dynamic `GET /:slug` so they're not swallowed as a
 *      slug. `/mine` carries explicit `protect + instructorOrAdmin`
 *      middleware because it sits in the public-routes block.
 *   2. `GET /:slug/curriculum` is declared BEFORE `GET /:slug` so the
 *      static `curriculum` segment wins the match.
 *   3. The most specific lifecycle paths (`/:id/submit`, `/:id/archive`)
 *      come BEFORE the generic `/:id` PATCH/DELETE so they win the
 *      match (Express matches in declaration order).
 *   4. Student-facing per-course endpoints (`/:id/enroll`,
 *      `/:id/enrollment`, `/:id/progress`) all use a static second
 *      segment, so they cannot collide with the dynamic public
 *      `GET /:slug` matcher.
 *
 * Endpoints:
 *   GET    /                      — public catalog (filters + pagination)
 *   GET    /mine                  — owner's courses (instructor/admin)
 *   GET    /categories            — public published-course counts per category
 *   GET    /:slug/curriculum      — public curriculum (gated lessons)
 *   GET    /:slug                 — public course detail
 *   POST   /:id/enroll            — enroll authenticated user (student)
 *   DELETE /:id/enroll            — unenroll authenticated user (student)
 *   GET    /:id/enrollment        — get current user's enrollment
 *   GET    /:id/progress          — get current user's progress
 *   POST   /:id/certificate       — issue completion certificate (100% only)
 *   POST   /                      — create draft course
 *   POST   /:id/submit            — promote draft → pending review
 *   POST   /:id/archive           — pull a published course off the catalog
 *   PATCH  /:id                   — update soft fields
 *   DELETE /:id                   — cascade delete (blocks if enrollments exist)
 */

import { Router } from 'express';

import {
  archiveCourse,
  createCourse,
  deleteCourse,
  getCategoryStats,
  getCourseBySlug,
  getCourseCurriculum,
  getMyCourses,
  listPublishedCourses,
  submitForReview,
  updateCourse,
} from '../controllers/course.controller.js';
import {
  enrollInCourse,
  getEnrollmentForCourse,
  issueCertificate,
  unenroll,
} from '../controllers/enrollment.controller.js';
import { getCourseProgress } from '../controllers/progress.controller.js';
import { optionalAuth, protect } from '../middleware/auth.middleware.js';
import { enrollLimiter } from '../middleware/rateLimit.middleware.js';
import { instructorOrAdmin } from '../middleware/role.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import {
  courseIdParamValidator,
  createCourseValidator,
  listCoursesValidator,
  slugParamValidator,
  updateCourseValidator,
} from '../validators/course.validator.js';
import { courseIdParamValidator as enrollmentCourseIdParamValidator } from '../validators/enrollment.validator.js';

const router = Router();

// -----------------------------------------------------------------
// PUBLIC routes (optionalAuth) — declared BEFORE the `router.use`
// auth gate so anonymous visitors can reach them. `req.user` is
// populated when a valid Bearer token is present (so owners and
// admins get the elevated view of their own non-published courses)
// and silently `null` otherwise.
// -----------------------------------------------------------------

router.get('/', optionalAuth, validate(listCoursesValidator), listPublishedCourses);

// `/mine` is a static segment that would otherwise be captured by the
// public `GET /:slug` matcher below. We carve it out here with its own
// explicit `protect + instructorOrAdmin` stack — the router-level gate
// further down doesn't apply to routes declared above it.
router.get('/mine', protect, instructorOrAdmin, getMyCourses);

// Static `/categories` segment must also win over the dynamic `/:slug`
// matcher. Anonymous-friendly: feeds the landing-page category grid
// with live published-course counts (no per-user data leaks).
router.get('/categories', optionalAuth, getCategoryStats);

router.get(
  '/:slug/curriculum',
  optionalAuth,
  validate(slugParamValidator),
  getCourseCurriculum,
);
router.get('/:slug', optionalAuth, validate(slugParamValidator), getCourseBySlug);

// -----------------------------------------------------------------
// STUDENT routes — any authenticated user (including instructors and
// admins acting as learners) can hit these. They are declared BEFORE
// the `protect + instructorOrAdmin` gate below so the role check
// doesn't shut students out. Each route carries its own explicit
// `protect` middleware.
// -----------------------------------------------------------------

// `enrollLimiter` is mounted on POST only — the destructive enroll path
// is the one that mutates `Course.enrollmentCount` and seeds an
// `Enrollment` document, so it's the surface a script could weaponize
// to inflate analytics or stress the unique-index path. The DELETE side
// is naturally bounded (you can only unenroll from courses you're
// enrolled in) and is happy to share the global `apiLimiter` cap.
router
  .route('/:id/enroll')
  .post(protect, enrollLimiter, validate(enrollmentCourseIdParamValidator), enrollInCourse)
  .delete(protect, validate(enrollmentCourseIdParamValidator), unenroll);

router.get(
  '/:id/enrollment',
  protect,
  validate(enrollmentCourseIdParamValidator),
  getEnrollmentForCourse,
);

router.get(
  '/:id/progress',
  protect,
  validate(enrollmentCourseIdParamValidator),
  getCourseProgress,
);

router.post(
  '/:id/certificate',
  protect,
  validate(enrollmentCourseIdParamValidator),
  issueCertificate,
);

// -----------------------------------------------------------------
// PROTECTED routes — every handler from here on requires an
// authenticated instructor or admin. Mounted once via `router.use`
// so per-route declarations stay focused on validation + handler.
// -----------------------------------------------------------------

router.use(protect, instructorOrAdmin);

router.post('/', validate(createCourseValidator), createCourse);

router.post('/:id/submit', validate(courseIdParamValidator), submitForReview);
router.post('/:id/archive', validate(courseIdParamValidator), archiveCourse);

router
  .route('/:id')
  .patch(validate(updateCourseValidator), updateCourse)
  .delete(validate(courseIdParamValidator), deleteCourse);

export default router;
