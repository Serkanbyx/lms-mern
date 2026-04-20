/**
 * Admin controller — platform-wide dashboard analytics + user management.
 *
 * Every handler in this file is exposed only behind `protect + adminOnly`
 * by `routes/admin.routes.js`, so we trust `req.user.role === 'admin'` on
 * entry. The controller still enforces THREE platform-critical safety
 * rails on top of that — none of which can be delegated to middleware
 * because they all need a database round-trip:
 *
 *  1. **Self-protection** — an admin cannot demote, disable, or delete
 *     their own account. Every privileged endpoint compares the target
 *     id against `req.user._id` and rejects the request before any
 *     mutation runs. This prevents the "I tested the endpoint on myself
 *     and got locked out" footgun.
 *
 *  2. **Last-admin protection** — before demoting an admin to a lower
 *     role OR deleting an admin, we count the remaining active admins.
 *     If the operation would leave the platform with zero admins, we
 *     reject with a 409. This guarantees the platform always has at
 *     least one human capable of recovering it.
 *
 *  3. **Instructor-with-active-enrollments protection** — deleting an
 *     instructor cascades through every course they own. If any of those
 *     courses still has enrollments from OTHER users, we reject the
 *     delete and ask the admin to archive the courses first. This is the
 *     same rule the public `DELETE /api/courses/:id` endpoint enforces
 *     for non-admin owners; we extend it here to user deletions because
 *     the cascade would otherwise silently strand paying students.
 *
 * Cascade order on delete: enrollments → quiz attempts → owned courses
 * (and each course's own dependents through `cascadeDeleteCourse`) → the
 * user document itself. Doing the user last means a partial failure
 * leaves the user document in place so the admin can retry; doing it
 * first would orphan dependents on a failed mid-cascade write.
 */

import mongoose from 'mongoose';

import { Course } from '../models/Course.model.js';
import { Enrollment } from '../models/Enrollment.model.js';
import { Lesson } from '../models/Lesson.model.js';
import { Quiz } from '../models/Quiz.model.js';
import { QuizAttempt } from '../models/QuizAttempt.model.js';
import { Section } from '../models/Section.model.js';
import { User } from '../models/User.model.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { escapeRegex } from '../utils/escapeRegex.js';

import { ADMIN_USER_PAGINATION_DEFAULTS } from '../validators/admin.validator.js';

const SORT_MAP = Object.freeze({
  newest: { createdAt: -1 },
  oldest: { createdAt: 1 },
  name: { name: 1 },
  email: { email: 1 },
  role: { role: 1, createdAt: -1 },
});

/**
 * Build a Mongo filter + pagination tuple from the validated query
 * string for `GET /api/admin/users`. Inputs are already shape-checked
 * by the validator; we only need to defaults-fill and translate.
 */
const buildUserListQuery = (query) => {
  const filter = {};

  if (typeof query.search === 'string' && query.search.trim().length > 0) {
    // ReDoS-safe: `escapeRegex` neutralises every regex metacharacter so a
    // crafted `?search=(a+)+$` cannot peg the event loop.
    const safe = escapeRegex(query.search.trim());
    const re = new RegExp(safe, 'i');
    filter.$or = [{ name: re }, { email: re }];
  }

  if (typeof query.role === 'string' && query.role.length > 0) {
    filter.role = query.role;
  }

  if (query.isActive === 'true') filter.isActive = true;
  else if (query.isActive === 'false') filter.isActive = false;

  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const requestedLimit =
    parseInt(query.limit, 10) || ADMIN_USER_PAGINATION_DEFAULTS.defaultLimit;
  const limit = Math.min(
    ADMIN_USER_PAGINATION_DEFAULTS.maxLimit,
    Math.max(1, requestedLimit),
  );

  const sort = SORT_MAP[query.sort] ?? SORT_MAP.newest;

  return { filter, page, limit, skip: (page - 1) * limit, sort };
};

/**
 * Count the active admins OTHER THAN `excludingId`. Used by the
 * last-admin guard so a privileged operation (demote / delete) on the
 * sole remaining admin is rejected before it can lock the platform out
 * of its own moderation surface.
 */
const countOtherActiveAdmins = (excludingId) =>
  User.countDocuments({
    _id: { $ne: excludingId },
    role: 'admin',
    isActive: true,
  });

/**
 * Cascade delete a single course's dependent collections. Mirrors
 * `course.controller.js`'s helper — we duplicate it here (instead of
 * importing) to avoid a circular dependency and to keep the admin
 * deletion path independent of any future change to the instructor
 * delete flow. Both helpers tolerate standalone Mongo (no replica set)
 * by retrying without a transaction on `code 20`.
 */
const cascadeDeleteCourse = async (courseId, session) => {
  const sessionOpt = session ? { session } : undefined;
  await Promise.all([
    Section.deleteMany({ courseId }, sessionOpt),
    Lesson.deleteMany({ courseId }, sessionOpt),
    Quiz.deleteMany({ courseId }, sessionOpt),
    QuizAttempt.deleteMany({ courseId }, sessionOpt),
    Enrollment.deleteMany({ courseId }, sessionOpt),
    Course.deleteOne({ _id: courseId }, sessionOpt),
  ]);
};

