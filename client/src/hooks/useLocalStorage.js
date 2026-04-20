/**
 * `useLocalStorage(key, initialValue)`
 *
 * `useState`-shaped hook that mirrors its value to `localStorage` and
 * stays in sync across browser tabs via the `storage` event.
 *
 * Reads happen lazily on mount (so SSR / private mode never crashes the
 * render path) and writes are JSON-serialised. The setter accepts the
 * usual `value | (prev) => next` shape.
 *
 * If `localStorage` is unavailable (private mode, disabled storage) the
 * hook silently degrades to plain in-memory state — UX still works.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

const isBrowser = typeof window !== 'undefined';

const readStoredValue = (key, fallback) => {
  if (!isBrowser) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
};

export const useLocalStorage = (key, initialValue) => {
  const [value, setValue] = useState(() => readStoredValue(key, initialValue));
  const keyRef = useRef(key);
  keyRef.current = key;

  const setStoredValue = useCallback(
    (next) => {
      setValue((prev) => {
        const resolved = typeof next === 'function' ? next(prev) : next;
        if (isBrowser) {
          try {
            if (resolved === undefined) {
              window.localStorage.removeItem(keyRef.current);
            } else {
              window.localStorage.setItem(keyRef.current, JSON.stringify(resolved));
            }
          } catch {
            // Private mode or quota exceeded — keep in-memory state only.
          }
        }
        return resolved;
      });
    },
    [],
  );

  useEffect(() => {
    if (!isBrowser) return undefined;
    const onStorage = (event) => {
      if (event.key !== keyRef.current || event.storageArea !== window.localStorage) {
        return;
      }
      setValue(readStoredValue(keyRef.current, initialValue));
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [initialValue]);

  return [value, setStoredValue];
};

export default useLocalStorage;
