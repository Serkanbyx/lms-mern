/**
 * `/api/users` route group — non-auth user surface.
 *
 * Auth-related self-service (register, login, profile update, password
 * change, account delete) lives on `/api/auth/*`. This router owns the
 * two endpoints that fall outside the auth flow:
 *
 *   PATCH /me/preferences  protect             — partial preferences update
 *   GET   /:id             public              — public profile (privacy filtered)
 *
 * Route ordering rules:
 *   1. `GET /:id` is the only dynamic matcher on this router. The static
 *      `/me/preferences` segment cannot collide with it because `me` would
 *      first have to fail the `isMongoId()` validator with a 422 — but
 *      Express still routes by declaration order, so we register the
 *      static path FIRST as a defensive measure for any future addition
 *      of a `GET /me*` endpoint.
 *
 * Auth strategy:
 *   - `PATCH /me/preferences` requires a valid Bearer token. The handler
 *     mutates `req.user.preferences` directly, so the route MUST sit
 *     behind `protect` for `req.user` to exist.
 *   - `GET /:id` is intentionally public so an instructor card on a
 *     course detail page can deep-link to the profile without forcing
 *     a login. Privacy filtering (`preferences.privacy.*`) is applied
 *     server-side inside the controller — never trust the client to
 *     hide a field it has already received.
 */

import { Router } from 'express';

import { getPublicProfile, updateMyPreferences } from '../controllers/user.controller.js';
import { protect } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import {
  publicProfileParamValidator,
  updatePreferencesValidator,
} from '../validators/user.validator.js';

const router = Router();

router.patch(
  '/me/preferences',
  protect,
  validate(updatePreferencesValidator),
  updateMyPreferences,
);

router.get('/:id', validate(publicProfileParamValidator), getPublicProfile);

export default router;
