/**
 * `/api/instructors` route group — public instructor profile endpoints.
 *
 * Lives in its own file (rather than under `/api/courses`) because the
 * URL is rooted at a different resource ("instructors") in the API
 * surface, even though the underlying handler reads the `Course`
 * collection. Co-locating it with the course routes would force every
 * future user-profile endpoint to live in `course.routes.js`, which
 * would muddle the file's responsibility.
 *
 * Every endpoint here uses `optionalAuth` so anonymous visitors can
 * browse the marketing surface; an authenticated request just adds
 * `req.user` for any future per-user customization (none today).
 *
 * Endpoints:
 *   GET /:id/courses  — paginated `published` courses authored by the user
 */

import { Router } from 'express';

import { getInstructorPublicCourses } from '../controllers/course.controller.js';
import { optionalAuth } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { instructorPublicCoursesValidator } from '../validators/course.validator.js';

const router = Router();

router.get(
  '/:id/courses',
  optionalAuth,
  validate(instructorPublicCoursesValidator),
  getInstructorPublicCourses,
);

export default router;
