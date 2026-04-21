/**
 * Course controller — instructor-facing CRUD + lifecycle endpoints **and**
 * the public catalog / detail / curriculum / instructor-profile readers.
 *
 * Even though both surfaces live in this file, they are wired into the
 * router with completely different middleware stacks (the public readers
 * use `optionalAuth`, the authoring endpoints use `protect` +
 * `instructorOrAdmin`). Keeping them in one file lets us share helpers
 * like `isOwner` / `isAdmin` / the cascade-delete utility without
 * duplicating ownership semantics — but the route layer is what
 * ultimately decides whether a given handler can be reached anonymously.
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

import { signedVideoUrl } from '../config/cloudinary.js';
import {
  Course,
  COURSE_CATEGORIES,
  COURSE_LEVELS,
} from '../models/Course.model.js';
import { Enrollment } from '../models/Enrollment.model.js';
import { Lesson } from '../models/Lesson.model.js';
import { Quiz } from '../models/Quiz.model.js';
import { QuizAttempt } from '../models/QuizAttempt.model.js';
import { Section } from '../models/Section.model.js';
import { User } from '../models/User.model.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { escapeRegex } from '../utils/escapeRegex.js';
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

// ---------------------------------------------------------------------------
// Public catalog / detail / curriculum / instructor-profile handlers.
//
// These are mounted with `optionalAuth` (NOT `protect`) so anonymous
// visitors can browse the marketing surface. `req.user` may therefore be
// `null` — every helper below treats that case as "not the owner, not an
// admin, not enrolled" and degrades gracefully.
// ---------------------------------------------------------------------------

const CATALOG_DEFAULT_LIMIT = 12;
const CATALOG_MAX_LIMIT = 50;
const PRICE_MIN = 0;
const PRICE_MAX = 9999;
const SEARCH_MAX_LENGTH = 100;

// Whitelisted sort orders. Any other value (including `$where`-shaped
// payloads or unknown keys) silently falls back to `newest` so a
// crafted query string can never inject a Mongo operator into `.sort()`.
const CATALOG_SORT_MAP = Object.freeze({
  newest: { publishedAt: -1, createdAt: -1 },
  popular: { enrollmentCount: -1, publishedAt: -1 },
  'price-asc': { price: 1, publishedAt: -1 },
  'price-desc': { price: -1, publishedAt: -1 },
});

// Lean projection used for catalog cards. Trimming the wire payload
// keeps the marketing list page snappy even when filters return dozens
// of results, and it deliberately excludes `requirements`,
// `learningOutcomes`, and `rejectionReason` which only matter on the
// detail page (and the latter must never leak publicly anyway).
const CATALOG_CARD_FIELDS = [
  'title',
  'slug',
  'shortDescription',
  'price',
  'thumbnail',
  'category',
  'level',
  'language',
  'tags',
  'totalLessons',
  'totalDuration',
  'enrollmentCount',
  'averageRating',
  'publishedAt',
  'createdAt',
  'instructor',
].join(' ');

const clampPage = (raw) => Math.max(1, parseInt(raw, 10) || 1);

const clampLimit = (raw) => {
  const requested = parseInt(raw, 10) || CATALOG_DEFAULT_LIMIT;
  return Math.min(CATALOG_MAX_LIMIT, Math.max(1, requested));
};

/**
 * STEP 48 — HTTP cache hint for public catalog reads.
 *
 * Anonymous viewers get `public, max-age=60, stale-while-revalidate=300`
 * so a CDN / browser cache can serve repeat hits instantly while still
 * revalidating in the background within five minutes. Authenticated
 * viewers (owners previewing their drafts, admins with elevated
 * visibility) get `private, no-store` because their response shape
 * depends on `req.user` and MUST NOT be served from a shared cache.
 *
 * Mounted by every public reader that runs under `optionalAuth`. Caller
 * also sends `Vary: Authorization` so an upstream cache that DOES key
 * by header doesn't leak an authenticated payload to anonymous viewers
 * on the same URL.
 */
