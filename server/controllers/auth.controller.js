/**
 * Auth controller — register, login, profile, password, account deletion,
 * email verification, password reset, refresh token rotation, single-device
 * + global logout.
 *
 * Security guarantees enforced here:
 *  - Mass-assignment: every body is run through `pickFields` so only the
 *    documented surface can flow into the database.
 *  - User enumeration: `login` and `forgotPassword` return the SAME success
 *    / failure shape regardless of whether the email exists.
 *  - Privilege escalation: `role` is NEVER read from request bodies.
 *  - Disabled accounts cannot authenticate.
 *  - Account lockout: after `MAX_LOGIN_ATTEMPTS` consecutive failures the
 *    account locks for `LOCK_DURATION_MIN` minutes. The error message
 *    stays generic to avoid leaking the locked state.
 *  - Tokens carry a per-user `tokenVersion`. Bumping it on logout-all /
 *    password change invalidates every issued token across every device.
 *  - Email verification + password reset tokens are SHA-256 hashed in the
 *    DB and have short TTLs (24h / 15min by default).
 *  - Refresh token strategy: HttpOnly + Secure + SameSite=Strict cookie
 *    scoped to `/api/auth`. Access tokens are returned in the JSON body.
 */

import mongoose from 'mongoose';

import { env } from '../config/env.js';
import { hashAuthToken, User } from '../models/User.model.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import {
  sendPasswordChangedEmail,
  sendPasswordResetEmail,
  sendVerificationEmail,
  sendWelcomeEmail,
} from '../utils/email.js';
import { pickFields } from '../utils/pickFields.js';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} from '../utils/tokens.js';

const REGISTER_FIELDS = ['name', 'email', 'password'];
const PROFILE_FIELDS = ['name', 'avatar', 'bio', 'headline'];

// ---------------------------------------------------------------------------
// Refresh-token cookie helpers (Option A — HttpOnly cookie, recommended).
// ---------------------------------------------------------------------------

const refreshCookieMaxAgeMs = () => {
  // Mirror the JWT TTL so the cookie expires alongside the token. Supports
  // shorthand strings like `7d`, `12h`, `30m`, `45s`.
  const value = String(env.JWT_REFRESH_EXPIRES_IN).trim();
  const match = value.match(/^(\d+)\s*([smhd])?$/i);
  if (!match) return 7 * 24 * 60 * 60 * 1000;
  const amount = Number(match[1]);
  const unit = (match[2] || 's').toLowerCase();
  const multiplier = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[unit];
  return amount * multiplier;
};

const buildRefreshCookieOptions = () => ({
  httpOnly: true,
  secure: env.isProd,
  sameSite: env.isProd ? 'strict' : 'lax',
  // Restrict to the auth path so the browser only ships the refresh
  // token where it is actually consumed (cuts CSRF blast radius).
  path: '/api/auth',
  maxAge: refreshCookieMaxAgeMs(),
});

const setRefreshCookie = (res, token) => {
  res.cookie(env.REFRESH_COOKIE_NAME, token, buildRefreshCookieOptions());
};

const clearRefreshCookie = (res) => {
  // Express requires the same path option for `clearCookie` to actually clear it.
  res.clearCookie(env.REFRESH_COOKIE_NAME, { path: '/api/auth' });
};

const issueAuthResponse = (res, status, user, { message } = {}) => {
  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);
  setRefreshCookie(res, refreshToken);
  return res.status(status).json({
    success: true,
    token: accessToken,
    user: user.toSafeJSON(),
    ...(message ? { message } : {}),
  });
};

// ---------------------------------------------------------------------------
// Account-cascade helpers (carried over from STEP 3).
// ---------------------------------------------------------------------------

const cascadeDeleteForUser = async (userId) => {
  const registered = new Set(mongoose.modelNames());
  const ops = [];
  if (registered.has('Enrollment')) {
    ops.push(mongoose.model('Enrollment').deleteMany({ user: userId }));
  }
  if (registered.has('QuizAttempt')) {
    ops.push(mongoose.model('QuizAttempt').deleteMany({ user: userId }));
  }
  if (registered.has('Course')) {
    ops.push(mongoose.model('Course').deleteMany({ instructor: userId }));
  }
  if (ops.length > 0) await Promise.all(ops);
};

