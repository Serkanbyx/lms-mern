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
import { validate } from '../middleware/validate.middleware.js';
import {
  changePasswordValidator,
  deleteAccountValidator,
  loginValidator,
  registerValidator,
  updateProfileValidator,
} from '../validators/auth.validator.js';

const router = Router();

router.post('/register', validate(registerValidator), register);
router.post('/login', validate(loginValidator), login);

router.get('/me', protect, getMe);
router.patch('/me', protect, validate(updateProfileValidator), updateProfile);
router.patch('/me/password', protect, validate(changePasswordValidator), changePassword);
router.delete('/me', protect, validate(deleteAccountValidator), deleteAccount);

export default router;
