/**
 * `useQuery` — small, dependency-free wrapper for read (GET-style) calls.
 *
 * Goals (kept intentionally narrow — we don't pull in React Query):
 *  - One stable shape: `{ data, error, loading, refetch }` so every page
 *    renders error / empty / loaded states the same way.
 *  - Race-safe: a stale response from a previous run can never overwrite
 *    a newer one (we track an `attemptId` per call).
 *  - Opt-in single retry on transient failures (network blip, 5xx) with
 *    a tiny backoff. Cancellations and 4xx are never retried — those are
 *    deterministic responses the server is asking us to respect.
 *  - Manual `refetch()` for "Try again" buttons and post-mutation reloads.
 *
 * The `fetcher` should be a pure async function. Its identity is captured
 * inside the hook on each render — pass a stable reference (or
 * `useCallback`) only if you depend on `key` to re-trigger fetches.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

const DEFAULT_RETRY_DELAY_MS = 500;

const isTransientError = (error) => {
  if (!error) return false;
  if (error.code === 'CANCELLED') return false;
  if (error.isNetwork) return true;
  const status = Number(error.status);
  return status === 0 || status === 408 || status >= 500;
};

const sleep = (ms) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

export const useQuery = (fetcher, deps = [], options = {}) => {
  const {
    enabled = true,
    retry = false,
    retryDelay = DEFAULT_RETRY_DELAY_MS,
    initialData = null,
    onSuccess,
    onError,
  } = options;

  const [data, setData] = useState(initialData);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(Boolean(enabled));

  const attemptIdRef = useRef(0);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  // `onSuccess` / `onError` are usually defined inline by callers; capture
  // the latest reference so we never call into a stale closure.
  const onSuccessRef = useRef(onSuccess);
  const onErrorRef = useRef(onError);
  onSuccessRef.current = onSuccess;
  onErrorRef.current = onError;

  const run = useCallback(async () => {
    const myAttempt = ++attemptIdRef.current;
    setLoading(true);
    setError(null);

    try {
      let result = await fetcherRef.current();

      if (myAttempt !== attemptIdRef.current) return;
      setData(result);
      onSuccessRef.current?.(result);
    } catch (err) {
      if (retry && isTransientError(err)) {
        try {
          await sleep(retryDelay);
          if (myAttempt !== attemptIdRef.current) return;
          const result = await fetcherRef.current();
          if (myAttempt !== attemptIdRef.current) return;
          setData(result);
          onSuccessRef.current?.(result);
          return;
        } catch (retryErr) {
          if (myAttempt !== attemptIdRef.current) return;
          setError(retryErr);
          onErrorRef.current?.(retryErr);
          return;
        }
      }

      if (myAttempt !== attemptIdRef.current) return;
      setError(err);
      onErrorRef.current?.(err);
    } finally {
      if (myAttempt === attemptIdRef.current) setLoading(false);
    }
  }, [retry, retryDelay]);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return undefined;
    }
    run();
    // Bump attempt counter on unmount so any in-flight setState is dropped.
    return () => {
      attemptIdRef.current += 1;
    };
    // `deps` is the caller-provided dependency array — they own when to refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ...deps]);

  return { data, error, loading, refetch: run, setData };
};

export default useQuery;
