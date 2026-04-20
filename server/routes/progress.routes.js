/**
 * `/api/lessons` student-facing progress sub-router.
 *
 * Mounted at the same prefix as the instructor-side `lesson.routes.js`
 * (which gates with `protect + instructorOrAdmin`). This router is
 * registered FIRST in `index.js` so its more specific paths
 * (`/:id/complete`, `/:id/access`) win the match BEFORE the lesson
 * router's instructor-only stack runs — students must be able to
 * record their own progress without holding the instructor role.
 *
 * The lesson router only declares routes for `/:id` (detail / patch /
 * delete) and the nested `/:lessonId/quiz`, so the static `/complete`
 * and `/access` segments never collide with it; declaration order is
 * the safety net rather than a strict requirement.
 *
 * Endpoints:
 *   POST   /:id/complete  — mark a lesson complete (idempotent)
 *   DELETE /:id/complete  — undo lesson completion (idempotent)
 *   POST   /:id/access    — bump the "Continue learning" pointer
 *
 * Auth: every route requires a valid JWT (`protect`); enrollment
 * ownership is enforced inside the controller (a 403 is raised if the
 * requester is not enrolled in the lesson's parent course).
 */

import { Router } from 'express';

import {
  markLessonComplete,
  markLessonIncomplete,
  setLastAccessed,
} from '../controllers/progress.controller.js';
import { protect } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { lessonIdParamValidator } from '../validators/enrollment.validator.js';

const router = Router();

router.use(protect);

router
  .route('/:id/complete')
  .post(validate(lessonIdParamValidator), markLessonComplete)
  .delete(validate(lessonIdParamValidator), markLessonIncomplete);

router.post('/:id/access', validate(lessonIdParamValidator), setLastAccessed);

export default router;