const setPublicCatalogCache = (res, user) => {
  if (user) {
    res.set('Cache-Control', 'private, no-store');
    return;
  }
  res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
  res.set('Vary', 'Authorization');
};

const parsePrice = (raw) => {
  const value = Number.parseFloat(raw);
  return Number.isFinite(value) ? value : null;
};

const parseDuration = (raw) => {
  const value = Number.parseInt(raw, 10);
  return Number.isFinite(value) && value >= 0 ? value : null;
};

/**
 * Parse a comma-separated query value (`?level=beginner,advanced`) into a
 * deduplicated array filtered by a frozen allow-list. Returns `null` when
 * no recognised value is supplied so the caller can skip the filter
 * altogether instead of injecting an empty `$in: []` (which would match
 * nothing and silently break the page).
 */
const parseEnumList = (raw, allowed) => {
  if (typeof raw !== 'string' || raw.length === 0) return null;
  const values = Array.from(
    new Set(
      raw
        .split(',')
        .map((piece) => piece.trim())
        .filter((piece) => allowed.includes(piece)),
    ),
  );
  return values.length > 0 ? values : null;
};

/**
 * Translate `?search=` / `?category=` / `?level=` / `?minPrice=` /
 * `?maxPrice=` / `?minDuration=` / `?maxDuration=` / `?sort=` / `?page=` /
 * `?limit=` into a safe Mongo filter + pagination tuple for the public
 * catalog. Every user-supplied value is either:
 *   - clamped to a numeric range,
 *   - matched against a frozen enum (categories, levels, sort keys), or
 *   - escaped via `escapeRegex` before being embedded in a `RegExp`.
 *
 * Categories and levels accept either a single value or a comma-separated
 * list (`?level=beginner,intermediate`) so the catalog filter sidebar can
 * express multi-select pills without smuggling Mongo operators through.
 *
 * Nothing in this function can produce a Mongo operator key from
 * untrusted input — that is the entire point.
 */
const buildCatalogQuery = (query) => {
  const filter = { status: 'published' };

  if (typeof query.search === 'string' && query.search.trim().length > 0) {
    const safe = escapeRegex(query.search.trim().slice(0, SEARCH_MAX_LENGTH));
    if (safe.length > 0) {
      const re = new RegExp(safe, 'i');
      filter.$or = [{ title: re }, { description: re }, { tags: re }];
    }
  }

  const categories = parseEnumList(query.category, COURSE_CATEGORIES);
  if (categories) {
    filter.category = categories.length === 1 ? categories[0] : { $in: categories };
  }

  const levels = parseEnumList(query.level, COURSE_LEVELS);
  if (levels) {
    filter.level = levels.length === 1 ? levels[0] : { $in: levels };
  }

  const minPrice = parsePrice(query.minPrice);
  const maxPrice = parsePrice(query.maxPrice);
  if (minPrice !== null || maxPrice !== null) {
    filter.price = {};
    if (minPrice !== null) filter.price.$gte = Math.max(PRICE_MIN, minPrice);
    if (maxPrice !== null) filter.price.$lte = Math.min(PRICE_MAX, maxPrice);
  }

  const minDuration = parseDuration(query.minDuration);
  const maxDuration = parseDuration(query.maxDuration);
  if (minDuration !== null || maxDuration !== null) {
    filter.totalDuration = {};
    if (minDuration !== null) filter.totalDuration.$gte = minDuration;
    if (maxDuration !== null) filter.totalDuration.$lte = maxDuration;
  }

  if (query.priceMode === 'free') {
    filter.price = { $eq: 0 };
  } else if (query.priceMode === 'paid') {
    filter.price = { ...(filter.price ?? {}), $gt: 0 };
  }

  const sort = CATALOG_SORT_MAP[query.sort] ?? CATALOG_SORT_MAP.newest;
  const page = clampPage(query.page);
  const limit = clampLimit(query.limit);

  return { filter, sort, page, limit, skip: (page - 1) * limit };
};

