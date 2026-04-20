/**
 * `/api/lessons` route group — instructor-facing lesson detail + edit.
 *
 * Lesson CREATION lives on the section router (`POST /api/sections/
 * :sectionId/lessons`) because the parent section is the natural scope
 * for a new lesson. This router only owns endpoints that target an
 * existing lesson by id:
 *
 *   GET    /:id  — instructor detail (full document, including
 *                  authoring-only fields)
 *   PATCH  /:id  — partial update (whitelist enforced in the controller)
 *   DELETE /:id  — delete + Cloudinary cleanup + cascade quiz removal
 *
 * A separate student-facing detail endpoint (with redacted projection
 * and enrollment-gated access) is added on a different router in a
 * later step — keeping the surfaces split prevents an authorization
 * regression where a public read accidentally inherits the protected
 * stack mounted here.
 */

import { Router } from 'express';

import {
  deleteLesson,
  getLessonForInstructor,
  updateLesson,
} from '../controllers/lesson.controller.js';
import { protect } from '../middleware/auth.middleware.js';
import { instructorOrAdmin } from '../middleware/role.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import {
  lessonIdParamValidator,
  updateLessonValidator,
} from '../validators/lesson.validator.js';

const router = Router();

router.use(protect, instructorOrAdmin);

router
  .route('/:id')
  .get(validate(lessonIdParamValidator), getLessonForInstructor)
  .patch(validate(updateLessonValidator), updateLesson)
  .delete(validate(lessonIdParamValidator), deleteLesson);

export default router;
