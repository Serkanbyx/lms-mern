/**
 * `/api/auth` route group.
 *
 * Public endpoints:
 *   - `POST   /register`               create account + send verification email
 *   - `POST   /login`                  email/password (with lockout)
 *   - `POST   /refresh`                rotate access token via cookie
 *   - `GET    /verify-email/:token`    confirm email
 *   - `POST   /resend-verification`    resend the verification email
 *   - `POST   /forgot-password`        always 200 (anti-enumeration)
 *   - `POST   /reset-password/:token`  consume reset link, set new password
 *
 * Protected endpoints (Bearer token required):
 *   - `GET    /me`                     current user profile
 *   - `PATCH  /me`                     update name/avatar/bio/headline
 *   - `PATCH  /me/password`            change password (bumps tokenVersion)
 *   - `DELETE /me`                     delete account (requires password)
 *   - `POST   /logout`                 clear refresh-token cookie
 *   - `POST   /logout-all`             bump tokenVersion → invalidate every session
 *
 * Per-route validation runs first so malformed payloads never reach the
 * controllers; `protect` runs before any handler that touches `req.user`.
 *
 * Rate limiting (STEP 18 + STEP 46 matrix):
 *   - `authLimiter`           (10 / 15 min, IP+email keyed) on register/login
 *   - `verifyEmailLimiter`    (5 / 15 min)  on /verify-email + /resend-verification
 *   - `forgotPasswordLimiter` (3 / 1 hour)  on /forgot-password (IP+email keyed)
 *   - `resetPasswordLimiter`  (5 / 15 min)  on /reset-password/:token (IP+token)
 *   - `refreshLimiter`        (30 / 1 min)  on /refresh
 *   - `passwordLimiter`       (5 / 15 min, user-id keyed) on the destructive
 *     self-service endpoints (password change, account delete)
 */

import { Router } from 'express';

import {
  changePassword,
  deleteAccount,
  forgotPassword,
  getMe,
  login,
  logout,
  logoutAll,
  refreshAccessToken,
  register,
  resendVerification,
  resetPassword,
  updateProfile,
  verifyEmail,
} from '../controllers/auth.controller.js';
import { protect } from '../middleware/auth.middleware.js';
import {
  authLimiter,
  forgotPasswordLimiter,
  passwordLimiter,
  refreshLimiter,
  resetPasswordLimiter,
  verifyEmailLimiter,
} from '../middleware/rateLimit.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import {
  changePasswordValidator,
  deleteAccountValidator,
  forgotPasswordValidator,
  loginValidator,
  registerValidator,
  resendVerificationValidator,
  resetPasswordValidator,
  updateProfileValidator,
  verifyEmailValidator,
} from '../validators/auth.validator.js';

const router = Router();

// --- Public ---------------------------------------------------------------

router.post('/register', authLimiter, validate(registerValidator), register);
router.post('/login', authLimiter, validate(loginValidator), login);

router.post('/refresh', refreshLimiter, refreshAccessToken);

router.get(
  '/verify-email/:token',
  verifyEmailLimiter,
  validate(verifyEmailValidator),
  verifyEmail,
);
router.post(
  '/resend-verification',
  verifyEmailLimiter,
  validate(resendVerificationValidator),
  resendVerification,
);

router.post(
  '/forgot-password',
  forgotPasswordLimiter,
  validate(forgotPasswordValidator),
  forgotPassword,
);
router.post(
  '/reset-password/:token',
  resetPasswordLimiter,
  validate(resetPasswordValidator),
  resetPassword,
);

// --- Protected ------------------------------------------------------------

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

router.post('/logout', protect, logout);
router.post('/logout-all', protect, logoutAll);

export default router;