/**
 * Resolve a course by slug and assert the requester is allowed to read
 * it. Anonymous visitors only see `published` courses; the owning
 * instructor and admins can preview drafts / pending / rejected /
 * archived courses through the same URL so the authoring UI doesn't
 * need a parallel endpoint.
 *
 * Always returns 404 (never 403) for unauthorized status — leaking the
 * 403/404 distinction would let an attacker enumerate which slugs
 * correspond to non-published courses.
 */
const findVisibleCourseBySlugOr404 = async (slug, user, { populateInstructor = true } = {}) => {
  let query = Course.findOne({ slug });
  if (populateInstructor) {
    query = query.populate('instructor', 'name avatar headline bio');
  }
  const course = await query;

  if (!course) throw ApiError.notFound('Course not found.');

  if (course.status !== 'published' && !isOwner(course, user) && !isAdmin(user)) {
    throw ApiError.notFound('Course not found.');
  }

  return course;
};

/**
 * GET /api/courses
 * Public catalog. Always filters `status: 'published'` server-side; the
 * client cannot widen visibility by sending `?status=draft` because
 * that key is never read here.
 */
export const listPublishedCourses = asyncHandler(async (req, res) => {
  const { filter, sort, page, limit, skip } = buildCatalogQuery(req.query);

  const [items, total] = await Promise.all([
    Course.find(filter)
      .select(CATALOG_CARD_FIELDS)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .populate('instructor', 'name avatar headline')
      .lean(),
    Course.countDocuments(filter),
  ]);

  setPublicCatalogCache(res, req.user);

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
 * GET /api/courses/:slug
 * Public detail page. Returns the full marketing payload (description,
 * requirements, learning outcomes, denormalized counters, instructor
 * card) for `published` courses; owners/admins additionally get
 * preview access to non-published states for the authoring UI.
 */
export const getCourseBySlug = asyncHandler(async (req, res) => {
  const course = await findVisibleCourseBySlugOr404(req.params.slug, req.user);
  setPublicCatalogCache(res, req.user);
  res.json({ success: true, course });
});

/**
 * GET /api/courses/:slug/curriculum
 *
 * Returns the section/lesson tree with content gated per-lesson:
 *   - `videoUrl` / `content` are included ONLY when the requester is the
 *     course owner, an admin, currently enrolled, OR the lesson is
 *     flagged `isFreePreview`.
 *   - All other viewers receive a thin shape (`title`, `type`,
 *     `duration`, `isFreePreview`, `hasQuiz`) suitable for rendering a
 *     locked / "Enroll to unlock" affordance on the marketing page.
 *
 * `videoPublicId` is intentionally never exposed on this surface — it
 * is an authoring-only handle used to manage Cloudinary assets.
 */
export const getCourseCurriculum = asyncHandler(async (req, res) => {
  const course = await findVisibleCourseBySlugOr404(req.params.slug, req.user, {
    populateInstructor: false,
  });

  const [sections, lessons] = await Promise.all([
    Section.find({ courseId: course._id }).sort({ order: 1 }).lean(),
    // `videoPublicId` is needed to mint signed Cloudinary URLs (STEP 47) but
    // is intentionally STRIPPED from the projected payload — clients must
    // never see the raw publicId, only the short-lived signed URL we mint.
    Lesson.find({ courseId: course._id }).sort({ order: 1 }).lean(),
  ]);

  const viewerIsOwner = isOwner(course, req.user);
  const viewerIsAdmin = isAdmin(req.user);

  // Only run the enrollment lookup when it could change the outcome —
  // owners and admins already see everything, anonymous visitors can
  // never be enrolled. `Enrollment.exists` returns the lean doc id
  // (or null), avoiding the cost of hydrating a full document.
  let viewerIsEnrolled = false;
  if (req.user && !viewerIsOwner && !viewerIsAdmin) {
    const enrollment = await Enrollment.exists({
      userId: req.user._id,
      courseId: course._id,
    });
    viewerIsEnrolled = Boolean(enrollment);
  }

  const projectLesson = (lesson) => {
    const base = {
      _id: lesson._id,
      title: lesson.title,
      type: lesson.type,
      duration: lesson.duration,
      isFreePreview: lesson.isFreePreview,
      hasQuiz: lesson.hasQuiz,
      order: lesson.order,
      sectionId: lesson.sectionId,
    };
    const canSeeContent =
      viewerIsOwner || viewerIsAdmin || viewerIsEnrolled || lesson.isFreePreview === true;
    if (!canSeeContent) return base;

    // STEP 47 — Cloudinary lesson videos are stored with `type: 'authenticated'`,
    // so the persisted `videoUrl` is unplayable on its own. Re-sign it per
    // request with a short TTL. Provider videos (YouTube/Vimeo) keep their
    // original URL because the provider owns access control there.
    const isCloudinary = lesson.videoProvider === 'cloudinary' && lesson.videoPublicId;
    const videoUrl = isCloudinary ? signedVideoUrl(lesson.videoPublicId) : lesson.videoUrl;

    return {
      ...base,
      videoUrl,
      videoProvider: lesson.videoProvider,
      content: lesson.content,
    };
  };

  const lessonsBySection = new Map();
  for (const lesson of lessons) {
    const key = String(lesson.sectionId);
    if (!lessonsBySection.has(key)) lessonsBySection.set(key, []);
    lessonsBySection.get(key).push(projectLesson(lesson));
  }

  const data = sections.map((section) => ({
    _id: section._id,
    title: section.title,
    order: section.order,
    lessons: lessonsBySection.get(String(section._id)) ?? [],
  }));

  // Curriculum payload includes signed Cloudinary URLs (gated by enrollment
  // / ownership) — those URLs MUST NOT land in a shared cache, so the
  // hint is `private, no-store` whenever a real user is attached. Anonymous
  // viewers only see the locked / free-preview shape, which is safe to
  // cache briefly behind a CDN.
  setPublicCatalogCache(res, req.user);

  res.json({
    success: true,
    data: {
      sections: data,
      isEnrolled: viewerIsEnrolled,
    },
  });
});

/**
 * GET /api/instructors/:id/courses
 * Public instructor profile feed — returns the (paginated) `published`
 * courses authored by the user, plus a thin instructor card so the
 * client can render the profile header without a second round-trip.
 *
 * Hard-filters by `role: instructor|admin` and `isActive: true` so a
 * deactivated account or a misclassified student id can never surface
 * a profile page — both return 404 consistent with the rest of the
 * public surface.
 */
export const getInstructorPublicCourses = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const page = clampPage(req.query.page);
  const limit = clampLimit(req.query.limit);
  const skip = (page - 1) * limit;

  const instructor = await User.findOne({
    _id: id,
    role: { $in: ['instructor', 'admin'] },
    isActive: true,
  })
    .select('name avatar headline bio')
    .lean();

  if (!instructor) throw ApiError.notFound('Instructor not found.');

  const filter = { instructor: id, status: 'published' };
  const [items, total] = await Promise.all([
    Course.find(filter)
      .select(CATALOG_CARD_FIELDS)
      .sort({ publishedAt: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Course.countDocuments(filter),
  ]);

  setPublicCatalogCache(res, req.user);

  res.json({
    success: true,
    data: {
      instructor,
      items,
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  });
});

export default {
  createCourse,
  getMyCourses,
  updateCourse,
  deleteCourse,
  submitForReview,
  archiveCourse,
  listPublishedCourses,
  getCourseBySlug,
  getCourseCurriculum,
  getInstructorPublicCourses,
};
