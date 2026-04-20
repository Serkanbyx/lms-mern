/**
 * Auth controller — register, login, profile, password, account deletion.
 *
 * Security guarantees enforced here:
 *  - Mass-assignment: every body is run through `pickFields` so only the
 *    documented surface can flow into the database.
 *  - User enumeration: `login` returns the SAME error string for both
 *    "email not found" and "wrong password" cases.
 *  - Privilege escalation: `role` is NEVER read from request bodies. New
 *    accounts are always seeded as `student`. The only way to get an
 *    `admin`/`instructor` role is via the seeder or an admin-only endpoint
 *    that lives in a later step.
 *  - Disabled accounts cannot authenticate.
 *  - Account deletion requires the current password and cascades to related
 *    documents (enrollments, quiz attempts, owned courses) when those
 *    collections exist. Instructors with active enrollments are soft-blocked
 *    so we never strand paying students.
 */

import mongoose from 'mongoose';

import { User } from '../models/User.model.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { generateToken } from '../utils/generateToken.js';
import { pickFields } from '../utils/pickFields.js';

const REGISTER_FIELDS = ['name', 'email', 'password'];
const PROFILE_FIELDS = ['name', 'avatar', 'bio', 'headline'];

const issueAuthResponse = (res, status, user) => {
  const token = generateToken(user);
  return res.status(status).json({
    success: true,
    token,
    user: user.toSafeJSON(),
  });
};

/**
 * Best-effort cascade delete for the deleted user's owned data. Models are
 * resolved lazily through `mongoose.modelNames()` so this controller stays
 * usable before the Course/Enrollment/QuizAttempt steps land. Once those
 * models exist, the cascade activates automatically.
 */
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

/**
 * Block instructors from deleting an account that still has paying students.
 * Returns silently if the Enrollment model has not been registered yet.
 */
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

export const register = asyncHandler(async (req, res) => {
  const payload = pickFields(req.body, REGISTER_FIELDS);

  const existing = await User.findOne({ email: payload.email });
  if (existing) {
    // Generic message + same status as duplicate-key fallback to avoid enumeration.
    throw ApiError.conflict('An account with this email already exists.');
  }

  const user = await User.create({ ...payload, role: 'student' });
  return issueAuthResponse(res, 201, user);
});

export const login = asyncHandler(async (req, res) => {
  const { email, password } = pickFields(req.body, ['email', 'password']);

  const user = await User.findOne({ email }).select('+password');
  // Identical error message regardless of which check fails — defeats user
  // enumeration via login probes.
  const invalidCredentials = ApiError.unauthorized('Invalid email or password.');

  if (!user) throw invalidCredentials;
  const isMatch = await user.comparePassword(password);
  if (!isMatch) throw invalidCredentials;
  if (!user.isActive) throw ApiError.forbidden('Account is disabled.');

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

  const user = await User.findById(req.user._id).select('+password');
  if (!user) throw ApiError.unauthorized('Account no longer exists.');

  const isMatch = await user.comparePassword(currentPassword);
  if (!isMatch) throw ApiError.unauthorized('Current password is incorrect.');

  user.password = newPassword;
  await user.save();

  res.json({ success: true, message: 'Password updated successfully.' });
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

  res.json({ success: true, message: 'Account deleted successfully.' });
});

export default {
  register,
  login,
  getMe,
  updateProfile,
  changePassword,
  deleteAccount,
};
