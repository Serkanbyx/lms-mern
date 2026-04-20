/**
 * Enrollment controller — student-facing join between a `User` and a
 * `Course`. Handles enroll / list / detail / unenroll.
 *
 * Security guarantees enforced here:
 *  - `userId` and `courseId` are ALWAYS derived from the authenticated
 *    session and the URL params — never from the request body. The
 *    Enrollment schema also rejects writes that try to set them via
 *    mass-assignment, but we never give the client that opportunity in
 *    the first place.
 *  - Duplicate enrollment is prevented by the compound unique index
 *    `{ userId, courseId }` on the schema. We attempt the insert and
 *    translate the inevitable `E11000` into a friendly 409 — this is
 *    the only race-safe pattern (a "find then create" pre-check would
 *    still let two concurrent requests slip through).
 *  - Only `published` courses can be enrolled in. Drafts, pending,
 *    rejected, and archived courses all return 400 — the same status
 *    rule that hides them from the public catalog.
 *  - Instructors cannot enroll in their own course (would inflate the
 *    `enrollmentCount` counter and skew analytics). Returns 400.
 *  - Unenroll cascades: the matching `QuizAttempt` documents for the
 *    same (userId, courseId) pair are removed so a re-enrollment
 *    starts on a clean slate. The Enrollment document's
 *    `findOneAndDelete` post-hook then decrements
 *    `Course.enrollmentCount`.
 */

import { Course } from '../models/Course.model.js';
import { Enrollment } from '../models/Enrollment.model.js';
import { QuizAttempt } from '../models/QuizAttempt.model.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

import { ENROLLMENT_PAGINATION_DEFAULTS } from '../validators/enrollment.validator.js';

const COURSE_CARD_FIELDS = [
  'title',
  'slug',
  'shortDescription',
  'thumbnail',
  'category',
  'level',
  'language',
  'totalLessons',
  'totalDuration',
  'instructor',
  'publishedAt',
].join(' ');

/**
 * Translate `?status=` / `?page=` / `?limit=` into a Mongo filter and
 * pagination tuple for the `GET /api/enrollments/mine` listing. The
 * incoming query has already been bound to `[1, MAX]` by the validator
 * (`toInt()`), so we only need to supply defaults.
 */
const buildMyEnrollmentsQuery = (query, userId) => {
  const filter = { userId };

  if (query.status === 'completed') {
    filter.completedAt = { $ne: null };
  } else if (query.status === 'in-progress') {
    filter.completedAt = null;
  }

  const page = query.page ?? 1;
  const limit = query.limit ?? ENROLLMENT_PAGINATION_DEFAULTS.defaultLimit;

  return {
    filter,
    page,
    limit,
    skip: (page - 1) * limit,
  };
};

/**
 * POST /api/courses/:id/enroll
 *
 * Creates the (userId, courseId) enrollment. The post-save hook on the
 * Enrollment schema bumps `Course.enrollmentCount` once — never compute
 * the counter here or it will double-count.
 */
export const enrollInCourse = asyncHandler(async (req, res) => {
  const course = await Course.findById(req.params.id).select('status instructor');
  if (!course) throw ApiError.notFound('Course not found.');

  if (course.status !== 'published') {
    throw ApiError.badRequest('Only published courses can be enrolled in.');
  }

  if (course.instructor.equals(req.user._id)) {
    throw ApiError.badRequest('Instructors cannot enroll in their own course.');
  }

  try {
    const enrollment = await Enrollment.create({
      userId: req.user._id,
      courseId: course._id,
    });
    return res.status(201).json({ success: true, enrollment });
  } catch (err) {
    // Race-safe duplicate guard — translate the unique-index violation
    // to a 409 instead of leaking the raw Mongo error.
    if (err?.code === 11000) {
      throw ApiError.conflict('You are already enrolled in this course.');
    }
    throw err;
  }
});

/**
 * GET /api/enrollments/mine
 *
 * Paginated dashboard feed for the authenticated user. Populates the
 * trimmed `COURSE_CARD_FIELDS` projection so the UI can render
 * "Continue learning" cards without a follow-up round-trip.
 */
export const getMyEnrollments = asyncHandler(async (req, res) => {
  const { filter, page, limit, skip } = buildMyEnrollmentsQuery(req.query, req.user._id);

  const [items, total] = await Promise.all([
    Enrollment.find(filter)
      .sort({ enrolledAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate({
        path: 'courseId',
        select: COURSE_CARD_FIELDS,
        populate: { path: 'instructor', select: 'name avatar headline' },
      })
      .lean(),
    Enrollment.countDocuments(filter),
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
 * GET /api/courses/:id/enrollment
 *
 * Returns the requester's enrollment for this course, or 404 if they
 * are not enrolled. Used by the course detail page to decide between
 * the "Enroll" and "Continue learning" CTAs.
 */
export const getEnrollmentForCourse = asyncHandler(async (req, res) => {
  const enrollment = await Enrollment.findOne({
    userId: req.user._id,
    courseId: req.params.id,
  });

  if (!enrollment) throw ApiError.notFound('You are not enrolled in this course.');

  res.json({ success: true, enrollment });
});

/**
 * DELETE /api/courses/:id/enroll
 *
 * Removes the enrollment AND the user's quiz attempts for this course.
 * The schema-level `findOneAndDelete` post-hook decrements
 * `Course.enrollmentCount` so we never touch that counter by hand.
 *
 * Quiz attempts are wiped first (rather than after) so that, in the
 * unlikely event the enrollment delete fails, we don't leave attempt
 * rows belonging to a "ghost" enrollment. A failed re-attempt of the
 * unenroll then simply finds nothing left to remove — both operations
 * are idempotent on retry.
 */
export const unenroll = asyncHandler(async (req, res) => {
  const enrollment = await Enrollment.findOne({
    userId: req.user._id,
    courseId: req.params.id,
  });

  if (!enrollment) throw ApiError.notFound('You are not enrolled in this course.');

  await QuizAttempt.deleteMany({ userId: req.user._id, courseId: enrollment.courseId });
  await Enrollment.findOneAndDelete({ _id: enrollment._id });

  res.json({ success: true, message: 'Unenrolled successfully.' });
});

export default {
  enrollInCourse,
  getMyEnrollments,
  getEnrollmentForCourse,
  unenroll,
};
