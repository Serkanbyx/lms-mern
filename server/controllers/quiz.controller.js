/**
 * Quiz controller — instructor-facing CRUD for the quiz attached to a
 * single lesson. The student-facing surface (`getQuizForStudent`,
 * `submitQuiz`, attempts/best-score endpoints) is added by a later
 * step on a separate router so the authorization stacks can never
 * cross-contaminate.
 *
 * Every mutation in this file:
 *
 *  - Re-resolves the parent `Lesson` and its owning `Course`, then
 *    asserts the requester owns the course (or is an admin). Quiz ids
 *    alone are NOT a permission token. Failures are intentionally
 *    surfaced as 404 (never 403) to deny the id-space enumeration
 *    vector — same policy as `section.controller.js` and
 *    `lesson.controller.js`.
 *
 *  - Applies the documented mass-assignment whitelist
 *    (`title, description, passingScore, timeLimitSeconds, questions`).
 *    `lessonId`, `courseId`, and the timestamps are server-controlled
 *    and can NEVER flow in via the request body — `lessonId` is taken
 *    from the URL param, `courseId` is denormalized off the parent
 *    Lesson document.
 *
 *  - Treats `questions` as a full replacement on update. The model
 *    requires 1–50 questions per quiz; partial / sparse arrays are
 *    not supported and would corrupt the answer key.
 *
 * Counter / cross-document consistency (`Lesson.hasQuiz` flips on
 * insert and delete) is maintained by the schema-level hooks on the
 * Quiz model — the controller never writes that flag by hand.
 */

import { Course } from '../models/Course.model.js';
import { Lesson } from '../models/Lesson.model.js';
import { Quiz } from '../models/Quiz.model.js';
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
 * (later step) goes through `quiz.toStudentView()` to strip the
 * answer key.
 */
export const getQuizForInstructor = asyncHandler(async (req, res) => {
  const { quiz } = await findOwnedQuizOr404(req.params.id, req.user);
  res.json({ success: true, quiz });
});

export default {
  createQuiz,
  updateQuiz,
  deleteQuiz,
  getQuizForInstructor,
};