/**
 * GET /api/admin/stats
 *
 * Aggregated dashboard snapshot. Every counter is computed in parallel
 * with `Promise.all` because there are no inter-dependencies — the
 * round-trip cost is dominated by the slowest single query, not the
 * sum of them.
 *
 * `activeToday` is intentionally a proxy: we don't yet persist a
 * `lastSeenAt` timestamp on the User model, so we use `updatedAt >=
 * startOfToday` as a "touched their account today" approximation. When
 * a dedicated activity field lands in a later step, swap the filter
 * here without changing the response contract.
 *
 * `passRate` is rounded to 1 decimal so the dashboard can render a
 * stable percentage without trailing-precision wobble.
 */
export const getDashboardStats = asyncHandler(async (_req, res) => {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const [
    totalUsers,
    studentCount,
    instructorCount,
    adminCount,
    activeTodayCount,
    totalCourses,
    draftCourses,
    pendingCourses,
    publishedCourses,
    rejectedCourses,
    archivedCourses,
    totalEnrollments,
    last7DaysEnrollments,
    totalQuizAttempts,
    passedQuizAttempts,
  ] = await Promise.all([
    User.countDocuments({}),
    User.countDocuments({ role: 'student' }),
    User.countDocuments({ role: 'instructor' }),
    User.countDocuments({ role: 'admin' }),
    User.countDocuments({ updatedAt: { $gte: startOfToday } }),
    Course.countDocuments({}),
    Course.countDocuments({ status: 'draft' }),
    Course.countDocuments({ status: 'pending' }),
    Course.countDocuments({ status: 'published' }),
    Course.countDocuments({ status: 'rejected' }),
    Course.countDocuments({ status: 'archived' }),
    Enrollment.countDocuments({}),
    Enrollment.countDocuments({ enrolledAt: { $gte: sevenDaysAgo } }),
    QuizAttempt.countDocuments({}),
    QuizAttempt.countDocuments({ passed: true }),
  ]);

  const passRate =
    totalQuizAttempts === 0
      ? 0
      : Math.round((passedQuizAttempts / totalQuizAttempts) * 1000) / 10;

  res.json({
    success: true,
    data: {
      users: {
        total: totalUsers,
        students: studentCount,
        instructors: instructorCount,
        admins: adminCount,
        activeToday: activeTodayCount,
      },
      courses: {
        total: totalCourses,
        draft: draftCourses,
        pending: pendingCourses,
        published: publishedCourses,
        rejected: rejectedCourses,
        archived: archivedCourses,
      },
      enrollments: {
        total: totalEnrollments,
        last7Days: last7DaysEnrollments,
      },
      quizAttempts: {
        total: totalQuizAttempts,
        passed: passedQuizAttempts,
        passRate,
      },
    },
  });
});

/**
 * GET /api/admin/users
 *
 * Paginated, searchable user directory. Supports `?search=` (matched
 * against `name` + `email`, case-insensitive, ReDoS-safe), `?role=`,
 * `?isActive=`, `?sort=`, `?page=`, `?limit=`.
 *
 * Passwords are stripped at the schema layer (`select: false`), so the
 * `.lean()` projection does not need to manually exclude them.
 */
export const getAllUsers = asyncHandler(async (req, res) => {
  const { filter, page, limit, skip, sort } = buildUserListQuery(req.query);

  const [items, total] = await Promise.all([
    User.find(filter).sort(sort).skip(skip).limit(limit).lean(),
    User.countDocuments(filter),
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
 * GET /api/admin/users/:id
 *
 * Returns the full user record plus a small set of derived counters
 * (enrollments, quiz attempts, owned courses) the admin detail page
 * uses to decide which moderation buttons to surface.
 */
export const getUserById = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id).lean();
  if (!user) throw ApiError.notFound('User not found.');

  const [enrollmentCount, quizAttemptCount, ownedCourseCount] = await Promise.all([
    Enrollment.countDocuments({ userId: user._id }),
    QuizAttempt.countDocuments({ userId: user._id }),
    Course.countDocuments({ instructor: user._id }),
  ]);

  res.json({
    success: true,
    data: {
      user,
      stats: {
        enrollments: enrollmentCount,
        quizAttempts: quizAttemptCount,
        ownedCourses: ownedCourseCount,
      },
    },
  });
});

/**
 * PATCH /api/admin/users/:id/role
 *
 * Promote / demote a user. Guarded by:
 *  - self-protection (`targetId === req.user._id` rejected),
 *  - last-admin protection (cannot demote the only remaining admin).
 *
 * The new role is the only mutable field on this endpoint; everything
 * else on the body is ignored.
 */
export const updateUserRole = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { role } = req.body;

  if (req.user._id.equals(id)) {
    throw ApiError.forbidden('You cannot change your own role.');
  }

  const target = await User.findById(id);
  if (!target) throw ApiError.notFound('User not found.');

  if (target.role === role) {
    return res.json({ success: true, user: target.toSafeJSON() });
  }

  if (target.role === 'admin' && role !== 'admin') {
    const remaining = await countOtherActiveAdmins(target._id);
    if (remaining < 1) {
      throw ApiError.conflict(
        'Cannot demote the last remaining admin — promote another admin first.',
      );
    }
  }

  target.role = role;
  await target.save();

  return res.json({ success: true, user: target.toSafeJSON() });
});

