/**
 * Idempotent admin bootstrap.
 *
 * Run with: `npm run seed:admin`
 *
 * Behavior:
 *  - Connects to Mongo via the shared `connectDB` helper.
 *  - Looks up a user by `ADMIN_EMAIL`.
 *  - If absent, creates one with role `admin` using `ADMIN_PASSWORD` and
 *    `ADMIN_NAME` from env. The password is hashed by the model's pre-save
 *    hook — never stored plain text.
 *  - If present, force-promotes them to `admin` and re-activates the
 *    account, but does NOT touch the password (avoids surprise rotations
 *    on every deploy).
 *
 * Designed to be safe to run repeatedly in CI/CD as an "ensure admin
 * exists" guard.
 */

import mongoose from 'mongoose';

import { connectDB } from '../config/db.js';
import { env } from '../config/env.js';
import { User } from '../models/User.model.js';

const log = (...args) => {
  // eslint-disable-next-line no-console
  console.log('[seed:admin]', ...args);
};
const err = (...args) => {
  // eslint-disable-next-line no-console
  console.error('[seed:admin]', ...args);
};

const exitWith = async (code, message) => {
  if (message) (code === 0 ? log : err)(message);
  await mongoose.connection.close().catch(() => {});
  process.exit(code);
};

const run = async () => {
  if (!env.ADMIN_EMAIL || !env.ADMIN_PASSWORD) {
    return exitWith(
      1,
      'ADMIN_EMAIL and ADMIN_PASSWORD must be set in your .env to seed an admin.',
    );
  }

  await connectDB();

  const email = env.ADMIN_EMAIL.toLowerCase().trim();
  const existing = await User.findOne({ email });

  if (existing) {
    let dirty = false;
    if (existing.role !== 'admin') {
      existing.role = 'admin';
      dirty = true;
    }
    if (!existing.isActive) {
      existing.isActive = true;
      dirty = true;
    }
    if (dirty) {
      await existing.save();
      return exitWith(0, `Promoted existing user "${email}" to admin.`);
    }
    return exitWith(0, `Admin user "${email}" already exists — nothing to do.`);
  }

  await User.create({
    name: env.ADMIN_NAME,
    email,
    password: env.ADMIN_PASSWORD,
    role: 'admin',
    isActive: true,
  });

  return exitWith(0, `Created admin user "${email}".`);
};

run().catch(async (e) => {
  err('Seeder failed:', e?.message || e);
  await exitWith(1);
});
