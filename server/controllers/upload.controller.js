/**
 * Upload controller — Cloudinary-backed media endpoints.
 *
 * Three handlers cover the entire instructor authoring flow:
 *
 *   - `uploadCourseThumbnail` — POST /api/upload/image
 *   - `uploadLessonVideo`     — POST /api/upload/video
 *   - `deleteAsset`           — DELETE /api/upload/:publicId
 *
 * Files arrive as `req.file` from Multer's `memoryStorage`, are streamed
 * straight to Cloudinary (no local disk I/O), and the response surfaces only
 * the data the client actually needs (`url`, `publicId`, optional `duration`).
 *
 * SECURITY NOTES:
 *   - All routes are mounted behind `protect` + `instructorOrAdmin`.
 *   - `publicId` arriving in the URL is URL-decoded and validated against a
 *     strict allowlist pattern (`^lms/[\w/-]+$`) before being passed to
 *     Cloudinary, so attackers cannot escape the `lms/` namespace and delete
 *     unrelated assets in the account.
 *   - Cloudinary "not found" results return 200 (idempotent delete) so the
 *     client can safely retry without 404 noise.
 *   - Lesson videos are uploaded with `type: 'authenticated'`. The
 *     `secure_url` Cloudinary returns at upload time is NOT directly playable
 *     — clients must hit a server endpoint that mints a fresh signed URL via
 *     `signedVideoUrl()` per request. We surface a one-shot `signedUrl` here
 *     so the authoring UI can preview the freshly uploaded asset immediately.
 */

import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import {
  cloudinary,
  signedVideoUrl,
  uploadStreamToCloudinary,
} from '../config/cloudinary.js';

const PUBLIC_ID_PATTERN = /^lms\/[\w/-]+$/;
const ALLOWED_RESOURCE_TYPES = new Set(['image', 'video', 'raw']);
const ALLOWED_DELIVERY_TYPES = new Set(['upload', 'authenticated', 'private']);

/**
 * POST /api/upload/image
 * Field: `image` (single)
 */
export const uploadCourseThumbnail = asyncHandler(async (req, res) => {
  if (!req.file) throw ApiError.badRequest('No image file provided.');

  const { secure_url, public_id } = await uploadStreamToCloudinary(
    req.file.buffer,
    'lms/thumbnails',
    'image',
  );

  res.status(201).json({
    success: true,
    url: secure_url,
    publicId: public_id,
  });
});

/**
 * POST /api/upload/video
 * Field: `video` (single)
 */
export const uploadLessonVideo = asyncHandler(async (req, res) => {
  if (!req.file) throw ApiError.badRequest('No video file provided.');

  // Lesson videos are uploaded as `type: 'authenticated'` so the
  // raw `secure_url` cannot be played without a fresh signature. We immediately
  // mint a short-lived signed URL for the authoring UI's "preview after upload"
  // affordance; long-term reads must always go through `signedVideoUrl()` again.
  const { public_id, duration, type } = await uploadStreamToCloudinary(
    req.file.buffer,
    'lms/lesson-videos',
    'video',
    { type: 'authenticated' },
  );

  res.status(201).json({
    success: true,
    url: signedVideoUrl(public_id),
    publicId: public_id,
    duration,
    type,
  });
});

/**
 * DELETE /api/upload/:publicId
 *
 * The publicId path segment MUST be URL-encoded by the client because
 * Cloudinary public IDs contain forward slashes (e.g. `lms/thumbnails/abc`),
 * and Express route params do not match across `/`. Example:
 *   DELETE /api/upload/lms%2Fthumbnails%2Fabc?resourceType=image
 *
 * Optional query:
 *   - `resourceType` — one of `image` (default), `video`, `raw`.
 *   - `type` — one of `upload` (default), `authenticated`, `private`. Must
 *     match the delivery type the asset was uploaded with, otherwise
 *     Cloudinary returns "not found". Lesson videos live under
 *     `type=authenticated`.
 */
export const deleteAsset = asyncHandler(async (req, res) => {
  const decoded = decodeURIComponent(req.params.publicId || '');
  if (!PUBLIC_ID_PATTERN.test(decoded)) {
    throw ApiError.badRequest('Invalid public ID.');
  }

  const requestedType = String(req.query.resourceType || 'image').toLowerCase();
  if (!ALLOWED_RESOURCE_TYPES.has(requestedType)) {
    throw ApiError.badRequest('Invalid resourceType. Use image, video, or raw.');
  }

  const requestedDelivery = String(req.query.type || 'upload').toLowerCase();
  if (!ALLOWED_DELIVERY_TYPES.has(requestedDelivery)) {
    throw ApiError.badRequest('Invalid type. Use upload, authenticated, or private.');
  }

  const result = await cloudinary.uploader.destroy(decoded, {
    resource_type: requestedType,
    type: requestedDelivery,
    invalidate: true,
  });

  if (result.result !== 'ok' && result.result !== 'not found') {
    throw ApiError.badRequest(`Failed to delete asset: ${result.result}`);
  }

  res.json({
    success: true,
    publicId: decoded,
    result: result.result,
  });
});

export default {
  uploadCourseThumbnail,
  uploadLessonVideo,
  deleteAsset,
};
