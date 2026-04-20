/**
 * `/api/upload` route group.
 *
 * Every endpoint requires an authenticated instructor or admin and is rate
 * limited (20 uploads per 10 minutes per IP) to protect Cloudinary quota
 * and bandwidth. Multer parses the multipart body into `req.file` before
 * the controller streams it to Cloudinary.
 *
 * Endpoints:
 *   POST   /image            — upload a course thumbnail (field: `image`)
 *   POST   /video            — upload a lesson video      (field: `video`)
 *   DELETE /:publicId        — destroy a Cloudinary asset (URL-encoded id)
 */

import { Router } from 'express';

import {
  deleteAsset,
  uploadCourseThumbnail,
  uploadLessonVideo,
} from '../controllers/upload.controller.js';
import { protect } from '../middleware/auth.middleware.js';
import { instructorOrAdmin } from '../middleware/role.middleware.js';
import { uploadLimiter } from '../middleware/rateLimit.middleware.js';
import { uploadImage, uploadVideo } from '../middleware/upload.middleware.js';

const router = Router();

router.use(protect, instructorOrAdmin, uploadLimiter);

router.post('/image', uploadImage.single('image'), uploadCourseThumbnail);
router.post('/video', uploadVideo.single('video'), uploadLessonVideo);
router.delete('/:publicId', deleteAsset);

export default router;
