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
 * Endpoints:
 *   GET    /stats              dashboard aggregate counters
 *   GET    /users              paginated, searchable user directory
 *   GET    /users/:id          full user record + derived counters
 *   PATCH  /users/:id/role     promote / demote a user
 *   PATCH  /users/:id/active   enable / disable a user (logout-on-next-req)
 *   DELETE /users/:id          hard delete with full cascade
 */

import { Router } from 'express';

import {
  deleteUser,
  getAllUsers,
  getDashboardStats,
  getUserById,
  toggleUserActive,
  updateUserRole,
} from '../controllers/admin.controller.js';
import { protect } from '../middleware/auth.middleware.js';
import { adminLimiter } from '../middleware/rateLimit.middleware.js';
import { adminOnly } from '../middleware/role.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import {
  listUsersValidator,
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

export default router;
