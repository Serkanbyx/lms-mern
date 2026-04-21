/**
 * Redis client (STEP 48).
 *
 * Single shared `ioredis` connection used by:
 *   - the rate-limit store (`middleware/rateLimit.middleware.js`) so multiple
 *     server instances share a single bucket per limiter / key,
 *   - any future cache / queue / pub-sub feature that needs Redis.
 *
 * REDIS_URL is OPTIONAL by design:
 *   - When unset (typical local dev), `redis` is `null` and every consumer
 *     gracefully falls back to in-memory behaviour.
 *   - When set, every limiter / cache call goes through Redis, which is the
 *     ONLY way to scale the API horizontally without per-instance counters
 *     diverging.
 *
 * SECURITY NOTES:
 *  - `maxRetriesPerRequest: 3` keeps a flapping Redis from queuing thousands
 *    of pending commands inside Node and exhausting the heap.
 *  - `enableReadyCheck: true` waits for `INFO` to confirm the server is
 *    ready before issuing real commands; otherwise commands queued during
 *    startup can race a not-yet-loaded RDB snapshot.
 *  - Connection-level errors are LOGGED (never thrown) so a temporary
 *    Redis outage does not crash the API process — limiters degrade to
 *    "fail open" via `rate-limit-redis`'s built-in `sendCommand` recovery.
 *  - `lazyConnect: false` (default) so misconfiguration surfaces at boot
 *    rather than the first request that needs the limiter.
 */

import Redis from 'ioredis';

import { logger } from '../utils/logger.js';
import { env } from './env.js';

/**
 * Build the shared Redis client. Returns `null` when no `REDIS_URL` is
 * configured so consumers can fall back to in-memory implementations.
 */
const createRedisClient = () => {
  if (!env.REDIS_URL) return null;

  const client = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    // Reconnect with capped exponential back-off so a transient outage
    // recovers quickly without hammering the upstream during a longer one.
    retryStrategy: (times) => Math.min(times * 200, 2000),
  });

  client.on('connect', () => {
    logger.info('[redis] Connecting…');
  });

  client.on('ready', () => {
    logger.info('[redis] Ready.');
  });

  client.on('error', (err) => {
    logger.error({ err: err.message }, '[redis] Connection error.');
  });

  client.on('end', () => {
    logger.warn('[redis] Connection closed.');
  });

  return client;
};

export const redis = createRedisClient();

export const isRedisConfigured = redis !== null;

export default redis;
