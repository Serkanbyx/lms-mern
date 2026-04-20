/**
 * Course schema — the catalog's primary aggregate.
 *
 * A Course owns descriptive marketing content (title, description,
 * thumbnail, taxonomy, learning outcomes), a publication lifecycle
 * (`draft → pending → published | rejected → archived`) moderated by
 * admins, and three denormalized counters (`totalLessons`,
 * `totalDuration`, `enrollmentCount`) that are kept fresh by hooks on
 * the related `Section`, `Lesson`, and `Enrollment` collections.
 *
 * SECURITY:
 *  - Public listing endpoints MUST filter `{ status: 'published' }`.
 *    Drafts/pending/rejected courses are visible only to the owning
 *    instructor or to admins (enforced in controllers + middleware).
 *  - `instructor` is set server-side from the authenticated user; never
 *    accept it from the request body (mass-assignment guard).
 *  - `slug` is regenerated from `title` on every title change inside the
 *    pre-save hook. Clients cannot set `slug` directly — it is stripped
 *    by the controller's whitelist + enforced uniquely by an index.
 *  - `status` transitions are gated by RBAC + workflow rules in the
 *    controller; the schema only declares the allowed terminal states.
 *  - `tags` are lowercased and trimmed at the schema layer to prevent
 *    case-folding duplicates and to keep search indexes deterministic.
 *
 * MONGOOSE 9: Pre-hooks no longer receive a `next` callback — early
 * `return` (or `throw`) exits the hook.
 */

import mongoose from 'mongoose';

import { slugify } from '../utils/slugify.js';

const { Schema } = mongoose;

const CATEGORIES = Object.freeze([
  'programming',
  'design',
  'business',
  'marketing',
  'data-science',
  'language',
  'other',
]);

const LEVELS = Object.freeze(['beginner', 'intermediate', 'advanced']);

const STATUSES = Object.freeze([
  'draft',
  'pending',
  'published',
  'rejected',
  'archived',
]);

const TAG_MAX_LENGTH = 20;
const TAGS_MAX_COUNT = 10;
const REQUIREMENTS_MAX_COUNT = 10;
const OUTCOMES_MAX_COUNT = 10;

const thumbnailSchema = new Schema(
  {
    url: { type: String, default: '', trim: true },
    publicId: { type: String, default: '', trim: true },
  },
  { _id: false },
);

const arrayMaxLength = (limit, label) => ({
  validator: (value) => !Array.isArray(value) || value.length <= limit,
  message: `${label} must contain at most ${limit} items.`,
});

const tagItemValidator = {
  validator: (value) =>
    typeof value === 'string' && value.length > 0 && value.length <= TAG_MAX_LENGTH,
  message: `Each tag must be 1–${TAG_MAX_LENGTH} characters.`,
};

const courseSchema = new Schema(
  {
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      minlength: [5, 'Title must be at least 5 characters'],
      maxlength: [120, 'Title must be at most 120 characters'],
    },
    slug: {
      type: String,
      unique: true,
      lowercase: true,
      trim: true,
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
      minlength: [20, 'Description must be at least 20 characters'],
      maxlength: [5000, 'Description must be at most 5000 characters'],
    },
    shortDescription: {
      type: String,
      default: '',
      trim: true,
      maxlength: [200, 'Short description must be at most 200 characters'],
    },
    instructor: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Instructor is required'],
      index: true,
    },
    price: {
      type: Number,
      required: true,
      default: 0,
      min: [0, 'Price cannot be negative'],
      max: [9999, 'Price cannot exceed 9999'],
    },
    thumbnail: { type: thumbnailSchema, default: () => ({}) },
    category: {
      type: String,
      required: [true, 'Category is required'],
      enum: {
        values: CATEGORIES,
        message: `Category must be one of: ${CATEGORIES.join(', ')}`,
      },
    },
    level: {
      type: String,
      required: true,
      default: 'beginner',
      enum: {
        values: LEVELS,
        message: `Level must be one of: ${LEVELS.join(', ')}`,
      },
    },
    language: { type: String, default: 'en', trim: true, lowercase: true },
    tags: {
      type: [
        {
          type: String,
          trim: true,
          lowercase: true,
          validate: tagItemValidator,
        },
      ],
      default: [],
      validate: arrayMaxLength(TAGS_MAX_COUNT, 'Tags'),
    },
    requirements: {
      type: [{ type: String, trim: true, maxlength: 200 }],
      default: [],
      validate: arrayMaxLength(REQUIREMENTS_MAX_COUNT, 'Requirements'),
    },
    learningOutcomes: {
      type: [{ type: String, trim: true, maxlength: 200 }],
      default: [],
      validate: arrayMaxLength(OUTCOMES_MAX_COUNT, 'Learning outcomes'),
    },
    status: {
      type: String,
      required: true,
      default: 'draft',
      enum: {
        values: STATUSES,
        message: `Status must be one of: ${STATUSES.join(', ')}`,
      },
      index: true,
    },
    rejectionReason: {
      type: String,
      default: '',
      trim: true,
      maxlength: [500, 'Rejection reason must be at most 500 characters'],
    },
    totalLessons: { type: Number, default: 0, min: 0 },
    totalDuration: { type: Number, default: 0, min: 0 },
    enrollmentCount: { type: Number, default: 0, min: 0 },
    averageRating: { type: Number, default: 0, min: 0, max: 5 },
    publishedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true, versionKey: false },
    toObject: { virtuals: true, versionKey: false },
  },
);

courseSchema.index({ instructor: 1, status: 1 });
courseSchema.index({ status: 1, publishedAt: -1 });
courseSchema.index(
  { title: 'text', description: 'text', tags: 'text' },
  { name: 'CourseTextSearch', weights: { title: 10, tags: 5, description: 1 } },
);

// Sections are stored in a sibling collection. Exposing them as a virtual
// keeps the read API ergonomic (`course.populate('sections')`) without
// duplicating ordering logic across controllers.
courseSchema.virtual('sections', {
  ref: 'Section',
  localField: '_id',
  foreignField: 'courseId',
  options: { sort: { order: 1 } },
});

// MONGOOSE 9: no `next` parameter. Regenerate slug only on title change so
// re-saves (counter bumps, status flips) don't churn the unique index. Set
// `publishedAt` once, the first time the course transitions to `published`.
courseSchema.pre('save', async function () {
  if (this.isModified('title')) {
    this.slug = slugify(this.title);
  }
  if (this.isModified('status') && this.status === 'published' && !this.publishedAt) {
    this.publishedAt = new Date();
  }
});

export const COURSE_CATEGORIES = CATEGORIES;
export const COURSE_LEVELS = LEVELS;
export const COURSE_STATUSES = STATUSES;

export const Course = mongoose.models.Course || mongoose.model('Course', courseSchema);

export default Course;
