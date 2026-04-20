/**
 * `/api/lessons` route group — instructor-facing lesson detail + edit
 * + nested quiz creation.
 *
 * Lesson CREATION lives on the section router (`POST /api/sections/
 * :sectionId/lessons`) because the parent section is the natural scope
 * for a new lesson. This router owns endpoints that target an existing
 * lesson by id, plus the nested quiz-create endpoint that flows
 * through `/api/lessons/:lessonId/quiz`:
 *
 *   POST   /:lessonId/quiz  — create the (single) quiz for this lesson
 *                             (409 if one already exists)
 *   GET    /:id             — instructor detail (full document, incl.
 *                             authoring-only fields)
 *   PATCH  /:id             — partial update (whitelist enforced in
 *                             the controller)
 *   DELETE /:id             — delete + Cloudinary cleanup + cascade
 *                             quiz removal
 *
 * Route ordering: `/:lessonId/quiz` MUST precede the generic `/:id`
 * matcher, otherwise Express would capture `quiz` as a lesson id and
 * the quiz-create handler would never run.
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
import { createQuiz } from '../controllers/quiz.controller.js';
import { protect } from '../middleware/auth.middleware.js';
import { instructorOrAdmin } from '../middleware/role.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import {
  lessonIdParamValidator,
  updateLessonValidator,
} from '../validators/lesson.validator.js';
import { createQuizValidator } from '../validators/quiz.validator.js';

const router = Router();

router.use(protect, instructorOrAdmin);

// Nested quiz-create endpoint — declared BEFORE the generic `/:id`
// matcher so `quiz` isn't swallowed as a lesson id.
router.post('/:lessonId/quiz', validate(createQuizValidator), createQuiz);

router
  .route('/:id')
  .get(validate(lessonIdParamValidator), getLessonForInstructor)
  .patch(validate(updateLessonValidator), updateLesson)
  .delete(validate(lessonIdParamValidator), deleteLesson);

export default router;
