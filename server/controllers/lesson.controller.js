/**
 * Lesson controller — instructor-facing CRUD + reorder + detail endpoints.
 *
 * Lessons are the atomic playable / readable unit of a course; this file
 * is the authoring API surface (a separate student-facing controller is
 * added in a later step). Every mutation:
 *
 *  - Re-resolves the parent `Course` and asserts ownership on every
 *    request. Lesson ids alone are NOT a permission token. Failures are
 *    intentionally surfaced as 404 (never 403) to deny the id-space
 *    enumeration vector.
 *
 *  - Applies the documented mass-assignment whitelist
 *    (`title, type, videoUrl, videoPublicId, videoProvider, content,
 *     duration, isFreePreview`). `courseId`, `sectionId`, `order`,
 *    `hasQuiz`, and the timestamps are server-controlled and can NEVER
 *    flow in via the request body.
 *
 *  - Best-effort destroys the prior Cloudinary asset whenever a video is
 *    replaced or a lesson is deleted. The destroy is fire-and-forget on
 *    the response path: a Cloudinary outage must not roll back a
 *    successful database change. Failures are logged, never thrown.
 *
 * Counter consistency (`Course.totalLessons`, `Course.totalDuration`) is
 * maintained by the schema-level hooks on `Lesson` — the controller
 * never recomputes them by hand.
 */

import { cloudinary, signedVideoUrl } from '../config/cloudinary.js';
import { Course } from '../models/Course.model.js';
import { Lesson } from '../models/Lesson.model.js';
import { Section } from '../models/Section.model.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { pickFields } from '../utils/pickFields.js';

const LESSON_FIELDS = [
  'title',
  'type',
  'videoUrl',
  'videoPublicId',
  'videoProvider',
  'content',
  'duration',
  'isFreePreview',
];

const isAdmin = (user) => user?.role === 'admin';

const isOwner = (course, user) =>
  course?.instructor && user?._id && course.instructor.equals(user._id);

const findOwnedSectionOr404 = async (sectionId, user) => {
  const section = await Section.findById(sectionId);
  if (!section) throw ApiError.notFound('Section not found.');

  const course = await Course.findById(section.courseId);
  if (!course || (!isOwner(course, user) && !isAdmin(user))) {
    throw ApiError.notFound('Section not found.');
  }
  return { section, course };
};

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
 * Best-effort Cloudinary cleanup. We never let a Cloudinary failure
 * break the API contract — by the time we get here the database write
 * has already succeeded. Logging is enough for an operator to catch
 * orphaned assets in a periodic reconciliation script.
 */
