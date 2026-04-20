/**
 * MongoDB connection bootstrap.
 *
 * Connects via Mongoose with strict query mode enabled (rejects fields not
 * declared on the schema in queries) and registers connection-level event
 * listeners for observability. A failure to connect at startup is fatal:
 * we exit with code 1 so the process manager (Render, PM2, Docker) restarts
 * the container instead of serving traffic against a dead database.
 */

import mongoose from 'mongoose';

import { env } from './env.js';

mongoose.set('strictQuery', true);

const redactUri = (uri) => uri.replace(/\/\/([^:]+):([^@]+)@/, '//$1:***@');

export async function connectDB() {
  try {
    const conn = await mongoose.connect(env.MONGO_URI, {
      serverSelectionTimeoutMS: 10_000,
      autoIndex: !env.isProd,
    });

    // eslint-disable-next-line no-console
    console.log(`[db] MongoDB connected: ${conn.connection.host}/${conn.connection.name}`);

    mongoose.connection.on('disconnected', () => {
      // eslint-disable-next-line no-console
      console.warn('[db] MongoDB disconnected.');
    });

    mongoose.connection.on('reconnected', () => {
      // eslint-disable-next-line no-console
      console.log('[db] MongoDB reconnected.');
    });

    mongoose.connection.on('error', (err) => {
      // eslint-disable-next-line no-console
      console.error('[db] MongoDB error:', err.message);
    });

    return conn;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(
      `[db] Failed to connect to MongoDB at ${redactUri(env.MONGO_URI)}: ${err.message}`,
    );
    process.exit(1);
  }
}

export default connectDB;
