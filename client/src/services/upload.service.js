/**
 * Upload service — Cloudinary-backed media endpoints.
 *
 * Uploads are sent as multipart form-data; axios infers the boundary
 * automatically when given a `FormData` body, so callers do NOT need to
 * set `Content-Type` manually (doing so would strip the boundary).
 *
 * Each upload accepts an optional `onProgress(percent)` callback so the
 * UI can render a determinate progress bar without coupling components
 * to axios' raw event shape.
 *
 * Server response shape (see `server/controllers/upload.controller.js`):
 *   image → { success, url, publicId }
 *   video → { success, url, publicId, duration }
 */

import api from '../api/axios.js';
import { UPLOAD_RESOURCE_TYPES } from '../utils/constants.js';

const buildProgressHandler = (onProgress) => {
  if (typeof onProgress !== 'function') return undefined;
  return (event) => {
    if (!event.total) return;
    const percent = Math.round((event.loaded * 100) / event.total);
    onProgress(percent);
  };
};

const postFile = async (path, fieldName, file, onProgress) => {
  const form = new FormData();
  form.append(fieldName, file);
  const { data } = await api.post(path, form, {
    onUploadProgress: buildProgressHandler(onProgress),
  });
  return data;
};

export const uploadImage = (file, onProgress) =>
  postFile('/upload/image', 'image', file, onProgress);

export const uploadVideo = (file, onProgress) =>
  postFile('/upload/video', 'video', file, onProgress);

export const deleteAsset = async (publicId, resourceType = UPLOAD_RESOURCE_TYPES.image) => {
  const { data } = await api.delete(`/upload/${encodeURIComponent(publicId)}`, {
    params: { resourceType },
  });
  return data;
};

export default {
  uploadImage,
  uploadVideo,
  deleteAsset,
};
