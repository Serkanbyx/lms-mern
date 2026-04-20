/**
 * `/api/quizzes` student sub-router.
 *
 * Mounted at the same prefix as the instructor-side `quiz.routes.js`
 * (which gates with `protect + instructorOrAdmin`). This router is
 * registered FIRST in `index.js` so its student paths
 * (`GET /:id`, `POST /:id/submit`, `/:id/attempts/mine`,
 * `/:id/best/mine`) win the match BEFORE the instructor router's
 * `protect + instructorOrAdmin` stack runs — students must be able
 * to take a quiz without holding the instructor role.
 *
 * The instructor router only declares routes for `PATCH /:id`,
 * `DELETE /:id`, and `GET /:id/instructor`, so the static `/submit`,
 * `/attempts/mine`, and `/best/mine` segments cannot collide. The
 * one shared shape — `GET /:id` (here, student detail) — does NOT
 * exist on the instructor router (which only declares PATCH/DELETE
 * on `/:id` and a separate `/:id/instructor` GET), so the
 * declaration order for THIS path is a strict requirement, not a
 * stylistic preference: a future instructor `GET /:id` would
 * silently shadow the student detail view if mounted ahead of it.
 *
 * Endpoints:
 *   GET  /:id                  — student detail (toStudentView, no answer key)
 *   POST /:id/submit           — submit answers, get scored response
 *   GET  /:id/attempts/mine    — paginated history of MY attempts on this quiz
 *   GET  /:id/best/mine        — MY best score + total attempt count
 *
 * Auth: every route requires a valid JWT (`protect`); enrollment is
 * enforced inside each controller (a 403 is raised when the
 * requester is not enrolled in the quiz's parent course).
 *
 * Rate limit: only `POST /:id/submit` carries `quizSubmitLimiter`
 * (30 / 10 min / user). Read endpoints inherit the global limiter
 * mounted in `index.js` and don't need an extra cap.
 */

import { Router } from 'express';

import {
  getMyAttempts,
  getMyBestScore,
  getQuizForStudent,
  submitQuiz,
} from '../controllers/quiz.controller.js';
import { protect } from '../middleware/auth.middleware.js';
import { quizSubmitLimiter } from '../middleware/rateLimit.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import {
  myAttemptsValidator,
  quizIdParamValidator,
  submitQuizValidator,
} from '../validators/quiz.validator.js';

const router = Router();

router.use(protect);

// More specific paths declared BEFORE the bare `/:id` so the static
// `/submit`, `/attempts/mine`, `/best/mine` segments aren't swallowed
// by the dynamic id matcher.
router.post(
  '/:id/submit',
  quizSubmitLimiter,
  validate(submitQuizValidator),
  submitQuiz,
);

router.get('/:id/attempts/mine', validate(myAttemptsValidator), getMyAttempts);

router.get('/:id/best/mine', validate(quizIdParamValidator), getMyBestScore);

router.get('/:id', validate(quizIdParamValidator), getQuizForStudent);

export default router;
