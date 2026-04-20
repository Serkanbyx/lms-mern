/**
 * Course controller — instructor-facing CRUD + lifecycle endpoints.
 *
 * Public catalog/detail handlers (`GET /api/courses`, `GET /:slug`, …) are
 * intentionally NOT in this file — they belong to a later step that mounts
 * them on the same router. Keeping the surfaces split prevents an
 * authorization regression where a public endpoint accidentally inherits a
 * `protect`-only middleware stack at the router level.
 *
 * Security guarantees enforced here:
 *  - Mass-assignment: every body is run through `pickFields` so only the
 *    documented field set can flow into the database. `instructor`,
 *    `slug`, `status`, `publishedAt`, and the denormalized counters can
 *    NEVER be set or mutated by request payloads.
 *  - Ownership: every read/update/delete confirms either the requester
 *    owns the course (`course.instructor.equals(req.user._id)`) or they
 *    are an admin. A 404 is returned for non-owners — leaking 403 vs 404
 *    would let attackers enumerate course ids.
 *  - Status state machine: status mutations only happen via the dedicated
 *    `submitForReview` / `archiveCourse` endpoints with strict source-state
 *    checks. The generic `updateCourse` endpoint refuses to touch `status`.
 *  - Published-course lockdown: once a course is `published`, only soft
 *    fields (description, marketing copy, thumbnail, taxonomy lists) can
 *    be edited inline. Title, price, category, level, and language all
 *    require an explicit re-submission flow (added in a later step) so
 *    enrolled students never see surprise changes to the product they
 *    paid for.
 *  - Delete protection: a non-admin owner cannot delete a course with
 *    active enrollments — they are nudged toward `archiveCourse` instead.
 *    Admins can force-delete (with the same cascade) for moderation.
 */

import mongoose from 'mongoose';

import { Course } from '../models/Course.model.js';
import { Enrollment } from '../models/Enrollment.model.js';
import { Lesson } from '../models/Lesson.model.js';
import { Quiz } from '../models/Quiz.model.js';
import { QuizAttempt } from '../models/QuizAttempt.model.js';
import { Section } from '../models/Section.model.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { pickFields } from '../utils/pickFields.js';

const CREATE_FIELDS = [
  'title',
  'description',
  'shortDescription',
  'price',
  'thumbnail',
  'category',
  'level',
  'language',
  'tags',
  'requirements',
  'learningOutcomes',
];

// Fields editable while the course is in draft / pending / rejected /
// archived. Note the deliberate absence of `status`, `instructor`, `slug`,
// and every denormalized counter — those are server-controlled.
const EDIT_FIELDS_DRAFT = CREATE_FIELDS;

// Once a course is `published` we lock down the fields enrolled students
// rely on (title, price, category, level, language). Marketing copy and
// taxonomy stay editable so instructors can still respond to feedback
// without yanking out the rug from under paying learners.
const EDIT_FIELDS_PUBLISHED = Object.freeze([
  'description',
  'shortDescription',
  'tags',
  'requirements',
  'learningOutcomes',
  'thumbnail',
]);

const PAGINATION_DEFAULT_LIMIT = 20;
const PAGINATION_MAX_LIMIT = 50;

const isAdmin = (user) => user?.role === 'admin';

const isOwner = (course, user) =>
  course?.instructor && user?._id && course.instructor.equals(user._id);

/**
 * Fetch the course by id and assert the requester can act on it. Returns a
 * 404 for both "not found" and "not yours" so attackers cannot probe the
 * id space to enumerate someone else's catalog.
 */
const findOwnedCourseOr404 = async (id, user) => {
  const course = await Course.findById(id);
  if (!course) throw ApiError.notFound('Course not found.');
  if (!isOwner(course, user) && !isAdmin(user)) {
    throw ApiError.notFound('Course not found.');
  }
  return course;
};

/**
 * Cascade delete a course's dependent collections. We use `deleteMany`
 * (rather than per-document `deleteOne`) for two reasons:
 *  1. Performance — one round-trip per collection instead of N.
 *  2. We deliberately want to skip the per-document cascade hooks on
 *     `Lesson`, `Quiz`, and `Enrollment` that update `Course` counters.
 *     The parent course is being removed in the same operation, so those
 *     counter updates would be wasted writes against a doomed document.
 *
 * If the deployment runs on a replica set we do this inside a transaction
 * so a partial failure rolls back; on standalone Mongo (typical local /
 * dev setups) we fall back to sequential parallel deletes which are
 * idempotent on retry — re-running the delete simply finds nothing left.
 */
const cascadeDeleteCourse = async (courseId) => {
  const cleanupOps = (session) => {
    const sessionOpt = session ? { session } : undefined;
    return Promise.all([
      Section.deleteMany({ courseId }, sessionOpt),
      Lesson.deleteMany({ courseId }, sessionOpt),
      Quiz.deleteMany({ courseId }, sessionOpt),
      QuizAttempt.deleteMany({ courseId }, sessionOpt),
      Enrollment.deleteMany({ courseId }, sessionOpt),
      Course.deleteOne({ _id: courseId }, sessionOpt),
    ]);
  };

  let session;
  try {
    session = await mongoose.startSession();
    await session.withTransaction(() => cleanupOps(session));
  } catch (err) {
    // Standalone Mongo (no replica set) rejects transactions outright.
    // Retry without a session — the operations are independent and the
    // child collections only reference the (now-deleted) course by id.
    if (err?.code === 20 || /Transaction numbers/i.test(err?.message ?? '')) {
      await cleanupOps(null);
    } else {
      throw err;
    }
  } finally {
    await session?.endSession();
  }
};

