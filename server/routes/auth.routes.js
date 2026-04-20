/**
 * `/api/auth` route group.
 *
 * Public endpoints: `register`, `login`.
 * Protected endpoints (Bearer token required):
 *   - `GET    /me`            current user profile
 *   - `PATCH  /me`            update name/avatar/bio/headline
 *   - `PATCH  /me/password`   change password (requires currentPassword)
 *   - `DELETE /me`            delete account (requires password)
 *
 * Per-route validation runs first so malformed payloads never reach the
 * controllers; `protect` runs before any handler that touches `req.user`.
 *
 * Rate limiting (STEP 18 matrix):
 *   - `authLimiter`     (10 / 15 min, IP+email keyed) on register/login
 *     to slow credential stuffing without locking out legitimate users.
 *   - `passwordLimiter` (5 / 15 min, user-id keyed) on the destructive
 *     self-service endpoints (password change, account delete) so a
 *     stolen access token can't iterate through possible current
 *     passwords or fire repeated delete attempts.
 *
 * The order is `validate(...) → handler` for the public endpoints (the
 * limiter runs first as router-level middleware) and
 * `protect → passwordLimiter → validate(...) → handler` for the
 * destructive me-* endpoints so the limiter has a real `req.user._id`
 * to key its bucket off. Wiring the limiter before `protect` would
 * collapse every authenticated request from the same IP into one
 * shared bucket and let one tenant DoS another.
 */

import { Router } from 'express';

import {
  changePassword,
  deleteAccount,
  getMe,
  login,
  register,
  updateProfile,
} from '../controllers/auth.controller.js';
import { protect } from '../middleware/auth.middleware.js';
import { authLimiter, passwordLimiter } from '../middleware/rateLimit.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import {
  changePasswordValidator,
  deleteAccountValidator,
  loginValidator,
  registerValidator,
  updateProfileValidator,
} from '../validators/auth.validator.js';

const router = Router();

router.post('/register', authLimiter, validate(registerValidator), register);
router.post('/login', authLimiter, validate(loginValidator), login);

router.get('/me', protect, getMe);
router.patch('/me', protect, validate(updateProfileValidator), updateProfile);
router.patch(
  '/me/password',
  protect,
  passwordLimiter,
  validate(changePasswordValidator),
  changePassword,
);
router.delete(
  '/me',
  protect,
  passwordLimiter,
  validate(deleteAccountValidator),
  deleteAccount,
);

export default router;
