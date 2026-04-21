/**
 * STEP 46 — JWT signing helpers (access + refresh) and crypto utilities for
 * email verification / password reset tokens.
 *
 * Design notes:
 *  - Access and refresh tokens are signed with DIFFERENT secrets so a
 *    leaked access token can never be replayed against the refresh
 *    endpoint (and vice versa). This is enforced in `config/env.js`.
 *  - Both payloads embed `tokenVersion`. Bumping the user's
 *    `tokenVersion` in Mongo invalidates every previously issued token
 *    of either kind — that is how "log out from all devices" and
 *    "password change" disable existing sessions everywhere.
 *  - Random tokens for email verification and password reset are
 *    generated with `crypto.randomBytes(32)` (256 bits of entropy) and
 *    only their SHA-256 hash is persisted, so a database leak cannot be
 *    replayed against the verify / reset endpoints.
 *
 *  The legacy single-secret signer (`generateToken`) lives in
 *  `utils/generateToken.js` and now delegates here to keep the seeder /
 *  any old callers working through the migration window.
 */

import crypto from 'node:crypto';

import jwt from 'jsonwebtoken';

import { env } from '../config/env.js';

const userId = (user) => (typeof user === 'string' ? user : user._id.toString());

/**
 * Short-lived access token — kept small so it can travel in every
 * request without bloating logs. Carries only what the auth middleware
 * needs to make a decision (id, role, version).
 */
export const generateAccessToken = (user) =>
  jwt.sign(
    {
      id: userId(user),
      role: user.role,
      tokenVersion: user.tokenVersion ?? 0,
    },
    env.JWT_ACCESS_SECRET,
    { expiresIn: env.JWT_ACCESS_EXPIRES_IN },
  );

/**
 * Long-lived refresh token. The role is intentionally omitted — refresh
 * tokens MUST NOT carry authorization claims, only identity, so a stolen
 * refresh token can never be used directly for protected calls.
 */
export const generateRefreshToken = (user) =>
  jwt.sign(
    {
      id: userId(user),
      tokenVersion: user.tokenVersion ?? 0,
    },
    env.JWT_REFRESH_SECRET,
    { expiresIn: env.JWT_REFRESH_EXPIRES_IN },
  );

export const verifyAccessToken = (token) => jwt.verify(token, env.JWT_ACCESS_SECRET);

export const verifyRefreshToken = (token) => jwt.verify(token, env.JWT_REFRESH_SECRET);

/**
 * 256-bit random token (raw, hex-encoded) for one-shot email links.
 * Caller is expected to email the raw value and persist only its hash
 * via `hashToken()`.
 */
export const generateRandomToken = () => crypto.randomBytes(32).toString('hex');

export const hashToken = (raw) => crypto.createHash('sha256').update(raw).digest('hex');

export default {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  generateRandomToken,
  hashToken,
};