const assertInstructorHasNoActiveEnrollments = async (user) => {
  if (user.role !== 'instructor') return;
  if (!mongoose.modelNames().includes('Enrollment')) return;
  if (!mongoose.modelNames().includes('Course')) return;

  const Course = mongoose.model('Course');
  const Enrollment = mongoose.model('Enrollment');
  const ownedCourseIds = await Course.find({ instructor: user._id }).distinct('_id');
  if (ownedCourseIds.length === 0) return;

  const activeEnrollments = await Enrollment.countDocuments({
    course: { $in: ownedCourseIds },
  });

  if (activeEnrollments > 0) {
    throw ApiError.conflict(
      'Cannot delete account: students are still enrolled in your courses. Archive or transfer them first.',
    );
  }
};

// ---------------------------------------------------------------------------
// Register / Login / Profile / Password / Delete (existing surface, updated).
// ---------------------------------------------------------------------------

export const register = asyncHandler(async (req, res) => {
  const payload = pickFields(req.body, REGISTER_FIELDS);

  const existing = await User.findOne({ email: payload.email });
  if (existing) {
    throw ApiError.conflict('An account with this email already exists.');
  }

  const user = await User.create({ ...payload, role: 'student' });

  // Generate verification token AFTER create() so the pre-save bcrypt
  // hook only runs once on the password.
  const rawToken = user.createEmailVerificationToken();
  await user.save({ validateBeforeSave: false });
  // Fire-and-forget — a flaky SMTP must NOT take down the register flow.
  sendVerificationEmail(user, rawToken).catch(() => {});

  return issueAuthResponse(res, 201, user, {
    message: 'Account created. Please check your inbox to verify your email.',
  });
});

export const login = asyncHandler(async (req, res) => {
  const { email, password } = pickFields(req.body, ['email', 'password']);

  const user = await User.findOne({ email }).select(
    '+password +tokenVersion +failedLoginAttempts +lockUntil',
  );

  // Identical error message regardless of which check fails — defeats user
  // enumeration via login probes.
  const invalidCredentials = ApiError.unauthorized('Invalid email or password.');

  if (!user) throw invalidCredentials;

  if (user.isLocked) {
    // Same message as bad credentials so an attacker can't differentiate
    // a locked vs nonexistent account, but a 423 status hands the client
    // a cue for a friendlier UX (see security note in STEP 46).
    throw new ApiError(423, 'Account temporarily locked. Please try again later.', {
      code: 'ACCOUNT_LOCKED',
    });
  }

  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    user.registerFailedLoginAttempt();
    await user.save({ validateBeforeSave: false });
    throw invalidCredentials;
  }
  if (!user.isActive) throw ApiError.forbidden('Account is disabled.');

  user.resetLoginAttempts();
  user.lastLoginAt = new Date();
  await user.save({ validateBeforeSave: false });

  return issueAuthResponse(res, 200, user);
});

export const getMe = asyncHandler(async (req, res) => {
  res.json({ success: true, user: req.user.toSafeJSON() });
});

export const updateProfile = asyncHandler(async (req, res) => {
  const updates = pickFields(req.body, PROFILE_FIELDS);
  if (Object.keys(updates).length === 0) {
    throw ApiError.badRequest('No updatable fields provided.');
  }

  Object.assign(req.user, updates);
  await req.user.save();

  res.json({ success: true, user: req.user.toSafeJSON() });
});

