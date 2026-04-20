/**
 * Quiz schema — the assessment attached to a single `Lesson`.
 *
 * A Quiz owns:
 *  - the back-reference pair `(lessonId, courseId)` — `lessonId` is unique
 *    so a lesson can have at most one quiz, and `courseId` is denormalized
 *    so dashboards / instructor reports can list "quizzes in this course"
 *    without a Lesson join,
 *  - meta-data the learner sees up front (`title`, `description`,
 *    `passingScore`, `timeLimitSeconds`),
 *  - an embedded `questions` array (1–50 items). Questions live inline
 *    rather than in their own collection because they are always read /
 *    written together with their parent quiz, never independently.
 *
 * SECURITY:
 *  - `correctIndex` and `explanation` MUST NEVER be sent to a learner who
 *    is taking the quiz. Use the `toStudentView()` instance method, which
 *    returns a sanitized payload containing only `_id`, `question`, and
 *    `options` per question. Sending the full document leaks the answer
 *    key over the wire and trivially breaks the assessment.
 *  - `lessonId` and `courseId` are server-derived (URL params + lesson
 *    lookup) — never accepted from the request body (mass-assignment).
 *  - The unique index on `lessonId` is the race-safe guarantee that two
 *    concurrent "create quiz" requests can't double-attach to one lesson.
 *  - On lifecycle changes we keep `Lesson.hasQuiz` in sync so the public
 *    curriculum endpoint can render the "Quiz" badge from a single field
 *    instead of joining the Quiz collection on every read.
 *
 * MONGOOSE 9: Pre-hooks no longer receive a `next` callback — early
 * `return` (or `throw`) exits the hook. Post-hooks still receive the
 * persisted document.
 */

import mongoose from 'mongoose';

const { Schema } = mongoose;

const QUESTIONS_MIN_COUNT = 1;
const QUESTIONS_MAX_COUNT = 50;
const OPTIONS_MIN_COUNT = 2;
const OPTIONS_MAX_COUNT = 6;

const TITLE_MIN_LENGTH = 3;
const TITLE_MAX_LENGTH = 120;
const DESCRIPTION_MAX_LENGTH = 500;
const QUESTION_MIN_LENGTH = 5;
const QUESTION_MAX_LENGTH = 500;
const OPTION_MAX_LENGTH = 200;
const EXPLANATION_MAX_LENGTH = 500;

const PASSING_SCORE_MIN = 0;
const PASSING_SCORE_MAX = 100;
const TIME_LIMIT_MIN_SECONDS = 0;
const TIME_LIMIT_MAX_SECONDS = 7200;

const questionSchema = new Schema(
  {
    question: {
      type: String,
      required: [true, 'Question text is required'],
      trim: true,
      minlength: [QUESTION_MIN_LENGTH, `Question must be at least ${QUESTION_MIN_LENGTH} characters`],
      maxlength: [QUESTION_MAX_LENGTH, `Question must be at most ${QUESTION_MAX_LENGTH} characters`],
    },
    options: {
      type: [
        {
          type: String,
          trim: true,
          maxlength: [OPTION_MAX_LENGTH, `Each option must be at most ${OPTION_MAX_LENGTH} characters`],
        },
      ],
      required: true,
      validate: {
        validator(value) {
          if (!Array.isArray(value)) return false;
          if (value.length < OPTIONS_MIN_COUNT || value.length > OPTIONS_MAX_COUNT) return false;
          return value.every((option) => typeof option === 'string' && option.trim().length > 0);
        },
        message: `Each question needs ${OPTIONS_MIN_COUNT}–${OPTIONS_MAX_COUNT} non-empty options.`,
      },
    },
    correctIndex: {
      type: Number,
      required: [true, 'Correct option index is required'],
      validate: {
        validator(value) {
          if (!Number.isInteger(value) || value < 0) return false;
          const optionCount = Array.isArray(this.options) ? this.options.length : 0;
          return value < optionCount;
        },
        message: 'correctIndex must be an integer within the range of options.',
      },
    },
    explanation: {
      type: String,
      default: '',
      trim: true,
      maxlength: [EXPLANATION_MAX_LENGTH, `Explanation must be at most ${EXPLANATION_MAX_LENGTH} characters`],
    },
  },
  { _id: true },
);

