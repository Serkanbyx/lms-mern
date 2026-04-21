/**
 * Cloudinary configuration + buffer-to-Cloudinary stream helper.
 *
 * Cloudinary is configured exactly once at module import time. The
 * `uploadStreamToCloudinary` helper accepts a raw Buffer (typically from
 * Multer's memoryStorage) and pipes it through Cloudinary's upload_stream API
 * via streamifier, so we never touch the local filesystem in production.
 *
 * Returns a normalized object: { secure_url, public_id, duration, type }.
 *  - `duration` is only present for video assets; otherwise it is null.
 *  - `type` mirrors the Cloudinary delivery type the asset was created with
 *    (`'upload'` by default, `'authenticated'` for STEP 47 video uploads) so
 *    callers know whether the asset can be served via a static `secure_url`
 *    or must be re-signed via `signedVideoUrl()` per request.
 *
 * STEP 47 — signed-URL hardening:
 *   Lesson videos are uploaded with `type: 'authenticated'`. Authenticated
 *   assets cannot be played from the bare `secure_url`; the client must be
 *   handed a short-lived signed URL minted via `signedVideoUrl()` on every
 *   read so deep links can't be hot-linked or scraped from the database.
 */

import { v2 as cloudinary } from 'cloudinary';
import streamifier from 'streamifier';

import { env } from './env.js';

if (env.CLOUDINARY_CONFIGURED) {
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
    secure: true,
  });
} else if (env.isProd) {
  // env.js already throws in production; this is a defensive guard.
  throw new Error('Cloudinary credentials are required in production.');
} else {
  // eslint-disable-next-line no-console
  console.warn(
    '[cloudinary] Credentials not set. Upload features will be disabled until you configure CLOUDINARY_* env vars.',
  );
}

const ALLOWED_DELIVERY_TYPES = new Set(['upload', 'authenticated', 'private']);

/**
 * Upload a raw Buffer to Cloudinary using their streaming API.
 *
 * @param {Buffer} buffer - The file bytes (e.g. `req.file.buffer` from Multer).
 * @param {string} folder - Target folder inside the Cloudinary account.
 * @param {'auto'|'image'|'video'|'raw'} [resourceType='auto'] - Cloudinary resource hint.
 * @param {{ type?: 'upload'|'authenticated'|'private' }} [options] - Extra
 *   delivery options. `type: 'authenticated'` keeps the asset behind a signed
 *   URL even after upload — used by lesson videos (STEP 47).
 * @returns {Promise<{
 *   secure_url: string,
 *   public_id: string,
 *   duration: number | null,
 *   type: 'upload'|'authenticated'|'private',
 * }>}
 */
export function uploadStreamToCloudinary(buffer, folder, resourceType = 'auto', options = {}) {
  if (!env.CLOUDINARY_CONFIGURED) {
    return Promise.reject(
      new Error('Cloudinary is not configured. Set CLOUDINARY_* environment variables.'),
    );
  }
  if (!Buffer.isBuffer(buffer)) {
    return Promise.reject(new TypeError('uploadStreamToCloudinary expects a Buffer.'));
  }
  if (!folder || typeof folder !== 'string') {
    return Promise.reject(new TypeError('uploadStreamToCloudinary expects a non-empty folder.'));
  }

  const deliveryType = options.type ?? 'upload';
  if (!ALLOWED_DELIVERY_TYPES.has(deliveryType)) {
    return Promise.reject(
      new TypeError(`Invalid delivery type "${deliveryType}". Use one of: upload, authenticated, private.`),
    );
  }

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder, resource_type: resourceType, type: deliveryType },
      (error, result) => {
        if (error) return reject(error);
        if (!result) return reject(new Error('Cloudinary returned an empty result.'));
        resolve({
          secure_url: result.secure_url,
          public_id: result.public_id,
          duration: typeof result.duration === 'number' ? result.duration : null,
          type: result.type ?? deliveryType,
        });
      },
    );

    streamifier.createReadStream(buffer).pipe(uploadStream);
  });
}

/**
 * Mint a short-lived signed URL for a Cloudinary `type: 'authenticated'` video.
 *
 * Used by every controller that returns a lesson video to the client (instructor
 * preview + enrolled-student curriculum) so the URL is regenerated per request
 * and expires within `expiresInSec`. This raises the bar for hot-linking and
 * unauthorized re-distribution of paid lesson content.
 *
 * The expiry is enforced by Cloudinary at delivery time — once the URL is past
 * `expires_at` Cloudinary returns 401 even with a valid signature. Set the TTL
 * generously enough to cover a long lesson playback (default 1 hour), but short
 * enough that a leaked URL stops working before it can be widely re-shared.
 *
 * @param {string} publicId - Cloudinary public id of the authenticated asset.
 * @param {number} [expiresInSec=3600] - Signed-URL lifetime in seconds.
 * @returns {string|null} Signed HTTPS URL, or null when no publicId provided.
 */
export const signedVideoUrl = (publicId, expiresInSec = 3600) => {
  if (!publicId) return null;
  return cloudinary.url(publicId, {
    resource_type: 'video',
    secure: true,
    sign_url: true,
    type: 'authenticated',
    expires_at: Math.floor(Date.now() / 1000) + expiresInSec,
  });
};

export { cloudinary };
export default cloudinary;
