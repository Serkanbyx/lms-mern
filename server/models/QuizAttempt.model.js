/**
 * QuizAttempt schema — the immutable record of one learner submitting
 * one quiz once.
 *
 * Each attempt stores:
 *  - the participant triple `(userId, quizId, courseId)` — `courseId`
 *    is denormalized so per-course analytics ("avg quiz score in this
 *    course") need no Quiz join,
 *  - the raw `answers` array (one option index per question, in the
 *    same order the questions were presented),
 *  - the derived score columns (`score`, `correctCount`,
 *    `totalQuestions`, `passed`) — recomputed server-side on every
 *    save so a malicious client cannot ship a forged "100" payload,
 *  - `timeSpentSeconds`, clamped to the parent quiz's `timeLimitSeconds`
 *    when one is set (so client clock skew can't inflate the value).
 *
 * Multiple attempts per (user, quiz) are intentionally allowed — the
 * "best score" is computed via aggregation, not enforced via a unique
 * index. The compound `{ userId, quizId, attemptedAt: -1 }` index makes
 * both "latest attempt" and "highest score" queries fast.
 *
 * SECURITY:
 *  - Scoring is performed in `pre('validate')` by re-reading the live
 *    Quiz from the database and comparing each answer to the canonical
 *    `correctIndex`. Any value the controller (or seeder, or admin
 *    script) put into `score`, `correctCount`, `totalQuestions`, or
 *    `passed` is OVERWRITTEN. This is the single point of trust for
 *    grading — there is no "trust the client" path.
 *  - `userId` and `courseId` are server-derived from the authenticated
 *    session and the quiz's own `courseId`; never accept them from the
 *    request body (mass-assignment guard).
 *  - `answers.length` MUST match `questions.length`. A short / long
 *    answer payload is rejected with a clear validation error rather
 *    than silently scoring the matching prefix.
 *  - `timeSpentSeconds` is clamped to `[0, quiz.timeLimitSeconds]` when
 *    the parent quiz declares a limit, defending against forged
 *    "I solved it in 0 seconds" claims used to inflate leaderboards.
 *  - Out-of-range answer indices (negative or `>= options.length`) are
 *    treated as wrong rather than throwing — partial submissions and
 *    timed-out clients still produce a recordable attempt.
 *
 * MONGOOSE 9: Pre-hooks no longer receive a `next` callback — early
 * `return` (or `throw`) exits the hook.
 */

import mongoose from 'mongoose';

const { Schema } = mongoose;

const SCORE_MIN = 0;
const SCORE_MAX = 100;

const quizAttemptSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User reference is required'],
      index: true,
    },
    quizId: {
      type: Schema.Types.ObjectId,
      ref: 'Quiz',
      required: [true, 'Quiz reference is required'],
      index: true,
    },
    courseId: {
      type: Schema.Types.ObjectId,
      ref: 'Course',
      required: [true, 'Course reference is required'],
      index: true,
    },
    answers: {
      type: [Number],
      required: [true, 'Answers are required'],
      validate: {
        validator: (value) =>
          Array.isArray(value) && value.length > 0 && value.every((n) => Number.isInteger(n)),
        message: 'Answers must be a non-empty array of integer option indices.',
      },
    },
    score: {
      type: Number,
      required: true,
      default: 0,
      min: [SCORE_MIN, `Score cannot be below ${SCORE_MIN}`],
      max: [SCORE_MAX, `Score cannot exceed ${SCORE_MAX}`],
    },
    correctCount: {
      type: Number,
      required: true,
      default: 0,
      min: [0, 'Correct count cannot be negative'],
      validate: {
        validator: (value) => Number.isInteger(value),
        message: 'Correct count must be an integer.',
      },
    },
    totalQuestions: {
      type: Number,
      required: true,
      default: 0,
      min: [0, 'Total questions cannot be negative'],
      validate: {
        validator: (value) => Number.isInteger(value),
        message: 'Total questions must be an integer.',
      },
    },
    passed: {
      type: Boolean,
      required: true,
      default: false,
    },
    timeSpentSeconds: {
      type: Number,
      default: 0,
      min: [0, 'Time spent cannot be negative'],
      validate: {
        validator: (value) => Number.isInteger(value),
        message: 'Time spent must be an integer number of seconds.',
      },
    },
    // STEP 49 — Lightweight quiz integrity signal.
    // Number of times the player tab lost focus (tab switch / minimise /
    // app switch on mobile) during the attempt. Reported by the client
    // via `document.visibilitychange`. NOT a hard gate — proctored
    // exams require a separate service. We surface it on the attempt
    // record so instructors can correlate suspicious score swings with
    // unusual tab-switch counts when grading manually.
    tabSwitches: {
      type: Number,
      default: 0,
      min: [0, 'Tab switch count cannot be negative'],
      max: [9999, 'Tab switch count looks bogus (> 9999) — likely a forged payload.'],
      validate: {
        validator: (value) => Number.isInteger(value),
        message: 'Tab switch count must be an integer.',
      },
    },
    attemptedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true, versionKey: false },
    toObject: { virtuals: true, versionKey: false },
  },
);

