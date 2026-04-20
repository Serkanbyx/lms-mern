/**
 * `/api/courses` route group.
 *
 * Two distinct middleware stacks share this router:
 *
 *   PUBLIC  (optionalAuth)            — catalog list, detail, curriculum
 *   AUTHOR  (protect + instructorOrAdmin) — create/update/delete + lifecycle
 *
 * The router declares the public routes FIRST and only then installs the
 * `protect + instructorOrAdmin` gate via `router.use(...)`. Express only
 * applies a `router.use` middleware to routes declared AFTER it, so this
 * ordering keeps the marketing surface anonymous-accessible while
 * locking down everything below it.
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
 *
 * Endpoints:
 *   GET    /                      — public catalog (filters + pagination)
 *   GET    /mine                  — owner's courses (instructor/admin)
 *   GET    /:slug/curriculum      — public curriculum (gated lessons)
 *   GET    /:slug                 — public course detail
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
  getCourseBySlug,
  getCourseCurriculum,
  getMyCourses,
  listPublishedCourses,
  submitForReview,
  updateCourse,
} from '../controllers/course.controller.js';
import { optionalAuth, protect } from '../middleware/auth.middleware.js';
import { instructorOrAdmin } from '../middleware/role.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import {
  courseIdParamValidator,
  createCourseValidator,
  listCoursesValidator,
  slugParamValidator,
  updateCourseValidator,
} from '../validators/course.validator.js';

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

router.get(
  '/:slug/curriculum',
  optionalAuth,
  validate(slugParamValidator),
  getCourseCurriculum,
);
router.get('/:slug', optionalAuth, validate(slugParamValidator), getCourseBySlug);

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
