/**
 * Cloudinary configuration + buffer-to-Cloudinary stream helper.
 *
 * Cloudinary is configured exactly once at module import time. The
 * `uploadStreamToCloudinary` helper accepts a raw Buffer (typically from
 * Multer's memoryStorage) and pipes it through Cloudinary's upload_stream API
 * via streamifier, so we never touch the local filesystem in production.
 *
 * Returns a normalized object: { secure_url, public_id, duration }.
 *  - `duration` is only present for video assets; otherwise it is null.
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

/**
 * Upload a raw Buffer to Cloudinary using their streaming API.
 *
 * @param {Buffer} buffer - The file bytes (e.g. `req.file.buffer` from Multer).
 * @param {string} folder - Target folder inside the Cloudinary account.
 * @param {'auto'|'image'|'video'|'raw'} [resourceType='auto'] - Cloudinary resource hint.
 * @returns {Promise<{ secure_url: string, public_id: string, duration: number | null }>}
 */
export function uploadStreamToCloudinary(buffer, folder, resourceType = 'auto') {
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

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder, resource_type: resourceType },
      (error, result) => {
        if (error) return reject(error);
        if (!result) return reject(new Error('Cloudinary returned an empty result.'));
        resolve({
          secure_url: result.secure_url,
          public_id: result.public_id,
          duration: typeof result.duration === 'number' ? result.duration : null,
        });
      },
    );

    streamifier.createReadStream(buffer).pipe(uploadStream);
  });
}

export { cloudinary };
export default cloudinary;
