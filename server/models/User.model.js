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
      minlength: [8, 'Password must be at least 8 characters'],
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
  return obj;
};

export const USER_ROLES = ROLES;
export const USER_THEMES = THEMES;
export const USER_FONT_SIZES = FONT_SIZES;
export const USER_DENSITIES = DENSITIES;
export const USER_LANGUAGES = LANGUAGES;
export const USER_PLAYBACK_SPEEDS = PLAYBACK_SPEEDS;

export const User = mongoose.models.User || mongoose.model('User', userSchema);

export default User;
