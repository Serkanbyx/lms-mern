/**
 * `/api/courses` route group — instructor-facing CRUD + lifecycle.
 *
 * All endpoints in this file require an authenticated instructor or admin.
 * Public catalog/detail endpoints (`GET /api/courses`, `GET /:slug`,
 * `GET /:slug/curriculum`) are added by a later step on this same router;
 * they will declare their own `optionalAuth`/no-auth middleware locally
 * rather than inheriting the protected stack used here, so the order in
 * which routes are mounted matters.
 *
 * Route ordering rules followed below:
 *   1. Static segments (`/mine`) come BEFORE any `/:id` matcher so the
 *      Express router doesn't capture `mine` as an ObjectId.
 *   2. The most specific lifecycle paths (`/:id/submit`, `/:id/archive`)
 *      are declared BEFORE the generic `/:id` PATCH/DELETE so they win the
 *      match (Express matches in declaration order).
 *
 * Endpoints:
 *   POST   /                  — create draft course (instructor/admin)
 *   GET    /mine              — list courses owned by requester
 *   POST   /:id/submit        — promote draft → pending review
 *   POST   /:id/archive       — pull a published course off the catalog
 *   PATCH  /:id               — update soft fields (whitelist tightens once published)
 *   DELETE /:id               — cascade delete (blocks if active enrollments exist)
 */

import { Router } from 'express';

import {
  archiveCourse,
  createCourse,
  deleteCourse,
  getMyCourses,
  submitForReview,
  updateCourse,
} from '../controllers/course.controller.js';
import { protect } from '../middleware/auth.middleware.js';
import { instructorOrAdmin } from '../middleware/role.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import {
  courseIdParamValidator,
  createCourseValidator,
  updateCourseValidator,
} from '../validators/course.validator.js';

const router = Router();

// Every instructor route shares the same auth + role gate. Mounting them
// once via `router.use` keeps the per-route declarations focused on
// validation + handler wiring.
router.use(protect, instructorOrAdmin);

router.post('/', validate(createCourseValidator), createCourse);

router.get('/mine', getMyCourses);

router.post('/:id/submit', validate(courseIdParamValidator), submitForReview);
router.post('/:id/archive', validate(courseIdParamValidator), archiveCourse);

router
  .route('/:id')
  .patch(validate(updateCourseValidator), updateCourse)
  .delete(validate(courseIdParamValidator), deleteCourse);

export default router;