const destroyCloudinaryVideo = async (publicId) => {
  if (!publicId) return;
  try {
    // Lesson videos live under `type: 'authenticated'` since STEP 47, so the
    // destroy call MUST pass the matching delivery type — otherwise Cloudinary
    // looks under the default `upload` namespace and silently returns
    // "not found" while the real asset stays orphaned in the account.
    await cloudinary.uploader.destroy(publicId, {
      resource_type: 'video',
      type: 'authenticated',
      invalidate: true,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(`[lesson] Cloudinary destroy failed for "${publicId}": ${err.message}`);
  }
};

/**
 * Project a Lesson document for an authoring response.
 *
 * STEP 47 — when the lesson is hosted on Cloudinary AND has a publicId, we
 * replace the stored `videoUrl` (the unplayable authenticated URL recorded at
 * upload time) with a freshly minted, short-lived signed URL. YouTube / Vimeo
 * provider lessons are returned untouched because their URLs are governed by
 * the provider's own access controls.
 */
const projectLessonForResponse = (lesson) => {
  const obj = typeof lesson.toObject === 'function' ? lesson.toObject() : { ...lesson };
  if (obj.videoProvider === 'cloudinary' && obj.videoPublicId) {
    obj.videoUrl = signedVideoUrl(obj.videoPublicId);
  }
  return obj;
};

/**
 * POST /api/sections/:sectionId/lessons
 * Auto-numbers `order` as `(max existing order) + 1`. The Lesson model's
 * post-save hook bumps `Course.totalLessons` and `Course.totalDuration`.
 */
export const createLesson = asyncHandler(async (req, res) => {
  const { section } = await findOwnedSectionOr404(req.params.sectionId, req.user);
  const data = pickFields(req.body, LESSON_FIELDS);

  const last = await Lesson.findOne({ sectionId: section._id })
    .sort({ order: -1 })
    .select('order')
    .lean();
  const order = (last?.order ?? -1) + 1;

  const lesson = await Lesson.create({
    ...data,
    sectionId: section._id,
    courseId: section.courseId,
    order,
  });

  res.status(201).json({ success: true, lesson: projectLessonForResponse(lesson) });
});

/**
 * PATCH /api/lessons/:id
 *
 * If the request swaps in a new `videoPublicId`, the previous Cloudinary
 * asset is destroyed AFTER the database save succeeds. Doing it before
 * the save would leak the prior video on a failed save; doing it inline
 * with the response means a Cloudinary slowdown can't bottleneck the
 * authoring UI.
 */
export const updateLesson = asyncHandler(async (req, res) => {
  const { lesson } = await findOwnedLessonOr404(req.params.id, req.user);
  const updates = pickFields(req.body, LESSON_FIELDS);

  if (Object.keys(updates).length === 0) {
    throw ApiError.badRequest('No updatable fields provided.');
  }

  const previousPublicId = lesson.videoPublicId;
  Object.assign(lesson, updates);
  await lesson.save();

  const replacedVideo =
    Object.prototype.hasOwnProperty.call(updates, 'videoPublicId') &&
    previousPublicId &&
    previousPublicId !== lesson.videoPublicId;

  if (replacedVideo) {
    await destroyCloudinaryVideo(previousPublicId);
  }

  res.json({ success: true, lesson: projectLessonForResponse(lesson) });
});

/**
 * DELETE /api/lessons/:id
 * Per-document `deleteOne()` triggers the Lesson schema cascade hook,
 * which decrements the parent course counters and removes any attached
 * quiz.
 */
export const deleteLesson = asyncHandler(async (req, res) => {
  const { lesson } = await findOwnedLessonOr404(req.params.id, req.user);
  const publicId = lesson.videoPublicId;

  await lesson.deleteOne();
  await destroyCloudinaryVideo(publicId);

  res.json({ success: true, message: 'Lesson deleted successfully.' });
});

/**
 * PATCH /api/sections/:sectionId/lessons/reorder
 * Body: `[{ id, order }, ...]`
 *
 * All ids must belong to the same parent section. We use the same
 * two-phase strategy as `reorderSections` to dodge the unique
 * `{ sectionId, order }` index during the in-place renumber.
 */
export const reorderLessons = asyncHandler(async (req, res) => {
  const { section } = await findOwnedSectionOr404(req.params.sectionId, req.user);
  const items = req.body;

  const ids = items.map((item) => item.id);
  const owned = await Lesson.countDocuments({ _id: { $in: ids }, sectionId: section._id });
  if (owned !== items.length) {
    throw ApiError.badRequest('Some lessons do not belong to this section.');
  }

  const tempOps = items.map((item, idx) => ({
    updateOne: {
      filter: { _id: item.id },
      update: { $set: { order: -(idx + 1) } },
    },
  }));
  await Lesson.bulkWrite(tempOps, { ordered: true });

  const finalOps = items.map((item) => ({
    updateOne: {
      filter: { _id: item.id },
      update: { $set: { order: item.order } },
    },
  }));
  await Lesson.bulkWrite(finalOps, { ordered: true });

  const lessons = await Lesson.find({ sectionId: section._id }).sort({ order: 1 });
  res.json({ success: true, lessons: lessons.map(projectLessonForResponse) });
});

/**
 * GET /api/lessons/:id
 * Instructor view — returns the full document including authoring-only
 * fields (`videoPublicId`, internal flags). The student-facing detail
 * endpoint (added in a later step) returns a redacted projection.
 */
export const getLessonForInstructor = asyncHandler(async (req, res) => {
  const { lesson } = await findOwnedLessonOr404(req.params.id, req.user);
  res.json({ success: true, lesson: projectLessonForResponse(lesson) });
});

export default {
  createLesson,
  updateLesson,
  deleteLesson,
  reorderLessons,
  getLessonForInstructor,
};
