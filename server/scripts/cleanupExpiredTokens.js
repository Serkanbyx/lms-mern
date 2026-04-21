/**
 * Cron: clear expired auth tokens.
 *
 * Schedule (Render Cron Jobs): `0 * * * *` — hourly.
 *
 * The `User` document carries two short-lived single-use token pairs
 * (raw token never stored — only the sha256 hash + an expiry timestamp):
 *
 *  - `passwordResetToken`         + `passwordResetExpires`
 *  - `emailVerificationToken`     + `emailVerificationExpires`
 *
 * Once their `*Expires` timestamp passes they are useless to the holder
 * but still occupy index space and complicate audit queries ("how many
 * users currently have a pending reset?"). This job sweeps them.
 *
 * Two independent updates so a partial failure on one cohort doesn't
 * skip the other; both are unset with `$unset` so the fields drop out
 * of the document entirely instead of lingering as `null`.
 *
 * NOTE: We never touch `isEmailVerified` here — that flag stays as it
 * is. We only sweep the expired LINKS so a user can request a fresh
 * one without an "already pending" lookup colliding.
 */

import mongoose from 'mongoose';

import { connectDB } from '../config/db.js';
import { User } from '../models/User.model.js';
import { logger } from '../utils/logger.js';

const run = async () => {
  await connectDB();

  const now = new Date();

  const [resetResult, verifyResult] = await Promise.all([
    User.updateMany(
      { passwordResetExpires: { $lt: now } },
      { $unset: { passwordResetToken: '', passwordResetExpires: '' } },
    ),
    User.updateMany(
      { emailVerificationExpires: { $lt: now } },
      { $unset: { emailVerificationToken: '', emailVerificationExpires: '' } },
    ),
  ]);

  logger.info(
    {
      passwordResetCleared: resetResult.modifiedCount,
      emailVerificationCleared: verifyResult.modifiedCount,
      sweptAt: now.toISOString(),
    },
    'cleanupExpiredTokens: completed.',
  );
};

run()
  .then(async () => {
    await mongoose.connection.close().catch(() => {});
    process.exit(0);
  })
  .catch(async (err) => {
    logger.error({ err }, 'cleanupExpiredTokens: failed.');
    await mongoose.connection.close().catch(() => {});
    process.exit(1);
  });
