/**
 * `/api/quizzes` route group — instructor-facing quiz detail + edit.
 *
 * Quiz CREATION lives on the lesson router (`POST /api/lessons/
 * :lessonId/quiz`) because the parent lesson is the natural scope
 * for a new quiz (and the unique `lessonId` index enforces "one
 * quiz per lesson"). This router only owns endpoints addressed by
 * quiz id:
 *
 *   PATCH  /:id              — partial update (whitelist enforced
 *                              in the controller; `questions`, when
 *                              sent, fully replaces the stored set)
 *   DELETE /:id              — delete + cascade `Lesson.hasQuiz = false`
 *   GET    /:id/instructor   — authoring view (full document INCLUDING
 *                              `correctIndex` + `explanation` — never
 *                              served to a learner)
 *
 * The student-facing detail / submission endpoints (`GET /:id`,
 * `POST /:id/submit`, `…/attempts/mine`, `…/best/mine`) live on a
 * separate router. Keeping the surfaces split prevents an
 * authorization regression where a public read could accidentally
 * inherit the instructor stack mounted here.
 */

import { Router } from 'express';

import {
  deleteQuiz,
  getQuizForInstructor,
  updateQuiz,
} from '../controllers/quiz.controller.js';
import { protect } from '../middleware/auth.middleware.js';
import { instructorOrAdmin } from '../middleware/role.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import {
  quizIdParamValidator,
  updateQuizValidator,
} from '../validators/quiz.validator.js';

const router = Router();

router.use(protect, instructorOrAdmin);

// `/:id/instructor` is declared BEFORE the bare `/:id` route so the
// more specific path wins the match instead of being shadowed by the
// generic id matcher.
router.get('/:id/instructor', validate(quizIdParamValidator), getQuizForInstructor);

router
  .route('/:id')
  .patch(validate(updateQuizValidator), updateQuiz)
  .delete(validate(quizIdParamValidator), deleteQuiz);

export default router;