const quizSchema = new Schema(
  {
    lessonId: {
      type: Schema.Types.ObjectId,
      ref: 'Lesson',
      required: [true, 'Lesson reference is required'],
      unique: true,
    },
    courseId: {
      type: Schema.Types.ObjectId,
      ref: 'Course',
      required: [true, 'Course reference is required'],
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      minlength: [TITLE_MIN_LENGTH, `Title must be at least ${TITLE_MIN_LENGTH} characters`],
      maxlength: [TITLE_MAX_LENGTH, `Title must be at most ${TITLE_MAX_LENGTH} characters`],
    },
    description: {
      type: String,
      default: '',
      trim: true,
      maxlength: [DESCRIPTION_MAX_LENGTH, `Description must be at most ${DESCRIPTION_MAX_LENGTH} characters`],
    },
    passingScore: {
      type: Number,
      required: true,
      default: 70,
      min: [PASSING_SCORE_MIN, `Passing score cannot be below ${PASSING_SCORE_MIN}`],
      max: [PASSING_SCORE_MAX, `Passing score cannot exceed ${PASSING_SCORE_MAX}`],
      validate: {
        validator: (value) => Number.isFinite(value),
        message: 'Passing score must be a finite number.',
      },
    },
    timeLimitSeconds: {
      type: Number,
      default: 0,
      min: [TIME_LIMIT_MIN_SECONDS, 'Time limit cannot be negative'],
      max: [TIME_LIMIT_MAX_SECONDS, `Time limit cannot exceed ${TIME_LIMIT_MAX_SECONDS} seconds`],
      validate: {
        validator: (value) => Number.isInteger(value),
        message: 'Time limit must be an integer number of seconds.',
      },
    },
    questions: {
      type: [questionSchema],
      required: true,
      validate: {
        validator: (value) =>
          Array.isArray(value) &&
          value.length >= QUESTIONS_MIN_COUNT &&
          value.length <= QUESTIONS_MAX_COUNT,
        message: `A quiz needs ${QUESTIONS_MIN_COUNT}–${QUESTIONS_MAX_COUNT} questions.`,
      },
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true, versionKey: false },
    toObject: { virtuals: true, versionKey: false },
  },
);

/**
 * Returns a learner-safe projection of the quiz: question text and
 * options only, with `correctIndex` and `explanation` stripped from
 * every question. This is the ONLY shape that may be sent to a student
 * while they are taking the quiz.
 */
quizSchema.methods.toStudentView = function toStudentView() {
  return {
    _id: this._id,
    lessonId: this.lessonId,
    courseId: this.courseId,
    title: this.title,
    description: this.description,
    passingScore: this.passingScore,
    timeLimitSeconds: this.timeLimitSeconds,
    questions: this.questions.map((q) => ({
      _id: q._id,
      question: q.question,
      options: q.options,
    })),
  };
};

// Snapshot creation flag so the post-save hook can flip `Lesson.hasQuiz`
// only on first insert — re-saves (title edits, question tweaks) must
// not redundantly write the same value back to the parent lesson.
quizSchema.pre('save', function () {
  this.$locals.wasNew = this.isNew;
});

quizSchema.post('save', async function (doc) {
  if (!doc.$locals?.wasNew) return;

  const Lesson = mongoose.models.Lesson;
  if (!Lesson) return;

  await Lesson.updateOne({ _id: doc.lessonId }, { $set: { hasQuiz: true } });
});

// Shared cleanup for both `doc.deleteOne()` and `Model.findOneAndDelete()`.
// Resets `Lesson.hasQuiz` so the curriculum UI immediately stops rendering
// the quiz badge. The lesson may itself have just been deleted (cascade
// from `Lesson` post-delete hook) — `updateOne` is a no-op against a
// missing document, so the call is always safe.
const cascadeOnDelete = async (doc) => {
  if (!doc) return;

  const Lesson = mongoose.models.Lesson;
  if (!Lesson) return;

  await Lesson.updateOne({ _id: doc.lessonId }, { $set: { hasQuiz: false } });
};

quizSchema.post('deleteOne', { document: true, query: false }, async function () {
  await cascadeOnDelete(this);
});

quizSchema.post('findOneAndDelete', async function (doc) {
  await cascadeOnDelete(doc);
});

export const QUIZ_QUESTIONS_MIN_COUNT = QUESTIONS_MIN_COUNT;
export const QUIZ_QUESTIONS_MAX_COUNT = QUESTIONS_MAX_COUNT;
export const QUIZ_OPTIONS_MIN_COUNT = OPTIONS_MIN_COUNT;
export const QUIZ_OPTIONS_MAX_COUNT = OPTIONS_MAX_COUNT;
export const QUIZ_PASSING_SCORE_MIN = PASSING_SCORE_MIN;
export const QUIZ_PASSING_SCORE_MAX = PASSING_SCORE_MAX;
export const QUIZ_TIME_LIMIT_MAX_SECONDS = TIME_LIMIT_MAX_SECONDS;

export const Quiz = mongoose.models.Quiz || mongoose.model('Quiz', quizSchema);

export default Quiz;
