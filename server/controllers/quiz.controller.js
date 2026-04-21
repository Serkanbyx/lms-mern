/**
 * Quiz controller — both the instructor-facing CRUD for the quiz
 * attached to a single lesson AND the student-facing read /
 * submission surface.
 *
 * The two surfaces share a controller file (cohesion: they all touch
 * the same models), but they MUST be wired through DIFFERENT routers.
 * The instructor router (`quiz.routes.js`) installs
 * `protect + instructorOrAdmin` for every handler; the student router
 * (`quiz.student.routes.js`) installs `protect` only and per-route
 * enrollment checks. Mixing the two surfaces on a single router would
 * either lock students out (`instructorOrAdmin` gate) or accidentally
 * expose authoring views to learners.
 *
 * INSTRUCTOR mutations in this file:
 *
 *  - Re-resolve the parent `Lesson` and its owning `Course`, then
 *    assert the requester owns the course (or is an admin). Quiz ids
 *    alone are NOT a permission token. Failures are intentionally
 *    surfaced as 404 (never 403) to deny the id-space enumeration
 *    vector — same policy as `section.controller.js` and
 *    `lesson.controller.js`.
 *
 *  - Apply the documented mass-assignment whitelist
 *    (`title, description, passingScore, timeLimitSeconds, questions`).
 *    `lessonId`, `courseId`, and the timestamps are server-controlled
 *    and can NEVER flow in via the request body — `lessonId` is taken
 *    from the URL param, `courseId` is denormalized off the parent
 *    Lesson document.
 *
 *  - Treat `questions` as a full replacement on update. The model
 *    requires 1–50 questions per quiz; partial / sparse arrays are
 *    not supported and would corrupt the answer key.
 *
 * STUDENT reads / writes in this file:
 *
 *  - Always assert an `Enrollment` exists for `(req.user._id, quiz.
 *    courseId)` before returning ANY quiz data, even the sanitized
 *    student view. Enrollment is the gating capability — JWT alone
 *    is not enough to pull a quiz that belongs to a course the user
 *    has not paid / signed up for.
 *
 *  - NEVER serve `correctIndex` or `explanation` to the learner
 *    BEFORE submission. The student detail endpoint goes through
 *    `quiz.toStudentView()` which strips both fields. Per-question
 *    feedback is only emitted in the response of `submitQuiz`,
 *    AFTER the answers are persisted.
 *
 *  - Defer scoring to the QuizAttempt model's `pre('validate')` hook
 *    — that hook re-reads the canonical Quiz from the database and
 *    recomputes `score / correctCount / passed`, so any value a
 *    forged client puts in the body is silently overwritten. The
 *    controller's job is to validate shape, attach the authenticated
 *    user, and translate hook-thrown errors into operational HTTP
 *    failures.
 *
 * Counter / cross-document consistency (`Lesson.hasQuiz` flips on
 * insert and delete) is maintained by the schema-level hooks on the
 * Quiz model — the controller never writes that flag by hand.
 */

import { Course } from '../models/Course.model.js';
import { Enrollment } from '../models/Enrollment.model.js';
import { Lesson } from '../models/Lesson.model.js';
import { Quiz } from '../models/Quiz.model.js';
import { QuizAttempt } from '../models/QuizAttempt.model.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { pickFields } from '../utils/pickFields.js';

const QUIZ_FIELDS = [
  'title',
  'description',
  'passingScore',
  'timeLimitSeconds',
  'questions',
];

const isAdmin = (user) => user?.role === 'admin';

const isOwner = (course, user) =>
  course?.instructor && user?._id && course.instructor.equals(user._id);

/**
 * Resolve a lesson and its parent course in one helper, asserting
 * the requester is allowed to mutate the lesson's quiz. 404s for
 * both "missing" and "not yours" so attackers cannot probe the id
 * space.
 */
const findOwnedLessonOr404 = async (lessonId, user) => {
  const lesson = await Lesson.findById(lessonId);
  if (!lesson) throw ApiError.notFound('Lesson not found.');

  const course = await Course.findById(lesson.courseId);
  if (!course || (!isOwner(course, user) && !isAdmin(user))) {
    throw ApiError.notFound('Lesson not found.');
  }
  return { lesson, course };
};

