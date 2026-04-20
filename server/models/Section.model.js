/**
 * Section schema — a course's chapter / module grouping.
 *
 * Sections live in their own collection (rather than as an embedded array
 * inside `Course`) so we can paginate, reorder, and delete chapters
 * independently without rewriting the entire course document. They are
 * exposed back to clients through the `Course.sections` virtual.
 *
 * SECURITY:
 *  - `courseId` is set server-side from the URL parameter / authenticated
 *    instructor's ownership check. Never accept it from the request body
 *    (mass-assignment guard).
 *  - The compound unique index `{ courseId, order }` prevents two sections
 *    in the same course from claiming the same position even under race
 *    conditions (the database — not the controller — is the source of
 *    truth for ordering integrity).
 *  - Cascade deletion of dependent `Lesson` documents is the controller's
 *    responsibility; the schema intentionally avoids destructive hooks to
 *    keep `Section.deleteOne()` predictable for tests and scripts.
 *
 * MONGOOSE 9: Pre-hooks no longer receive a `next` callback — early
 * `return` (or `throw`) exits the hook.
 */

import mongoose from 'mongoose';

const { Schema } = mongoose;

const sectionSchema = new Schema(
  {
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
      minlength: [3, 'Title must be at least 3 characters'],
      maxlength: [120, 'Title must be at most 120 characters'],
    },
    order: {
      type: Number,
      required: [true, 'Order is required'],
      min: [0, 'Order cannot be negative'],
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true, versionKey: false },
    toObject: { virtuals: true, versionKey: false },
  },
);

// Guarantees deterministic chapter ordering per course and prevents two
// sections from racing into the same slot on concurrent inserts.
sectionSchema.index({ courseId: 1, order: 1 }, { unique: true });

// Lessons live in a sibling collection. Surfacing them as a virtual keeps
// `section.populate('lessons')` ergonomic without hard-coding the sort
// order in every controller.
sectionSchema.virtual('lessons', {
  ref: 'Lesson',
  localField: '_id',
  foreignField: 'sectionId',
  options: { sort: { order: 1 } },
});

export const Section = mongoose.models.Section || mongoose.model('Section', sectionSchema);

export default Section;