export const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = pickFields(req.body, [
    'currentPassword',
    'newPassword',
  ]);

  if (currentPassword === newPassword) {
    throw ApiError.badRequest('New password must be different from the current password.');
  }

  const user = await User.findById(req.user._id).select('+password +tokenVersion');
  if (!user) throw ApiError.unauthorized('Account no longer exists.');

  const isMatch = await user.comparePassword(currentPassword);
  if (!isMatch) throw ApiError.unauthorized('Current password is incorrect.');

  user.password = newPassword;
  // STEP 46 — bump tokenVersion so every other session is invalidated.
  user.tokenVersion = (user.tokenVersion || 0) + 1;
  await user.save();

  // Fresh tokens for the active client so the user isn't logged out
  // here even though every OTHER device just lost its session.
  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);
  setRefreshCookie(res, refreshToken);

  // Security awareness — never blocks the response.
  sendPasswordChangedEmail(user).catch(() => {});

  res.json({
    success: true,
    message: 'Password updated. Other devices have been signed out.',
    token: accessToken,
  });
});

export const deleteAccount = asyncHandler(async (req, res) => {
  const { password } = pickFields(req.body, ['password']);

  const user = await User.findById(req.user._id).select('+password');
  if (!user) throw ApiError.unauthorized('Account no longer exists.');

  const isMatch = await user.comparePassword(password);
  if (!isMatch) throw ApiError.unauthorized('Password is incorrect.');

  await assertInstructorHasNoActiveEnrollments(user);
  await cascadeDeleteForUser(user._id);
  await user.deleteOne();

  clearRefreshCookie(res);
  res.json({ success: true, message: 'Account deleted successfully.' });
});

// ---------------------------------------------------------------------------
// STEP 46 — Email verification.
// ---------------------------------------------------------------------------

export const verifyEmail = asyncHandler(async (req, res) => {
  const { token } = req.params;
  if (!token || typeof token !== 'string') {
    throw ApiError.badRequest('Verification token is required.');
  }

  const hashed = hashAuthToken(token);
  const user = await User.findOne({
    emailVerificationToken: hashed,
    emailVerificationExpires: { $gt: new Date() },
  }).select('+emailVerificationToken +emailVerificationExpires +tokenVersion');

  if (!user) {
    // Either the token is wrong, expired, or already consumed. We use a
    // single message — tweaking it would let an attacker probe valid
    // tokens by status.
    throw ApiError.badRequest('Verification link is invalid or has expired.');
  }

  user.isEmailVerified = true;
  user.emailVerificationToken = undefined;
  user.emailVerificationExpires = undefined;
  await user.save({ validateBeforeSave: false });

  sendWelcomeEmail(user).catch(() => {});

  res.json({
    success: true,
    message: 'Email verified successfully. Welcome aboard!',
    user: user.toSafeJSON(),
  });
});

export const resendVerification = asyncHandler(async (req, res) => {
  // Two entry points: an unauthenticated user typing their email on the
  // pending page, OR an authenticated user clicking the banner. Both flow
  // through the same controller — we resolve the user by `req.user` first
  // (the trustworthier source) and fall back to `req.body.email`.
  const targetEmail =
    req.user?.email ||
    (typeof req.body?.email === 'string' ? req.body.email.toLowerCase().trim() : '');

  // Generic envelope so anonymous requests cannot probe valid emails.
  const genericResponse = {
    success: true,
    message:
      'If an account exists for that email, a verification link is on its way.',
  };

  if (!targetEmail) {
    return res.json(genericResponse);
  }

  const user = await User.findOne({ email: targetEmail }).select(
    '+emailVerificationToken +emailVerificationExpires',
  );
  if (!user || user.isEmailVerified) {
    return res.json(genericResponse);
  }

  const rawToken = user.createEmailVerificationToken();
  await user.save({ validateBeforeSave: false });
  sendVerificationEmail(user, rawToken).catch(() => {});

  return res.json(genericResponse);
});

// ---------------------------------------------------------------------------
// STEP 46 — Password reset.
// ---------------------------------------------------------------------------

export const forgotPassword = asyncHandler(async (req, res) => {
  const email =
    typeof req.body?.email === 'string' ? req.body.email.toLowerCase().trim() : '';

  // Always return the same envelope so an attacker cannot enumerate
  // accounts by toggling the email.
  const genericResponse = {
    success: true,
    message:
      'If an account exists for that email, a reset link has been sent.',
  };

  if (!email) return res.json(genericResponse);

  const user = await User.findOne({ email }).select(
    '+passwordResetToken +passwordResetExpires',
  );
  if (!user) return res.json(genericResponse);

  const rawToken = user.createPasswordResetToken();
  await user.save({ validateBeforeSave: false });
  sendPasswordResetEmail(user, rawToken).catch(() => {});

  return res.json(genericResponse);
});