/**
 * Resolve a quiz, its parent lesson, and the owning course in one
 * helper. Returns 404 (not 403) if any link in the chain is missing
 * or the requester does not own the course.
 */
const findOwnedQuizOr404 = async (quizId, user) => {
  const quiz = await Quiz.findById(quizId);
  if (!quiz) throw ApiError.notFound('Quiz not found.');

  const course = await Course.findById(quiz.courseId);
  if (!course || (!isOwner(course, user) && !isAdmin(user))) {
    throw ApiError.notFound('Quiz not found.');
  }
  return { quiz, course };
};

/**
 * POST /api/lessons/:lessonId/quiz
 *
 * One quiz per lesson. We do an explicit existence check for a clear
 * 409 message; the unique index on `Quiz.lessonId` is the race-safe
 * net behind it (a duplicate insert from a concurrent request will
 * surface as `code: 11000` and the central error middleware will turn
 * it into a 409 anyway).
 *
 * `Lesson.hasQuiz` is flipped to `true` by the Quiz model's post-save
 * hook — the controller never writes that flag directly.
 */
export const createQuiz = asyncHandler(async (req, res) => {
  const { lesson } = await findOwnedLessonOr404(req.params.lessonId, req.user);

  const existing = await Quiz.exists({ lessonId: lesson._id });
  if (existing) {
    throw ApiError.conflict('This lesson already has a quiz.');
  }

  const data = pickFields(req.body, QUIZ_FIELDS);

  const quiz = await Quiz.create({
    ...data,
    lessonId: lesson._id,
    courseId: lesson.courseId,
  });

  res.status(201).json({ success: true, quiz });
});

/**
 * PATCH /api/quizzes/:id
 *
 * Partial update. `questions`, when provided, fully replaces the
 * stored array (the schema's nested validators run on save and will
 * reject a malformed replacement). `lessonId` and `courseId` are
 * immutable — you re-create the quiz instead.
 */
export const updateQuiz = asyncHandler(async (req, res) => {
  const { quiz } = await findOwnedQuizOr404(req.params.id, req.user);
  const updates = pickFields(req.body, QUIZ_FIELDS);

  if (Object.keys(updates).length === 0) {
    throw ApiError.badRequest('No updatable fields provided.');
  }

  Object.assign(quiz, updates);
  await quiz.save();

  res.json({ success: true, quiz });
});

/**
 * DELETE /api/quizzes/:id
 *
 * Per-document `deleteOne()` triggers the Quiz schema's cascade hook
 * which flips `Lesson.hasQuiz` back to `false`. `Quiz.deleteOne(filter)`
 * (the query form) would skip the document hook entirely and silently
 * leave the parent lesson advertising a quiz badge that no longer exists.
 */
export const deleteQuiz = asyncHandler(async (req, res) => {
  const { quiz } = await findOwnedQuizOr404(req.params.id, req.user);

  await quiz.deleteOne();

  res.json({ success: true, message: 'Quiz deleted successfully.' });
});

/**
 * GET /api/quizzes/:id/instructor
 *
 * Authoring view — returns the full quiz document INCLUDING
 * `correctIndex` and `explanation` on every question. This shape MUST
 * NEVER be served to a learner taking the quiz; the student endpoint
 * (`getQuizForStudent`) goes through `quiz.toStudentView()` to strip
 * the answer key.
 */
export const getQuizForInstructor = asyncHandler(async (req, res) => {
  const { quiz } = await findOwnedQuizOr404(req.params.id, req.user);
  res.json({ success: true, quiz });
});

/**
 * GET /api/lessons/:lessonId/quiz
 *
 * Authoring lookup of the (single) quiz attached to a lesson.
 *
 * The quiz builder UI is addressed by lesson id (a lesson has at most
 * one quiz) but the rest of the quiz API is keyed by the quiz's own
 * `_id`. Without this helper the builder would have to scan the whole
 * curriculum to discover the quiz id every time it loaded — an O(N)
 * round-trip just to bootstrap a single screen.
 *
 * Returns `{ quiz: null }` (200) when the lesson exists and is owned
 * by the requester but has no quiz yet; the builder then renders an
 * empty draft and a save will hit `POST /api/lessons/:lessonId/quiz`.
 *
 * Like every other instructor mutation, ownership failures collapse to
 * 404 (never 403) so the lesson id space cannot be probed.
 */
