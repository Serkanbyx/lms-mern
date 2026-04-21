/**
 * Settings → Playback.
 *
 * Two preferences that the lesson player consumes on mount:
 *   - `autoplayNext` — boolean, controls the post-lesson auto-advance.
 *   - `defaultSpeed` — number, one of the curated playback speeds.
 *
 * Both auto-save via `PreferencesContext`.
 */

import { Toggle } from '../../components/ui/index.js';
import { usePreferences } from '../../context/PreferencesContext.jsx';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import {
  AutoSaveIndicator,
  SegmentedControl,
  SettingsRow,
  useAutoSaveIndicator,
} from './_settingsShared.jsx';

const SPEED_OPTIONS = [
  { value: 0.5, label: '0.5×' },
  { value: 0.75, label: '0.75×' },
  { value: 1, label: '1×' },
  { value: 1.25, label: '1.25×' },
  { value: 1.5, label: '1.5×' },
  { value: 2, label: '2×' },
];

export default function SettingsPlaybackPage() {
  useDocumentTitle('Playback settings');
  const { preferences, updatePreference } = usePreferences();
  const { status, markChanged } = useAutoSaveIndicator();

  const playback = preferences.playback ?? {};
  const currentSpeed = Number(playback.defaultSpeed ?? 1);

  const handleChange = (key, value) => {
    updatePreference(`playback.${key}`, value);
    markChanged();
  };

  return (
    <div className="space-y-10">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-text">Playback</h2>
          <p className="text-sm text-text-muted mt-0.5">
            Defaults applied to every lesson video. You can still override
            per-lesson from the player.
          </p>
        </div>
        <AutoSaveIndicator status={status} />
      </header>

      <SettingsRow
        label="Autoplay next lesson"
        description="When a lesson finishes, automatically queue the next one."
      >
        <Toggle
          checked={Boolean(playback.autoplayNext)}
          onChange={(next) => handleChange('autoplayNext', next)}
          label={playback.autoplayNext ? 'On' : 'Off'}
        />
      </SettingsRow>

      <SettingsRow
        label="Default playback speed"
        description="Applied each time the player mounts."
      >
        <SegmentedControl
          name="defaultSpeed"
          value={currentSpeed}
          onChange={(value) => handleChange('defaultSpeed', Number(value))}
          options={SPEED_OPTIONS}
        />
      </SettingsRow>
    </div>
  );
}