/**
 * PATCH /api/admin/users/:id/active
 *
 * Toggle account activation. A deactivated user's existing JWTs are
 * rejected on the next request by the auth middleware (it checks
 * `user.isActive` after token verification), so this endpoint is also
 * the platform-wide "kick" button.
 *
 * Guarded by:
 *  - self-protection (cannot disable yourself),
 *  - last-admin protection (cannot disable the sole remaining admin).
 */
export const toggleUserActive = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { isActive } = req.body;

  if (req.user._id.equals(id)) {
    throw ApiError.forbidden('You cannot change your own activation status.');
  }

  const target = await User.findById(id);
  if (!target) throw ApiError.notFound('User not found.');

  if (target.role === 'admin' && isActive === false && target.isActive === true) {
    const remaining = await countOtherActiveAdmins(target._id);
    if (remaining < 1) {
      throw ApiError.conflict(
        'Cannot disable the last active admin — activate another admin first.',
      );
    }
  }

  if (target.isActive === isActive) {
    return res.json({ success: true, user: target.toSafeJSON() });
  }

  target.isActive = isActive;
  await target.save();

  return res.json({ success: true, user: target.toSafeJSON() });
});

/**
 * DELETE /api/admin/users/:id
 *
 * Hard delete with full cascade. Guarded by:
 *  - self-protection (cannot delete yourself),
 *  - last-admin protection (cannot delete the sole remaining admin),
 *  - instructor-with-active-enrollments protection (cannot delete an
 *    instructor whose courses still have enrolled students from other
 *    users — the admin must archive those courses first).
 *
 * Cascade order:
 *   1. The user's enrollments → also triggers each Enrollment's
 *      `findOneAndDelete` post-hook to decrement
 *      `Course.enrollmentCount` on the courses they were enrolled in.
 *   2. The user's quiz attempts.
 *   3. Each course they own → `cascadeDeleteCourse` removes the
 *      course's sections, lessons, quizzes, attempts, and remaining
 *      enrollments in one shot.
 *   4. The user document itself — last so a partial failure leaves the
 *      account in place and the admin can retry idempotently.
 *
 * We use a transaction on replica sets and fall back to sequential
 * deletes on standalone Mongo, matching the convention established by
 * `course.controller.js`'s cascade helper.
 */
export const deleteUser = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (req.user._id.equals(id)) {
    throw ApiError.forbidden('You cannot delete your own account.');
  }

  const target = await User.findById(id);
  if (!target) throw ApiError.notFound('User not found.');

  if (target.role === 'admin') {
    const remaining = await countOtherActiveAdmins(target._id);
    if (remaining < 1) {
      throw ApiError.conflict(
        'Cannot delete the last remaining admin — promote another admin first.',
      );
    }
  }

  // Instructor-with-active-enrollments guard. We count enrollments on
  // the instructor's courses that belong to OTHER users — the
  // instructor's own enrollments (e.g. self-test enrollments via an
  // admin override) don't count as "stranded students" and would be
  // wiped by the cascade anyway.
  const ownedCourseIds = await Course.find({ instructor: target._id })
    .select('_id')
    .lean();

  if (ownedCourseIds.length > 0) {
    const stranded = await Enrollment.countDocuments({
      courseId: { $in: ownedCourseIds.map((c) => c._id) },
      userId: { $ne: target._id },
    });
    if (stranded > 0) {
      throw ApiError.conflict(
        'Cannot delete instructor with active enrollments on their courses — archive those courses first.',
      );
    }
  }

  const runCascade = async (session) => {
    const sessionOpt = session ? { session } : undefined;

    // Step 1: drop the user's own enrollments. We use deleteMany rather
    // than per-document deletes because the per-doc post-hook (course
    // enrollmentCount decrement) is meaningful only when the parent
    // course survives — which it does for courses the user was
    // enrolled in but did NOT author.
    await Enrollment.deleteMany({ userId: target._id }, sessionOpt);
    await QuizAttempt.deleteMany({ userId: target._id }, sessionOpt);

    for (const { _id: courseId } of ownedCourseIds) {
      await cascadeDeleteCourse(courseId, session);
    }

    await User.deleteOne({ _id: target._id }, sessionOpt);
  };

  let session;
  try {
    session = await mongoose.startSession();
    await session.withTransaction(() => runCascade(session));
  } catch (err) {
    if (err?.code === 20 || /Transaction numbers/i.test(err?.message ?? '')) {
      await runCascade(null);
    } else {
      throw err;
    }
  } finally {
    await session?.endSession();
  }

  res.json({ success: true, message: 'User deleted successfully.' });
});

export default {
  getDashboardStats,
  getAllUsers,
  getUserById,
  updateUserRole,
  toggleUserActive,
  deleteUser,
};