export const getQuizByLessonForInstructor = asyncHandler(async (req, res) => {
  const { lesson } = await findOwnedLessonOr404(req.params.lessonId, req.user);
  const quiz = await Quiz.findOne({ lessonId: lesson._id });
  res.json({ success: true, quiz: quiz ?? null, lesson });
});

// ---------------------------------------------------------------------------
// STUDENT SURFACE
// ---------------------------------------------------------------------------

const ATTEMPTS_DEFAULT_LIMIT = 10;
const ATTEMPTS_MAX_LIMIT = 50;
const TIME_LIMIT_GRACE_SECONDS = 5;

/**
 * Resolve a quiz and assert the requester is currently enrolled in
 * the quiz's parent course. Used as the single gate for every
 * student-facing read / write so the enrollment check is impossible
 * to forget on a new endpoint.
 *
 * Returns 404 when the quiz is missing (don't leak ids that might
 * exist in the database). Returns 403 when the user is authenticated
 * but not enrolled — the resource provably exists at this point, so
 * the failure mode is "you don't have permission" rather than "not
 * found".
 */
const findEnrolledQuizOr403 = async (quizId, user) => {
  const quiz = await Quiz.findById(quizId);
  if (!quiz) throw ApiError.notFound('Quiz not found.');

  const enrollment = await Enrollment.exists({
    userId: user._id,
    courseId: quiz.courseId,
  });
  if (!enrollment) {
    throw ApiError.forbidden('You must be enrolled in this course to access the quiz.');
  }

  return quiz;
};

/**
 * GET /api/quizzes/:id
 *
 * Student detail view. ALWAYS goes through `toStudentView()` so the
 * answer key (`correctIndex`) and per-question hints (`explanation`)
 * never leave the server in this shape. Those fields are surfaced
 * exclusively as part of the `submitQuiz` response, AFTER the user's
 * answers are persisted.
 */
export const getQuizForStudent = asyncHandler(async (req, res) => {
  const quiz = await findEnrolledQuizOr403(req.params.id, req.user);
  res.json({ success: true, quiz: quiz.toStudentView() });
});

/**
 * POST /api/quizzes/:id/submit
 *
 * Body: `{ answers: [Number], timeSpentSeconds?: Number }`.
 *
 * Scoring is delegated to the `QuizAttempt.pre('validate')` hook,
 * which re-reads the canonical Quiz, recomputes `correctCount /
 * score / passed`, and clamps `timeSpentSeconds` to the quiz's own
 * limit. Anything the client tries to set on `score`, `correctCount`,
 * `totalQuestions`, `passed`, or `courseId` is silently overwritten
 * by the hook — there is no path where a forged payload becomes the
 * stored grade.
 *
 * The `answers.length === questions.length` check is enforced both
 * here (so the failure surfaces as a clean 400) AND in the hook
 * (defense-in-depth for direct-write paths like seeders / admin
 * scripts that bypass the controller).
 *
 * The "time spent" client report is clamped to `timeLimit + 5s`
 * grace BEFORE handing it to the model, so a learner who hits Submit
 * a few hundred ms after the timer ticks over isn't penalised by the
 * model's stricter `<= timeLimit` clamp re-running on the same value.
 */
