/**
 * Section controller — instructor-facing CRUD + reorder endpoints.
 *
 * Sections are the chapter grouping that sits between a `Course` and its
 * `Lesson` documents. Every mutation in this file:
 *
 *  - Re-checks the parent course's ownership (or admin role) on every
 *    request. Section ids alone are NOT a permission token — an attacker
 *    who guesses a section id must still own (or be admin on) the parent
 *    course before the controller will act on it. To prevent id-space
 *    enumeration, ownership failures return 404 (same as "not found")
 *    instead of 403.
 *
 *  - Treats `courseId` and `order` as server-controlled. They are derived
 *    from the URL params and the auto-numbering logic below; the request
 *    body is funneled through `pickFields(['title'])` so nothing else can
 *    leak in via mass-assignment.
 *
 *  - On delete, cascades through every dependent `Lesson` by calling
 *    `doc.deleteOne()` per lesson rather than `Lesson.deleteMany()`. The
 *    document-level hook on the Lesson model is what (a) decrements
 *    `Course.totalLessons` / `Course.totalDuration` and (b) deletes the
 *    associated `Quiz`. `deleteMany` skips that hook entirely, which
 *    would silently corrupt the parent counters — the per-document path
 *    is slower but guarantees consistency.
 *
 *  - On reorder, applies a two-phase write: first re-numbers every
 *    targeted document to a temporary negative slot to dodge the unique
 *    `{ courseId, order }` index, then writes the requested final
 *    positions. `bulkWrite({ ordered: true })` keeps the operations
 *    sequential so a mid-batch failure leaves the data in a recoverable
 *    state instead of a half-shuffled mess.
 */

import { Course } from '../models/Course.model.js';
import { Lesson } from '../models/Lesson.model.js';
import { Section } from '../models/Section.model.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { pickFields } from '../utils/pickFields.js';

const SECTION_FIELDS = ['title'];

const isAdmin = (user) => user?.role === 'admin';

const isOwner = (course, user) =>
  course?.instructor && user?._id && course.instructor.equals(user._id);

/**
 * Resolve a course by id and assert the requester can mutate it. 404s
 * for both "missing" and "not yours" so attackers cannot probe the id
 * space to enumerate someone else's catalog.
 */
const findOwnedCourseOr404 = async (courseId, user) => {
  const course = await Course.findById(courseId);
  if (!course) throw ApiError.notFound('Course not found.');
  if (!isOwner(course, user) && !isAdmin(user)) {
    throw ApiError.notFound('Course not found.');
  }
  return course;
};

/**
 * Resolve a section AND its parent course in a single helper, returning
 * a 404 if either is missing or the requester does not own the course.
 */
const findOwnedSectionOr404 = async (sectionId, user) => {
  const section = await Section.findById(sectionId);
  if (!section) throw ApiError.notFound('Section not found.');

  const course = await Course.findById(section.courseId);
  if (!course || (!isOwner(course, user) && !isAdmin(user))) {
    throw ApiError.notFound('Section not found.');
  }
  return { section, course };
};

/**
 * POST /api/courses/:courseId/sections
 * Auto-assigns `order` as `(max existing order) + 1` so new sections
 * always land at the end of the chapter list.
 */
export const createSection = asyncHandler(async (req, res) => {
  const course = await findOwnedCourseOr404(req.params.courseId, req.user);
  const { title } = pickFields(req.body, SECTION_FIELDS);

  const last = await Section.findOne({ courseId: course._id })
    .sort({ order: -1 })
    .select('order')
    .lean();
  const order = (last?.order ?? -1) + 1;

  const section = await Section.create({
    courseId: course._id,
    title,
    order,
  });

  res.status(201).json({ success: true, section });
});

/**
 * PATCH /api/sections/:id
 * Title-only edit. `courseId` and `order` are immutable through this
 * endpoint — order changes go through `reorderSections`.
 */
export const updateSection = asyncHandler(async (req, res) => {
  const { section } = await findOwnedSectionOr404(req.params.id, req.user);
  const updates = pickFields(req.body, SECTION_FIELDS);

  if (Object.keys(updates).length === 0) {
    throw ApiError.badRequest('No updatable fields provided.');
  }

  Object.assign(section, updates);
  await section.save();

  res.json({ success: true, section });
});

/**
 * DELETE /api/sections/:id
 * Cascades through every nested lesson via per-document deletes so the
 * lesson schema's post-deleteOne hook can decrement the parent course's
 * counters and tear down associated quizzes.
 */
export const deleteSection = asyncHandler(async (req, res) => {
  const { section } = await findOwnedSectionOr404(req.params.id, req.user);

  const lessons = await Lesson.find({ sectionId: section._id });
  for (const lesson of lessons) {
    await lesson.deleteOne();
  }

  await section.deleteOne();

  res.json({ success: true, message: 'Section deleted successfully.' });
});

/**
 * PATCH /api/courses/:courseId/sections/reorder
 * Body: `[{ id, order }, ...]`
 *
 * All submitted ids must belong to the same parent course (defense
 * against an attacker reshuffling sections across courses by stitching
 * together ids they happen to know). The unique `{ courseId, order }`
 * index would normally make a naive in-place re-number throw a
 * duplicate-key error mid-batch, so we apply a two-phase update.
 */
export const reorderSections = asyncHandler(async (req, res) => {
  const course = await findOwnedCourseOr404(req.params.courseId, req.user);
  const items = req.body;

  const ids = items.map((item) => item.id);
  const owned = await Section.countDocuments({ _id: { $in: ids }, courseId: course._id });
  if (owned !== items.length) {
    throw ApiError.badRequest('Some sections do not belong to this course.');
  }

  const tempOps = items.map((item, idx) => ({
    updateOne: {
      filter: { _id: item.id },
      update: { $set: { order: -(idx + 1) } },
    },
  }));
  await Section.bulkWrite(tempOps, { ordered: true });

  const finalOps = items.map((item) => ({
    updateOne: {
      filter: { _id: item.id },
      update: { $set: { order: item.order } },
    },
  }));
  await Section.bulkWrite(finalOps, { ordered: true });

  const sections = await Section.find({ courseId: course._id }).sort({ order: 1 });
  res.json({ success: true, sections });
});

export default {
  createSection,
  updateSection,
  deleteSection,
  reorderSections,
};
