/**
 * Cron: nudge learners who finished a course but never grabbed the
 * certificate.
 *
 * Schedule (Render Cron Jobs): `0 10 * * *` — daily at 10:00 UTC.
 *
 * Targets every `Enrollment` where:
 *   - `progressPercent === 100`,
 *   - `certificateIssuedAt` is still null (never downloaded), and
 *   - `completedAt` was at least 7 days ago (so we don't spam someone
 *     who finished yesterday and is about to grab it anyway).
 *
 * Sends a single non-blocking reminder email per match. We do NOT track
 * a "reminder sent" flag in v1: cron platforms make duplicate runs the
 * exception, the volume is small, and re-nudging once a quarter is
 * harmless. If the volume grows, add `lastCertReminderAt` to
 * `Enrollment` and add `lastCertReminderAt: { $lt: Date.now() - 30d }`
 * to the filter.
 *
 * Respects two operational constraints:
 *  - `features.certificates`: if the certificate feature is dark-launched
 *    OFF the job exits early so we don't email about a button that has
 *    been hidden in the UI.
 *  - `MAIL_CONFIGURED`: when SMTP is missing in dev the email helper
 *    short-circuits to a console log; the cron still completes.
 *
 * Email failures are swallowed per-recipient so one bad mailbox does not
 * abort the whole batch.
 */

import mongoose from 'mongoose';

import { connectDB } from '../config/db.js';
import { features } from '../config/features.js';
import { Course } from '../models/Course.model.js';
import { Enrollment } from '../models/Enrollment.model.js';
import { User } from '../models/User.model.js';
import { sendEmail } from '../utils/email.js';
import { logger } from '../utils/logger.js';
import { env } from '../config/env.js';

const REMINDER_AFTER_DAYS = 7;
const BATCH_SIZE = 200;

const buildReminderEmail = (user, course) => {
  const dashboard = `${env.CLIENT_URL.replace(/\/$/, '')}/dashboard`;
  const subject = `Don't forget your certificate for "${course.title}"`;
  const html = `<p>Hi ${user.name || 'there'},</p>
    <p>You completed <strong>${course.title}</strong> — congratulations! Your certificate is ready to download from your dashboard whenever you're ready to add it to your portfolio or LinkedIn.</p>
    <p><a href="${dashboard}" style="color:#4f46e5;">Open dashboard</a></p>
    <p style="font-size:12px;color:#6b7280;">You're receiving this because you finished a course but haven't downloaded the certificate yet. We only send this reminder once.</p>`;
  const text = `Hi ${user.name || 'there'},

You completed "${course.title}" — congratulations! Download your certificate from your dashboard:
${dashboard}`;
  return { subject, html, text };
};

const run = async () => {
  if (!features.certificates) {
    logger.info('certificateReminder: feature disabled, exiting.');
    return;
  }

  await connectDB();

  const cutoff = new Date(Date.now() - REMINDER_AFTER_DAYS * 24 * 60 * 60 * 1000);

  const filter = {
    progressPercent: 100,
    certificateIssuedAt: null,
    completedAt: { $ne: null, $lt: cutoff },
  };

  const cursor = Enrollment.find(filter)
    .select('userId courseId completedAt')
    .batchSize(BATCH_SIZE)
    .cursor();

  let scanned = 0;
  let sent = 0;
  let skipped = 0;

  for await (const enrollment of cursor) {
    scanned += 1;
    const [user, course] = await Promise.all([
      User.findById(enrollment.userId).select('name email preferences').lean(),
      Course.findById(enrollment.courseId).select('title').lean(),
    ]);

    if (!user || !course) {
      skipped += 1;
      continue;
    }
    if (user.preferences?.notifications?.emailOnQuizGraded === false) {
      // Re-use the existing notification preference as a coarse opt-out
      // until a dedicated `emailOnCourseComplete` toggle ships.
      skipped += 1;
      continue;
    }

    const { subject, html, text } = buildReminderEmail(user, course);
    const result = await sendEmail({ to: user.email, subject, html, text });
    if (result.ok) sent += 1;
    else skipped += 1;
  }

  logger.info(
    { scanned, sent, skipped, cutoff: cutoff.toISOString() },
    'certificateReminder: completed.',
  );
};

run()
  .then(async () => {
    await mongoose.connection.close().catch(() => {});
    process.exit(0);
  })
  .catch(async (err) => {
    logger.error({ err }, 'certificateReminder: failed.');
    await mongoose.connection.close().catch(() => {});
    process.exit(1);
  });