export const submitQuiz = asyncHandler(async (req, res) => {
  const quiz = await findEnrolledQuizOr403(req.params.id, req.user);

  const answers = Array.isArray(req.body.answers) ? req.body.answers : [];
  if (answers.length !== quiz.questions.length) {
    throw ApiError.badRequest(
      `Expected ${quiz.questions.length} answers, received ${answers.length}.`,
    );
  }

  const reportedSeconds = Number.isInteger(req.body.timeSpentSeconds)
    ? req.body.timeSpentSeconds
    : 0;
  const clampedSeconds =
    quiz.timeLimitSeconds > 0
      ? Math.max(0, Math.min(reportedSeconds, quiz.timeLimitSeconds + TIME_LIMIT_GRACE_SECONDS))
      : Math.max(0, reportedSeconds);

  // STEP 49 — Anti-cheat signal: tab switches reported by the client.
  // Clamped to a reasonable [0, 9999] range so a forged payload can't
  // poison aggregate "average tab switches per attempt" analytics.
  const reportedTabSwitches = Number.isInteger(req.body.tabSwitches)
    ? req.body.tabSwitches
    : 0;
  const clampedTabSwitches = Math.max(0, Math.min(reportedTabSwitches, 9999));

  const attempt = await QuizAttempt.create({
    userId: req.user._id,
    quizId: quiz._id,
    courseId: quiz.courseId,
    answers,
    timeSpentSeconds: clampedSeconds,
    tabSwitches: clampedTabSwitches,
  });

  // Per-question feedback is response-only — it is intentionally NOT
  // persisted on the attempt (the raw answers + the live quiz are the
  // canonical source, so an instructor edit to `explanation` after
  // the fact is reflected the next time history is re-derived).
  const perQuestion = quiz.questions.map((question, index) => ({
    correct: answers[index] === question.correctIndex,
    correctIndex: question.correctIndex,
    explanation: question.explanation,
  }));

  res.status(201).json({
    success: true,
    attemptId: attempt._id,
    score: attempt.score,
    correctCount: attempt.correctCount,
    totalQuestions: attempt.totalQuestions,
    passed: attempt.passed,
    timeSpentSeconds: attempt.timeSpentSeconds,
    perQuestion,
  });
});

/**
 * GET /api/quizzes/:id/attempts/mine
 *
 * Paginated history of the requester's own attempts on this quiz,
 * newest-first. Backed by the compound index
 * `{ userId, quizId, attemptedAt: -1 }` so the sort + filter resolves
 * without a collection scan.
 *
 * The answer arrays are intentionally included so the player UI can
 * render a "review your previous attempt" panel without a follow-up
 * round-trip — they belong to the requester, so there is no leakage.
 */
export const getMyAttempts = asyncHandler(async (req, res) => {
  const quiz = await findEnrolledQuizOr403(req.params.id, req.user);

  const page = Number.isInteger(req.query.page) && req.query.page > 0 ? req.query.page : 1;
  const requestedLimit =
    Number.isInteger(req.query.limit) && req.query.limit > 0
      ? req.query.limit
      : ATTEMPTS_DEFAULT_LIMIT;
  const limit = Math.min(requestedLimit, ATTEMPTS_MAX_LIMIT);
  const skip = (page - 1) * limit;

  const filter = { userId: req.user._id, quizId: quiz._id };

  const [items, total] = await Promise.all([
    QuizAttempt.find(filter).sort({ attemptedAt: -1 }).skip(skip).limit(limit).lean(),
    QuizAttempt.countDocuments(filter),
  ]);

  res.json({
    success: true,
    data: {
      items,
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  });
});

/**
 * GET /api/quizzes/:id/best/mine
 *
 * Single-document aggregation that returns the requester's best
 * score and total attempt count for this quiz. Returns
 * `{ best: null, attempts: 0 }` when the user has never submitted
 * (instead of 404) so the player UI can render a neutral "Not
 * attempted yet" badge from the same shape.
 */
export const getMyBestScore = asyncHandler(async (req, res) => {
  const quiz = await findEnrolledQuizOr403(req.params.id, req.user);

  const [aggregate] = await QuizAttempt.aggregate([
    { $match: { userId: req.user._id, quizId: quiz._id } },
    {
      $group: {
        _id: '$quizId',
        best: { $max: '$score' },
        attempts: { $sum: 1 },
      },
    },
  ]);

  res.json({
    success: true,
    data: {
      quizId: quiz._id,
      best: aggregate?.best ?? null,
      attempts: aggregate?.attempts ?? 0,
      passingScore: quiz.passingScore,
      passed: aggregate ? aggregate.best >= quiz.passingScore : false,
    },
  });
});

export default {
  createQuiz,
  updateQuiz,
  deleteQuiz,
  getQuizForInstructor,
  getQuizByLessonForInstructor,
  getQuizForStudent,
  submitQuiz,
  getMyAttempts,
  getMyBestScore,
};
