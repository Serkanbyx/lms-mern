/**
 * User schema — the platform's identity root.
 *
 * Owns authentication credentials, role-based access control, public profile
 * surface (name, avatar, bio, headline) and the per-user `preferences`
 * subdocument that drives client-side UI (theme, font size, density,
 * playback defaults, privacy & notification toggles).
 *
 * SECURITY:
 *  - `password` is `select: false` so it never leaks in queries unless an
 *    explicit `.select('+password')` is requested by the auth controller.
 *  - `role` is server-controlled — never accept it from request bodies.
 *  - Passwords are hashed with bcrypt in a Mongoose 9 pre-save hook
 *    (no `next` parameter — early `return` exits the hook).
 *  - `toPublicProfile()` strips the password and respects the
 *    `preferences.privacy.showEmail` flag before returning to clients.
 */

import crypto from 'node:crypto';

import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';

import { env } from '../config/env.js';

const { Schema } = mongoose;

const ROLES = Object.freeze(['student', 'instructor', 'admin']);
const THEMES = Object.freeze(['light', 'dark', 'system']);
const FONT_SIZES = Object.freeze(['small', 'medium', 'large']);
const DENSITIES = Object.freeze(['compact', 'comfortable', 'spacious']);
const LANGUAGES = Object.freeze(['en']);
const PLAYBACK_SPEEDS = Object.freeze([0.5, 0.75, 1, 1.25, 1.5, 2]);

// Learner interest tags captured during onboarding. The set is
// kept aligned with the catalog's `COURSE_CATEGORIES` taxonomy so the
// post-register recommendation panel can map an interest straight to a
// catalog category filter without an intermediate lookup table.
const INTERESTS = Object.freeze([
  'programming',
  'design',
  'business',
  'marketing',
  'data-science',
  'language',
  'other',
]);

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const privacySchema = new Schema(
  {
    showEmail: { type: Boolean, default: false },
    showEnrolledCourses: { type: Boolean, default: true },
  },
  { _id: false },
);

const notificationsSchema = new Schema(
  {
    emailOnEnroll: { type: Boolean, default: true },
    emailOnQuizGraded: { type: Boolean, default: true },
  },
  { _id: false },
);

const playbackSchema = new Schema(
  {
    autoplayNext: { type: Boolean, default: false },
    defaultSpeed: {
      type: Number,
      default: 1,
      enum: {
        values: PLAYBACK_SPEEDS,
        message: `Playback speed must be one of: ${PLAYBACK_SPEEDS.join(', ')}`,
      },
    },
  },
  { _id: false },
);

const preferencesSchema = new Schema(
  {
    theme: { type: String, enum: THEMES, default: 'system' },
    fontSize: { type: String, enum: FONT_SIZES, default: 'medium' },
    contentDensity: { type: String, enum: DENSITIES, default: 'comfortable' },
    animations: { type: Boolean, default: true },
    language: { type: String, enum: LANGUAGES, default: 'en' },
    privacy: { type: privacySchema, default: () => ({}) },
    notifications: { type: notificationsSchema, default: () => ({}) },
    playback: { type: playbackSchema, default: () => ({}) },
    // Onboarding interest tags. Bounded by the curated `INTERESTS`
    // enum so a typo in the client can never fragment the taxonomy used
    // by the recommended-course query.
    interests: {
      type: [{ type: String, enum: INTERESTS }],
      default: [],
    },
    // Tracks whether the post-register onboarding flow has been completed
    // or skipped. Persisted on the server so the modal never re-opens on a
    // new device after the user has already dismissed it once.
    onboardingCompletedAt: { type: Date, default: null },
  },
  { _id: false },
);

const userSchema = new Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [60, 'Name must be at most 60 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      trim: true,
      lowercase: true,
      match: [EMAIL_REGEX, 'Please provide a valid email address'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters'],
      select: false,
    },
    role: {
      type: String,
      enum: {
        values: ROLES,
        message: `Role must be one of: ${ROLES.join(', ')}`,
      },
      default: 'student',
      required: true,
    },
    avatar: { type: String, default: '' },
    bio: { type: String, default: '', maxlength: [500, 'Bio must be at most 500 characters'] },
    headline: {
      type: String,
      default: '',
      maxlength: [120, 'Headline must be at most 120 characters'],
    },
    isActive: { type: Boolean, default: true },
    preferences: { type: preferencesSchema, default: () => ({}) },

    // Email verification.
    // The raw token is emailed to the user; only its sha256 hash is stored
    // in the DB so a database leak cannot be replayed against the verify
    // endpoint. `select: false` keeps the hash out of every default query.
    isEmailVerified: { type: Boolean, default: false },
    emailVerificationToken: { type: String, select: false },
    emailVerificationExpires: { type: Date, select: false },

    // Password reset (single-use, short-lived).
    passwordResetToken: { type: String, select: false },
    passwordResetExpires: { type: Date, select: false },

    // Token revocation. Embedded in every issued access &
    // refresh token; bumping it invalidates every previously issued token
    // across every device (logout-all, password change).
    tokenVersion: { type: Number, default: 0, select: false },

    // Account lockout.
    failedLoginAttempts: { type: Number, default: 0, select: false },
    lockUntil: { type: Date, select: false },
    lastLoginAt: { type: Date },

    // Reserved for future TOTP-based 2FA.
    twoFactorEnabled: { type: Boolean, default: false },
    twoFactorSecret: { type: String, select: false },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true, versionKey: false },
    toObject: { virtuals: true, versionKey: false },
  },
);

