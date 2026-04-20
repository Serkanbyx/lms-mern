/**
 * Lesson schema — the atomic, playable / readable unit of a course.
 *
 * A Lesson belongs to exactly one `Section` (and, denormalized for fast
 * filtering, one `Course`). Two flavors are supported:
 *  - `video` lessons stream from Cloudinary (or, optionally, YouTube /
 *    Vimeo) and require an HTTPS `videoUrl`.
 *  - `text` lessons store inline rich-text `content` (≤ 50 000 chars).
 *
 * Lifecycle hooks keep the parent `Course` document's denormalized
 * counters (`totalLessons`, `totalDuration`) consistent with reality on
 * insert, duration change, and delete — so list / detail endpoints can
 * read a single Course document instead of recomputing aggregates per
 * request.
 *
 * SECURITY:
 *  - `videoUrl` MUST be HTTPS. Plain-HTTP video would (a) break under
 *    strict mixed-content rules in modern browsers and (b) expose the
 *    stream to MITM tampering / surveillance.
 *  - `isFreePreview` is the ONLY mechanism that lets a non-enrolled,
 *    unauthenticated visitor stream a lesson. Defaulting it to `false`
 *    means accidental publication never leaks paid content.
 *  - `courseId` and `sectionId` are server-derived (URL params + section
 *    lookup) — never accepted from the request body (mass-assignment).
 *  - On lesson delete, any associated `Quiz` is removed and the parent
 *    `Course` counters are recomputed. The Quiz model may not yet be
 *    registered when this file loads (registration order varies between
 *    server boot and isolated tests), so we resolve it lazily via
 *    `mongoose.models.Quiz` and skip cleanup when it is absent.
 *
 * MONGOOSE 9: Pre-hooks no longer receive a `next` callback — early
 * `return` (or `throw`) exits the hook. Post-hooks still receive the
 * persisted document.
 */

import mongoose from 'mongoose';

const { Schema } = mongoose;

const LESSON_TYPES = Object.freeze(['video', 'text']);
const VIDEO_PROVIDERS = Object.freeze(['cloudinary', 'youtube', 'vimeo']);

const HTTPS_URL_REGEX = /^https:\/\/[^\s]+$/i;
const CONTENT_MAX_LENGTH = 50_000;

const lessonSchema = new Schema(
  {
    courseId: {
      type: Schema.Types.ObjectId,
      ref: 'Course',
      required: [true, 'Course reference is required'],
      index: true,
    },
    sectionId: {
      type: Schema.Types.ObjectId,
      ref: 'Section',
      required: [true, 'Section reference is required'],
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      minlength: [3, 'Title must be at least 3 characters'],
      maxlength: [120, 'Title must be at most 120 characters'],
    },
    type: {
      type: String,
      required: [true, 'Lesson type is required'],
      enum: {
        values: LESSON_TYPES,
        message: `Lesson type must be one of: ${LESSON_TYPES.join(', ')}`,
      },
    },
    videoUrl: {
      type: String,
      trim: true,
      default: '',
      validate: {
        validator(value) {
          if (this.type !== 'video') return true;
          return typeof value === 'string' && HTTPS_URL_REGEX.test(value);
        },
        message: 'Video lessons require a valid HTTPS videoUrl.',
      },
    },
    videoPublicId: {
      type: String,
      trim: true,
      default: '',
    },
    videoProvider: {
      type: String,
      default: 'cloudinary',
      enum: {
        values: VIDEO_PROVIDERS,
        message: `Video provider must be one of: ${VIDEO_PROVIDERS.join(', ')}`,
      },
    },
    content: {
      type: String,
      default: '',
      maxlength: [CONTENT_MAX_LENGTH, `Content must be at most ${CONTENT_MAX_LENGTH} characters`],
      validate: {
        validator(value) {
          if (this.type !== 'text') return true;
          return typeof value === 'string' && value.trim().length > 0;
        },
        message: 'Text lessons require non-empty content.',
      },
    },
    duration: {
      type: Number,
      required: true,
      default: 0,
      min: [0, 'Duration cannot be negative'],
    },
    order: {
      type: Number,
      required: [true, 'Order is required'],
      min: [0, 'Order cannot be negative'],
    },
    isFreePreview: {
      type: Boolean,
      default: false,
    },
    hasQuiz: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true, versionKey: false },
    toObject: { virtuals: true, versionKey: false },
  },
);

// Guarantees deterministic lesson ordering inside a section and blocks
// two concurrent inserts from claiming the same slot.
lessonSchema.index({ sectionId: 1, order: 1 }, { unique: true });

// Snapshot the pre-mutation duration on $locals so the post-save hook
// can push the correct delta to the parent course. Mongoose does not
// expose a stable public API for "previous value of a modified path", so
// for genuine duration edits we re-read the persisted value from disk —
// far safer than guessing at internals like `doc.$__.savedState`.
lessonSchema.pre('save', async function () {
  this.$locals.wasNew = this.isNew;

  if (this.isNew || !this.isModified('duration')) {
    this.$locals.previousDuration = this.isNew ? 0 : this.duration;
    return;
  }

  const original = await this.constructor.findById(this._id, 'duration').lean();
  this.$locals.previousDuration = original?.duration ?? 0;
});

// Keep `Course.totalLessons` and `Course.totalDuration` in sync. Brand-new
// lessons add their full duration; subsequent saves only push the delta
// when `duration` actually changed (controllers re-save lessons for many
// unrelated reasons — title edits, reorder, free-preview toggle).
lessonSchema.post('save', async function (doc) {
  const Course = mongoose.models.Course;
  if (!Course) return;

  if (doc.$locals.wasNew) {
    await Course.updateOne(
      { _id: doc.courseId },
      { $inc: { totalLessons: 1, totalDuration: doc.duration } },
    );
    return;
  }

  const delta = doc.duration - (doc.$locals.previousDuration ?? doc.duration);
  if (delta !== 0) {
    await Course.updateOne({ _id: doc.courseId }, { $inc: { totalDuration: delta } });
  }
});

// Shared cleanup for both `doc.deleteOne()` (document middleware) and
// `Model.findOneAndDelete()` (query middleware). Decrements the parent
// course counters and tears down the orphan quiz, if one exists.
const cascadeOnDelete = async (doc) => {
  if (!doc) return;

  const Course = mongoose.models.Course;
  if (Course) {
    await Course.updateOne(
      { _id: doc.courseId },
      { $inc: { totalLessons: -1, totalDuration: -(doc.duration ?? 0) } },
    );
  }

  const Quiz = mongoose.models.Quiz;
  if (Quiz) {
    await Quiz.deleteOne({ lessonId: doc._id });
  }
};

lessonSchema.post('deleteOne', { document: true, query: false }, async function () {
  await cascadeOnDelete(this);
});

lessonSchema.post('findOneAndDelete', async function (doc) {
  await cascadeOnDelete(doc);
});

export const LESSON_TYPE_VALUES = LESSON_TYPES;
export const LESSON_VIDEO_PROVIDERS = VIDEO_PROVIDERS;
export const LESSON_CONTENT_MAX_LENGTH = CONTENT_MAX_LENGTH;

export const Lesson = mongoose.models.Lesson || mongoose.model('Lesson', lessonSchema);

export default Lesson;
