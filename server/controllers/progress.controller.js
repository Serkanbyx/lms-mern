/**
 * Progress controller — student-facing lesson completion + last-accessed
 * tracking for an enrolled course.
 *
 * Every handler here:
 *   1. Resolves the lesson by id and derives the parent `courseId` from
 *      the lesson document (NOT from the request body or query) so a
 *      malicious client cannot mark a lesson complete against a course
 *      it never enrolled in.
 *   2. Loads the requester's enrollment for that course and 403s when
 *      it is missing — even instructors and admins must be enrolled to
 *      record progress, because progress is per-learner state and an
 *      authoring view of "what students completed" lives behind a
 *      separate analytics surface.
 *   3. Mutates the enrollment via `addToSet` / `pull` so concurrent
 *      requests can't inflate `progressPercent` by inserting the same
 *      lesson twice. The `Enrollment.pre('save')` hook recomputes
 *      `progressPercent` and stamps `completedAt` exactly once when
 *      progress reaches 100% — we never write those derived fields by
 *      hand here.
 *
 * The response shape is stable across `markLessonComplete`,
 * `markLessonIncomplete`, and `getCourseProgress` so the client can
 * reuse the same reducer for both optimistic and authoritative updates.
 */

import { Course } from '../models/Course.model.js';
import { Enrollment } from '../models/Enrollment.model.js';
import { Lesson } from '../models/Lesson.model.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

/**
 * Build the public progress payload from an enrollment + course pair.
 * `totalLessons` is read off the denormalized course counter (kept
 * fresh by the Lesson hooks) so the client can render the correct
 * fraction without an extra `Lesson.countDocuments` round-trip.
 */
const buildProgressPayload = (enrollment, totalLessons) => ({
  progressPercent: enrollment.progressPercent,
  completedLessons: enrollment.completedLessons,
  completedAt: enrollment.completedAt,
  lastAccessedLesson: enrollment.lastAccessedLesson,
  totalLessons,
});

/**
 * Resolve the lesson + the requester's enrollment for the lesson's
 * parent course. Throws 404 when the lesson is missing and 403 when
 * the user is not enrolled in the lesson's course — never reveal that
 * the lesson exists to a non-enrolled requester (would leak draft
 * curriculum structure).
 */
const findEnrolledLessonContextOr403 = async (lessonId, user) => {
  const lesson = await Lesson.findById(lessonId).select('courseId');
  if (!lesson) throw ApiError.notFound('Lesson not found.');

  const enrollment = await Enrollment.findOne({
    userId: user._id,
    courseId: lesson.courseId,
  });

  if (!enrollment) {
    throw ApiError.forbidden('You must be enrolled in this course to track progress.');
  }

  return { lesson, enrollment };
};

/**
 * POST /api/lessons/:id/complete
 *
 * Idempotent. Re-marking an already-completed lesson is a no-op (no
 * percentage change, no duplicate id) thanks to `addToSet`. The
 * pre-save hook on Enrollment recomputes `progressPercent` from the
 * canonical lesson list and stamps `completedAt` the first time
 * progress hits 100%.
 */
export const markLessonComplete = asyncHandler(async (req, res) => {
  const { lesson, enrollment } = await findEnrolledLessonContextOr403(
    req.params.id,
    req.user,
  );

  enrollment.completedLessons.addToSet(lesson._id);
  await enrollment.save();

  const course = await Course.findById(enrollment.courseId).select('totalLessons').lean();
  res.json({
    success: true,
    data: buildProgressPayload(enrollment, course?.totalLessons ?? 0),
  });
});

/**
 * DELETE /api/lessons/:id/complete
 *
 * Idempotent removal — pulling a lesson that was never completed is a
 * no-op. The pre-save hook drops a stale `completedAt` if the
 * percentage falls back below 100%.
 */
export const markLessonIncomplete = asyncHandler(async (req, res) => {
  const { lesson, enrollment } = await findEnrolledLessonContextOr403(
    req.params.id,
    req.user,
  );

  enrollment.completedLessons.pull(lesson._id);
  await enrollment.save();

  const course = await Course.findById(enrollment.courseId).select('totalLessons').lean();
  res.json({
    success: true,
    data: buildProgressPayload(enrollment, course?.totalLessons ?? 0),
  });
});

/**
 * POST /api/lessons/:id/access
 *
 * Updates the "Continue learning" pointer to the lesson the user just
 * opened. We update via `updateOne` (rather than load + save) because
 * this endpoint is hit on every lesson click — the pre-save hook only
 * needs to fire when the lesson SET changes, and `lastAccessedLesson`
 * is not part of that derivation.
 */
export const setLastAccessed = asyncHandler(async (req, res) => {
  const { lesson, enrollment } = await findEnrolledLessonContextOr403(
    req.params.id,
    req.user,
  );

  await Enrollment.updateOne(
    { _id: enrollment._id },
    { $set: { lastAccessedLesson: lesson._id } },
  );

  res.json({
    success: true,
    data: { lastAccessedLesson: lesson._id },
  });
});

/**
 * GET /api/courses/:id/progress
 *
 * Returns the requester's progress payload for the course. Used by the
 * student dashboard and the lesson-player sidebar to render the
 * progress bar + completion checkmarks in a single round-trip.
 */
export const getCourseProgress = asyncHandler(async (req, res) => {
  const course = await Course.findById(req.params.id).select('totalLessons').lean();
  if (!course) throw ApiError.notFound('Course not found.');

  const enrollment = await Enrollment.findOne({
    userId: req.user._id,
    courseId: req.params.id,
  });

  if (!enrollment) throw ApiError.notFound('You are not enrolled in this course.');

  res.json({
    success: true,
    data: buildProgressPayload(enrollment, course.totalLessons ?? 0),
  });
});

export default {
  markLessonComplete,
  markLessonIncomplete,
  setLastAccessed,
  getCourseProgress,
};