/**
 * Translate `?status=` / `?page=` / `?limit=` / `?sort=` query params into
 * a safe Mongo filter + pagination tuple. Unknown sort values fall back to
 * `newest` so we never embed user-controlled operators into a query.
 */
const buildMyCoursesQuery = (query) => {
  const filter = {};
  if (typeof query.status === 'string' && query.status.length > 0) {
    filter.status = query.status;
  }

  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const requestedLimit = parseInt(query.limit, 10) || PAGINATION_DEFAULT_LIMIT;
  const limit = Math.min(PAGINATION_MAX_LIMIT, Math.max(1, requestedLimit));

  const sortMap = {
    newest: { createdAt: -1 },
    oldest: { createdAt: 1 },
    title: { title: 1 },
    price: { price: 1 },
  };
  const sort = sortMap[query.sort] ?? sortMap.newest;

  return { filter, page, limit, skip: (page - 1) * limit, sort };
};

/**
 * POST /api/courses
 * Creates a new course owned by the authenticated instructor.
 */
export const createCourse = asyncHandler(async (req, res) => {
  const data = pickFields(req.body, CREATE_FIELDS);

  // `instructor` and `status` are the two server-controlled fields that
  // make this endpoint safe — the whitelist above filters everything
  // else, and these two are appended explicitly so the client cannot
  // forge them via a body parameter.
  const course = await Course.create({
    ...data,
    instructor: req.user._id,
    status: 'draft',
  });

  res.status(201).json({ success: true, course });
});

/**
 * GET /api/courses/mine
 * Lists courses owned by the authenticated instructor. Supports optional
 * `?status=`, `?sort=`, `?page=`, `?limit=` filters; admins use this same
 * endpoint for their own authored content (admin-wide moderation lives in
 * a separate admin route group).
 */
export const getMyCourses = asyncHandler(async (req, res) => {
  const { filter, page, limit, skip, sort } = buildMyCoursesQuery(req.query);
  const ownedFilter = { ...filter, instructor: req.user._id };

  const [items, total] = await Promise.all([
    Course.find(ownedFilter).sort(sort).skip(skip).limit(limit),
    Course.countDocuments(ownedFilter),
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
 * PATCH /api/courses/:id
 * Updates a course owned by the requester. Field whitelist tightens once
 * the course is `published` (see `EDIT_FIELDS_PUBLISHED`).
 */
export const updateCourse = asyncHandler(async (req, res) => {
  const course = await findOwnedCourseOr404(req.params.id, req.user);

  const allowed = course.status === 'published' ? EDIT_FIELDS_PUBLISHED : EDIT_FIELDS_DRAFT;
  const updates = pickFields(req.body, allowed);

  if (Object.keys(updates).length === 0) {
    if (course.status === 'published') {
      throw ApiError.badRequest(
        `No editable fields provided. Published courses can only update: ${EDIT_FIELDS_PUBLISHED.join(', ')}.`,
      );
    }
    throw ApiError.badRequest('No updatable fields provided.');
  }

  Object.assign(course, updates);
  // .save() (instead of findByIdAndUpdate) so the pre-save hook can
  // regenerate the slug from the new title and stamp `publishedAt` if a
  // future status flip touches it.
  await course.save();

  res.json({ success: true, course });
});

/**
 * DELETE /api/courses/:id
 * Cascades through every dependent collection. Non-admin owners are
 * blocked when active enrollments exist — they should `archiveCourse`
 * instead so paying students retain access.
 */
export const deleteCourse = asyncHandler(async (req, res) => {
  const course = await findOwnedCourseOr404(req.params.id, req.user);

  if (!isAdmin(req.user)) {
    const activeEnrollments = await Enrollment.countDocuments({ courseId: course._id });
    if (activeEnrollments > 0) {
      throw ApiError.conflict(
        'Cannot delete course with active enrollments — archive instead.',
      );
    }
  }

  await cascadeDeleteCourse(course._id);

  res.json({ success: true, message: 'Course deleted successfully.' });
});

/**
 * POST /api/courses/:id/submit
 * Promotes a `draft` course to `pending` review. Admins approve/reject
 * via a separate admin endpoint added in a later step.
 */
export const submitForReview = asyncHandler(async (req, res) => {
  const course = await findOwnedCourseOr404(req.params.id, req.user);

  if (course.status !== 'draft') {
    throw ApiError.badRequest(
      `Only draft courses can be submitted for review (current status: "${course.status}").`,
    );
  }

  course.status = 'pending';
  course.rejectionReason = '';
  await course.save();

  res.json({ success: true, course });
});

/**
 * POST /api/courses/:id/archive
 * Pulls a `published` course off the catalog. Existing enrollments and
 * progress are preserved — archive is a "stop selling" action, not a
 * destructive one.
 */
export const archiveCourse = asyncHandler(async (req, res) => {
  const course = await findOwnedCourseOr404(req.params.id, req.user);

  if (course.status !== 'published') {
    throw ApiError.badRequest(
      `Only published courses can be archived (current status: "${course.status}").`,
    );
  }

  course.status = 'archived';
  await course.save();

  res.json({ success: true, course });
});

export default {
  createCourse,
  getMyCourses,
  updateCourse,
  deleteCourse,
  submitForReview,
  archiveCourse,
};
