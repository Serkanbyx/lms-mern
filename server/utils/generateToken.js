/**
 * JWT signing helpers.
 *
 * Tokens carry only the bare minimum needed for authorization decisions:
 * `id` (the user document id) and `role` (so middleware can short-circuit
 * RBAC checks without an extra database round-trip). Sensitive data (email,
 * password hash, preferences) NEVER goes into the token payload.
 *
 * STEP 3 ships the access-token signer. The rotating refresh-token signer is
 * wired in the dedicated refresh-token step; both share the same `env`-driven
 * secret/expiry contract so adding it later is a one-import change.
 */

import jwt from 'jsonwebtoken';

import { env } from '../config/env.js';

export const signAccessToken = (user) =>
  jwt.sign({ id: user._id.toString(), role: user.role }, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN,
  });

export const verifyAccessToken = (token) => jwt.verify(token, env.JWT_ACCESS_SECRET);

/**
 * Backwards-compatible alias used by controllers and the seeder.
 * Accepts a Mongoose user document (or any object with `_id` + `role`).
 */
export const generateToken = (user) => signAccessToken(user);

export default generateToken;
