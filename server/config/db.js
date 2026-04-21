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

import { logger } from '../utils/logger.js';
import { env } from './env.js';

mongoose.set('strictQuery', true);

const redactUri = (uri) => uri.replace(/\/\/([^:]+):([^@]+)@/, '//$1:***@');

export async function connectDB() {
  try {
    const conn = await mongoose.connect(env.MONGO_URI, {
      serverSelectionTimeoutMS: 10_000,
      autoIndex: !env.isProd,
    });

    logger.info(
      { host: conn.connection.host, db: conn.connection.name },
      '[db] MongoDB connected.',
    );

    mongoose.connection.on('disconnected', () => {
      logger.warn('[db] MongoDB disconnected.');
    });

    mongoose.connection.on('reconnected', () => {
      logger.info('[db] MongoDB reconnected.');
    });

    mongoose.connection.on('error', (err) => {
      logger.error({ err: err.message }, '[db] MongoDB error.');
    });

    return conn;
  } catch (err) {
    logger.fatal(
      { uri: redactUri(env.MONGO_URI), err: err.message },
      '[db] Failed to connect to MongoDB.',
    );
    process.exit(1);
  }
}

export default connectDB;