// MONGOOSE 9: Pre-hooks no longer receive a `next` callback. Use `return`
// (or throw) for early exit. Hash only when the password actually changed
// so re-saves (e.g. profile updates) don't double-hash.
userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  const salt = await bcrypt.genSalt(env.BCRYPT_ROUNDS);
  this.password = await bcrypt.hash(this.password, salt);
});

userSchema.methods.comparePassword = function comparePassword(plain) {
  if (!this.password) return false;
  return bcrypt.compare(plain, this.password);
};

userSchema.methods.toPublicProfile = function toPublicProfile() {
  const obj = this.toObject({ virtuals: true });
  delete obj.password;
  delete obj.__v;
  if (!obj.preferences?.privacy?.showEmail) {
    delete obj.email;
  }
  return obj;
};

userSchema.methods.toSafeJSON = function toSafeJSON() {
  const obj = this.toObject({ virtuals: true });
  delete obj.password;
  delete obj.__v;
  // Defensive — these have `select: false` so they normally never load,
  // but if a controller did `select('+...')` for an internal reason we
  // never want them leaving the API surface.
  delete obj.emailVerificationToken;
  delete obj.emailVerificationExpires;
  delete obj.passwordResetToken;
  delete obj.passwordResetExpires;
  delete obj.tokenVersion;
  delete obj.failedLoginAttempts;
  delete obj.lockUntil;
  delete obj.twoFactorSecret;
  return obj;
};

// --- Authentication helpers ------------------------------------------------

userSchema.virtual('isLocked').get(function isLocked() {
  return Boolean(this.lockUntil && this.lockUntil.getTime() > Date.now());
});

const sha256 = (raw) => crypto.createHash('sha256').update(raw).digest('hex');

/**
 * Generate a random verification token, store its SHA-256 hash + TTL on
 * the user document, and return the RAW token. Only the raw value should
 * be emailed — the DB never sees it in plain form.
 *
 * Caller is responsible for `await user.save()` (we mutate but don't
 * persist so the controller can batch the write with other changes).
 */
userSchema.methods.createEmailVerificationToken = function createEmailVerificationToken() {
  const raw = crypto.randomBytes(32).toString('hex');
  this.emailVerificationToken = sha256(raw);
  this.emailVerificationExpires = new Date(
    Date.now() + env.EMAIL_VERIFICATION_TTL_MIN * 60_000,
  );
  return raw;
};

userSchema.methods.createPasswordResetToken = function createPasswordResetToken() {
  const raw = crypto.randomBytes(32).toString('hex');
  this.passwordResetToken = sha256(raw);
  this.passwordResetExpires = new Date(
    Date.now() + env.PASSWORD_RESET_TTL_MIN * 60_000,
  );
  return raw;
};

/**
 * Atomic-ish lockout bump. The caller still owns the `await user.save()`
 * so the failed-login bookkeeping ends up in the same write as
 * `lastLoginAt` updates etc., but the policy lives here so every entry
 * point (login, future SSO callbacks) shares the same threshold.
 */
userSchema.methods.registerFailedLoginAttempt = function registerFailedLoginAttempt() {
  this.failedLoginAttempts = (this.failedLoginAttempts || 0) + 1;
  if (this.failedLoginAttempts >= env.MAX_LOGIN_ATTEMPTS) {
    this.lockUntil = new Date(Date.now() + env.LOCK_DURATION_MIN * 60_000);
    this.failedLoginAttempts = 0;
  }
};

userSchema.methods.resetLoginAttempts = function resetLoginAttempts() {
  this.failedLoginAttempts = 0;
  this.lockUntil = undefined;
};

export const hashAuthToken = sha256;

export const USER_ROLES = ROLES;
export const USER_THEMES = THEMES;
export const USER_FONT_SIZES = FONT_SIZES;
export const USER_DENSITIES = DENSITIES;
export const USER_LANGUAGES = LANGUAGES;
export const USER_PLAYBACK_SPEEDS = PLAYBACK_SPEEDS;
export const USER_INTERESTS = INTERESTS;

export const User = mongoose.models.User || mongoose.model('User', userSchema);

export default User;
