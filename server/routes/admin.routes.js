/**
 * `/api/admin` route group — platform-wide moderation surface.
 *
 * Every endpoint here is gated by THREE layers, in order:
 *   1. `protect`       — JWT must verify, account must be active.
 *   2. `adminOnly`     — `req.user.role === 'admin'`.
 *   3. `adminLimiter`  — 100 requests / 10 minutes per admin user
 *                        (keyed by `req.user._id`, so it MUST run
 *                        after `protect` to have a key to use).
 *
 * Per-route validation runs after the gate so malformed payloads from
 * authenticated admins are still rejected with a structured 422 before
 * the controller runs. Self-protection / last-admin / cascade rules
 * live in the controller because they all need a database round-trip.
 *
 * User endpoints:
 *   GET    /stats              dashboard aggregate counters
 *   GET    /users              paginated, searchable user directory
 *   GET    /users/:id          full user record + derived counters
 *   PATCH  /users/:id/role     promote / demote a user
 *   PATCH  /users/:id/active   enable / disable a user (logout-on-next-req)
 *   DELETE /users/:id          hard delete with full cascade
 *
 * Course moderation endpoints:
 *   GET    /courses            paginated course directory (any status)
 *   GET    /courses/pending    moderation queue (status=pending shortcut)
 *   POST   /courses/:id/approve  promote pending → published
 *   POST   /courses/:id/reject   pending → rejected with mandatory reason
 *   POST   /courses/:id/archive  force-archive any status
 *   DELETE /courses/:id          force-delete with cascade ({ confirm: true })
 *
 * Route ordering note: `/courses/pending` is a static path that would
 * otherwise be swallowed by the `:id` matcher on `POST /courses/:id/...`,
 * so it MUST be declared before any `/courses/:id*` route.
 */

import { Router } from 'express';

import {
  approveCourse,
  deleteUser,
  forceArchiveCourse,
  forceDeleteCourse,
  getAllCoursesAdmin,
  getAllUsers,
  getDashboardStats,
  getPendingCourses,
  getUserById,
  rejectCourse,
  toggleUserActive,
  updateUserRole,
} from '../controllers/admin.controller.js';
import { protect } from '../middleware/auth.middleware.js';
import { adminLimiter } from '../middleware/rateLimit.middleware.js';
import { adminOnly } from '../middleware/role.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import {
  courseIdParamValidator as adminCourseIdParamValidator,
  forceDeleteCourseValidator,
  listCoursesAdminValidator,
  listUsersValidator,
  rejectCourseValidator,
  toggleUserActiveValidator,
  updateUserRoleValidator,
  userIdParamValidator,
} from '../validators/admin.validator.js';

const router = Router();

// Order matters: `protect` populates `req.user`, `adminOnly` checks the
// role, and `adminLimiter` keys its bucket off `req.user._id`. Without
// this exact order the limiter would key by IP and the role guard
// would crash on an undefined `req.user`.
router.use(protect, adminOnly, adminLimiter);

router.get('/stats', getDashboardStats);

router.get('/users', validate(listUsersValidator), getAllUsers);
router.get('/users/:id', validate(userIdParamValidator), getUserById);
router.patch('/users/:id/role', validate(updateUserRoleValidator), updateUserRole);
router.patch('/users/:id/active', validate(toggleUserActiveValidator), toggleUserActive);
router.delete('/users/:id', validate(userIdParamValidator), deleteUser);

// `/courses/pending` is the shorthand for the moderation queue. It must be
// declared BEFORE any `/courses/:id*` route or the dynamic matcher would
// treat `pending` as a Mongo id and 422 the request via the param validator.
router.get('/courses/pending', getPendingCourses);
router.get('/courses', validate(listCoursesAdminValidator), getAllCoursesAdmin);

router.post(
  '/courses/:id/approve',
  validate(adminCourseIdParamValidator),
  approveCourse,
);
router.post(
  '/courses/:id/reject',
  validate(rejectCourseValidator),
  rejectCourse,
);
router.post(
  '/courses/:id/archive',
  validate(adminCourseIdParamValidator),
  forceArchiveCourse,
);
router.delete(
  '/courses/:id',
  validate(forceDeleteCourseValidator),
  forceDeleteCourse,
);

export default router;
