/**
 * Cron: prune stale draft courses.
 *
 * Schedule (Render Cron Jobs): `0 3 * * *` — daily at 03:00 UTC.
 *
 * Deletes any `Course` that is:
 *   - still in `draft` status,
 *   - has no enrollments (denormalized counter on the doc), and
 *   - has not been touched (`updatedAt`) for 90 days.
 *
 * The intent is to recycle abandoned authoring sessions so the catalog
 * indexes stay lean and instructor dashboards don't accumulate dozens
 * of "test" placeholders. Real published or pending courses are NEVER
 * touched — the filter is intentionally narrow.
 *
 * Idempotent: safe to re-run; if the same docs match again the second
 * run is a no-op deletion of an already-empty set.
 *
 * Exit code is `0` on success (including "nothing to do"), `1` on any
 * error so the cron platform shows a failed run.
 */

import mongoose from 'mongoose';

import { connectDB } from '../config/db.js';
import { Course } from '../models/Course.model.js';
import { logger } from '../utils/logger.js';

const STALE_DAYS = 90;

const run = async () => {
  await connectDB();

  const cutoff = new Date(Date.now() - STALE_DAYS * 24 * 60 * 60 * 1000);

  const filter = {
    status: 'draft',
    enrollmentCount: { $lte: 0 },
    updatedAt: { $lt: cutoff },
  };

  const result = await Course.deleteMany(filter);

  logger.info(
    { deleted: result.deletedCount, cutoff: cutoff.toISOString(), staleDays: STALE_DAYS },
    'cleanupStaleDrafts: completed.',
  );
};

run()
  .then(async () => {
    await mongoose.connection.close().catch(() => {});
    process.exit(0);
  })
  .catch(async (err) => {
    logger.error({ err }, 'cleanupStaleDrafts: failed.');
    await mongoose.connection.close().catch(() => {});
    process.exit(1);
  });
