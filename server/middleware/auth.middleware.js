/**
 * Authentication middleware.
 *
 * `protect`        — enforces a valid JWT, loads the owning user (without the
 *                    password hash), rejects deactivated accounts, and exposes
 *                    `req.user` to downstream handlers.
 * `optionalAuth`   — same flow, but a missing/invalid token is silently
 *                    treated as anonymous (`req.user = null`). Useful for
 *                    routes whose response shape changes for logged-in users.
 *
 * The bearer-token parser is shared between both functions to keep the
 * extraction rules (case, whitespace, "Bearer " prefix) in one place.
 */

import jwt from 'jsonwebtoken';

import { env } from '../config/env.js';
import { User } from '../models/User.model.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const extractBearerToken = (req) => {
  const header = req.headers.authorization || req.headers.Authorization;
  if (!header || typeof header !== 'string') return null;
  const [scheme, token] = header.trim().split(/\s+/);
  if (!scheme || scheme.toLowerCase() !== 'bearer' || !token) return null;
  return token;
};

const loadUserFromToken = async (token) => {
  const payload = jwt.verify(token, env.JWT_ACCESS_SECRET);
  if (!payload?.id) throw ApiError.unauthorized('Invalid authentication token.');

  const user = await User.findById(payload.id);
  if (!user) throw ApiError.unauthorized('Account no longer exists.');
  if (!user.isActive) throw ApiError.forbidden('Account is disabled.');

  return user;
};

export const protect = asyncHandler(async (req, _res, next) => {
  const token = extractBearerToken(req);
  if (!token) throw ApiError.unauthorized('Authentication required.');

  req.user = await loadUserFromToken(token);
  next();
});

export const optionalAuth = asyncHandler(async (req, _res, next) => {
  const token = extractBearerToken(req);
  if (!token) {
    req.user = null;
    return next();
  }
  try {
    req.user = await loadUserFromToken(token);
  } catch {
    req.user = null;
  }
  next();
});

export default protect;
