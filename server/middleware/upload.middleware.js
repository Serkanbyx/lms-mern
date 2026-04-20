/**
 * Multer upload middleware factories.
 *
 * Files are buffered in memory (never written to local disk) so they can be
 * streamed straight into Cloudinary by the upload controller. Two preset
 * instances cover every upload surface of the LMS:
 *
 *   - `uploadImage` — course thumbnails (jpeg/png/webp, max 5 MB)
 *   - `uploadVideo` — lesson videos    (mp4/webm/quicktime, max 200 MB)
 *
 * The `fileFilter` rejects any MIME type outside the whitelist with an
 * `ApiError(400)` so the central error middleware returns a clean response.
 * Multer's own `LIMIT_*` errors are similarly normalized to 400 by the
 * central error handler (see `error.middleware.js`).
 *
 * SECURITY NOTES:
 *   - We trust Cloudinary to perform real magic-byte validation; the MIME
 *     whitelist here is a fast first line of defense.
 *   - Original filenames are never persisted — Cloudinary generates the
 *     `public_id`. This avoids path-traversal / header-injection vectors.
 *   - `files: 1` caps multipart abuse where attackers attach hundreds of
 *     parts to exhaust memory.
 */

import multer from 'multer';

import { ApiError } from '../utils/ApiError.js';

const ONE_MB = 1024 * 1024;

const ALLOWED_IMAGE_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
const ALLOWED_VIDEO_MIME = new Set([
  'video/mp4',
  'video/webm',
  'video/quicktime',
]);

const buildFileFilter = (allowed, kind) => (_req, file, cb) => {
  if (allowed.has(file.mimetype)) return cb(null, true);
  return cb(
    ApiError.badRequest(
      `Unsupported ${kind} type "${file.mimetype}". Allowed: ${[...allowed].join(', ')}.`,
    ),
  );
};

export const uploadImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * ONE_MB, files: 1 },
  fileFilter: buildFileFilter(ALLOWED_IMAGE_MIME, 'image'),
});

export const uploadVideo = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 200 * ONE_MB, files: 1 },
  fileFilter: buildFileFilter(ALLOWED_VIDEO_MIME, 'video'),
});

export default { uploadImage, uploadVideo };