// Powers "history of my attempts on this quiz" (sort by date desc) — the
// descending `attemptedAt` keeps the most recent attempts at the top of
// every page, which is the dominant access pattern for the timeline view.
quizAttemptSchema.index({ userId: 1, quizId: 1, attemptedAt: -1 });

// STEP 48 — Powers the "best score per (user, quiz)" lookup used by the
// learner dashboard, completion gates, and certificate flow. The
// descending `score` lets Mongo answer `findOne().sort({ score: -1 })`
// from a single index hit instead of scanning every prior attempt and
// in-memory sorting them. Two indexes on the same `(userId, quizId)`
// prefix are intentional: each query has a different sort key, and
// Mongo can only honour one sort direction per index.
quizAttemptSchema.index({ userId: 1, quizId: 1, score: -1 });

/**
 * Server-authoritative grading.
 *
 * Runs before validation so any score the client put on the wire is
 * thrown away before the score-range validators even see it. We load
 * the Quiz with `.lean()` because we only need to read its
 * `questions`, `passingScore`, and `timeLimitSeconds` fields — no
 * mutations or virtuals required.
 */
quizAttemptSchema.pre('validate', async function () {
  if (!this.isNew && !this.isModified('answers')) return;

  const Quiz = mongoose.models.Quiz;
  if (!Quiz) {
    throw new Error('Quiz model is not registered — cannot score attempt.');
  }

  const quiz = await Quiz.findById(this.quizId, 'questions passingScore timeLimitSeconds courseId').lean();
  if (!quiz) {
    throw new Error('Quiz not found — cannot score attempt.');
  }

  const questions = Array.isArray(quiz.questions) ? quiz.questions : [];
  const totalQuestions = questions.length;
  const answers = Array.isArray(this.answers) ? this.answers : [];

  if (answers.length !== totalQuestions) {
    throw new Error(
      `Answer count (${answers.length}) does not match question count (${totalQuestions}).`,
    );
  }

  let correctCount = 0;
  for (let i = 0; i < totalQuestions; i += 1) {
    const submitted = answers[i];
    const optionCount = Array.isArray(questions[i]?.options) ? questions[i].options.length : 0;

    if (
      Number.isInteger(submitted) &&
      submitted >= 0 &&
      submitted < optionCount &&
      submitted === questions[i].correctIndex
    ) {
      correctCount += 1;
    }
  }

  const score = totalQuestions === 0 ? 0 : Math.round((correctCount / totalQuestions) * 100);

  this.totalQuestions = totalQuestions;
  this.correctCount = correctCount;
  this.score = score;
  this.passed = score >= quiz.passingScore;

  if (quiz.timeLimitSeconds > 0) {
    const reported = Number.isInteger(this.timeSpentSeconds) ? this.timeSpentSeconds : 0;
    this.timeSpentSeconds = Math.max(0, Math.min(reported, quiz.timeLimitSeconds));
  } else if (!Number.isInteger(this.timeSpentSeconds) || this.timeSpentSeconds < 0) {
    this.timeSpentSeconds = 0;
  }

  // Keep `courseId` in lockstep with the quiz's own course — defends
  // against a forged body that pairs a real `quizId` with a different
  // `courseId` to poison per-course analytics.
  if (quiz.courseId) {
    this.courseId = quiz.courseId;
  }

  if (this.isNew && !this.attemptedAt) {
    this.attemptedAt = new Date();
  }
});

export const QUIZ_ATTEMPT_SCORE_MIN = SCORE_MIN;
export const QUIZ_ATTEMPT_SCORE_MAX = SCORE_MAX;

export const QuizAttempt =
  mongoose.models.QuizAttempt || mongoose.model('QuizAttempt', quizAttemptSchema);

export default QuizAttempt;
