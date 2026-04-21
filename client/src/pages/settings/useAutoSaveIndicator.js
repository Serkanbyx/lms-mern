/**
 * `useAutoSaveIndicator` — drives the "Saving… → Saved" badge used by
 * the auto-saving settings pages (Appearance, Privacy, Notifications,
 * Playback).
 *
 * Lives in its own module (not the shared components file) so React Fast
 * Refresh can keep `_settingsShared.jsx` as a components-only module,
 * preserving component state across hot reloads.
 *
 * Timing matches the ~600 ms debounce window of `PreferencesContext`:
 *  - `markChanged()` flips status to `'saving'`.
 *  - After `SAVING_DELAY_MS` it transitions to `'saved'`.
 *  - After `SAVED_VISIBLE_MS` it returns to `'idle'`.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

const SAVING_DELAY_MS = 600;
const SAVED_VISIBLE_MS = 2000;

export const useAutoSaveIndicator = () => {
  const [status, setStatus] = useState('idle');
  const savingTimerRef = useRef(null);
  const savedTimerRef = useRef(null);

  const clearTimers = () => {
    if (savingTimerRef.current) clearTimeout(savingTimerRef.current);
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    savingTimerRef.current = null;
    savedTimerRef.current = null;
  };

  const markChanged = useCallback(() => {
    clearTimers();
    setStatus('saving');
    savingTimerRef.current = setTimeout(() => {
      setStatus('saved');
      savedTimerRef.current = setTimeout(() => {
        setStatus('idle');
      }, SAVED_VISIBLE_MS);
    }, SAVING_DELAY_MS);
  }, []);

  useEffect(() => clearTimers, []);

  return { status, markChanged };
};