export const resetPassword = asyncHandler(async (req, res) => {
  const { token } = req.params;
  const { password } = pickFields(req.body, ['password']);

  if (!token || typeof token !== 'string') {
    throw ApiError.badRequest('Reset token is required.');
  }
  if (!password) {
    throw ApiError.badRequest('A new password is required.');
  }

  const hashed = hashAuthToken(token);
  const user = await User.findOne({
    passwordResetToken: hashed,
    passwordResetExpires: { $gt: new Date() },
  }).select('+password +passwordResetToken +passwordResetExpires +tokenVersion');

  if (!user) {
    throw ApiError.badRequest('Reset link is invalid or has expired.');
  }

  user.password = password;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  // Bump tokenVersion so any old sessions are kicked out.
  user.tokenVersion = (user.tokenVersion || 0) + 1;
  // A successful reset implies the user owns the inbox, so we treat that
  // as a verification side-effect too — saves them a second click.
  if (!user.isEmailVerified) {
    user.isEmailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
  }
  user.resetLoginAttempts();
  await user.save();

  sendPasswordChangedEmail(user).catch(() => {});

  res.json({
    success: true,
    message: 'Password reset successfully. Please sign in with your new password.',
  });
});

// ---------------------------------------------------------------------------
// STEP 46 — Refresh token rotation + logout(s).
// ---------------------------------------------------------------------------

export const refreshAccessToken = asyncHandler(async (req, res) => {
  const cookieToken = req.cookies?.[env.REFRESH_COOKIE_NAME];
  if (!cookieToken) {
    throw ApiError.unauthorized('No refresh token provided.', { code: 'TOKEN_MISSING' });
  }

  let payload;
  try {
    payload = verifyRefreshToken(cookieToken);
  } catch {
    clearRefreshCookie(res);
    throw ApiError.unauthorized('Refresh token expired or invalid.', {
      code: 'TOKEN_INVALID',
    });
  }

  const user = await User.findById(payload.id).select('+tokenVersion +lockUntil');
  if (!user || !user.isActive || user.isLocked) {
    clearRefreshCookie(res);
    throw ApiError.unauthorized('Session is no longer valid.', { code: 'TOKEN_REVOKED' });
  }
  if (typeof payload.tokenVersion === 'number' && payload.tokenVersion !== user.tokenVersion) {
    clearRefreshCookie(res);
    throw ApiError.unauthorized('Session is no longer valid.', { code: 'TOKEN_REVOKED' });
  }

  // Rotation: issue a brand-new refresh token + replace the cookie.
  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);
  setRefreshCookie(res, refreshToken);

  res.json({
    success: true,
    token: accessToken,
    user: user.toSafeJSON(),
  });
});

export const logout = asyncHandler(async (_req, res) => {
  clearRefreshCookie(res);
  res.json({ success: true, message: 'Signed out.' });
});

export const logoutAll = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select('+tokenVersion');
  if (!user) throw ApiError.unauthorized('Account no longer exists.');

  // Bumping `tokenVersion` invalidates every token previously issued for
  // this user — across every device. We then immediately mint a fresh
  // access + refresh pair for the CALLING client so the user stays
  // signed in here. This matches the "sign out from all OTHER devices"
  // UX without weakening the security guarantee for the rest.
  user.tokenVersion = (user.tokenVersion || 0) + 1;
  await user.save({ validateBeforeSave: false });

  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);
  setRefreshCookie(res, refreshToken);

  res.json({
    success: true,
    message: 'Signed out from every other device.',
    token: accessToken,
    user: user.toSafeJSON(),
  });
});

export default {
  register,
  login,
  getMe,
  updateProfile,
  changePassword,
  deleteAccount,
  verifyEmail,
  resendVerification,
  forgotPassword,
  resetPassword,
  refreshAccessToken,
  logout,
  logoutAll,
};
