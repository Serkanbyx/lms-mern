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
 *   GET    /:lessonId/quiz  — load the quiz attached to this lesson
 *                             (returns `quiz: null` if not yet created
 *                             so the authoring UI bootstraps cleanly)
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
 * and enrollment-gated access) lives on a different router — keeping
 * the surfaces split prevents an authorization regression where a
 * public read accidentally inherits the protected stack mounted here.
 */

import { Router } from 'express';

import {
  deleteLesson,
  getLessonForInstructor,
  updateLesson,
} from '../controllers/lesson.controller.js';
import {
  createQuiz,
  getQuizByLessonForInstructor,
} from '../controllers/quiz.controller.js';
import { protect } from '../middleware/auth.middleware.js';
import { instructorOrAdmin } from '../middleware/role.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import {
  lessonIdParamValidator,
  updateLessonValidator,
} from '../validators/lesson.validator.js';
import {
  createQuizValidator,
  lessonQuizParamValidator,
} from '../validators/quiz.validator.js';

const router = Router();

router.use(protect, instructorOrAdmin);

// Nested quiz endpoints — declared BEFORE the generic `/:id` matcher so
// `quiz` isn't swallowed as a lesson id. The GET form returns
// `{ quiz: null }` for lessons that don't have a quiz yet, so the
// authoring UI can bootstrap from a single round-trip.
router
  .route('/:lessonId/quiz')
  .get(validate(lessonQuizParamValidator), getQuizByLessonForInstructor)
  .post(validate(createQuizValidator), createQuiz);

router
  .route('/:id')
  .get(validate(lessonIdParamValidator), getLessonForInstructor)
  .patch(validate(updateLessonValidator), updateLesson)
  .delete(validate(lessonIdParamValidator), deleteLesson);

export default router;
