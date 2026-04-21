/**
 * Settings → Appearance.
 *
 * All four controls auto-save through `PreferencesContext.updatePreference`,
 * which already debounces the network sync. The page just renders the
 * controls and shows a "Saved" indicator after each change.
 *
 * Theme is exposed as a 3-way segmented selector (light / dark / system).
 * Font size and density use the same segmented widget so the visual
 * impact previews instantly when the user clicks — applying the class
 * to `<html>` / `<body>` happens in the context.
 */

import { Toggle } from '../../components/ui/index.js';
import { usePreferences } from '../../context/usePreferences.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import {
  AutoSaveIndicator,
  SegmentedControl,
  SettingsRow,
} from './_settingsShared.jsx';
import { useAutoSaveIndicator } from './useAutoSaveIndicator.js';

const THEME_OPTIONS = [
  { value: 'light', label: 'Light', icon: 'Sun' },
  { value: 'dark', label: 'Dark', icon: 'Moon' },
  { value: 'system', label: 'System', icon: 'Monitor' },
];

const FONT_SIZE_OPTIONS = [
  { value: 'small', label: 'Small' },
  { value: 'medium', label: 'Medium' },
  { value: 'large', label: 'Large' },
];

const DENSITY_OPTIONS = [
  { value: 'compact', label: 'Compact' },
  { value: 'comfortable', label: 'Comfortable' },
  { value: 'spacious', label: 'Spacious' },
];

export default function SettingsAppearancePage() {
  useDocumentTitle('Appearance settings');
  const { preferences, updatePreference } = usePreferences();
  const { status, markChanged } = useAutoSaveIndicator();

  const handleChange = (key, value) => {
    if (preferences[key] === value) return;
    updatePreference(key, value);
    markChanged();
  };

  return (
    <div className="space-y-10">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-text">Appearance</h2>
          <p className="text-sm text-text-muted mt-0.5">
            Customise how Lumen looks and feels. Changes apply instantly.
          </p>
        </div>
        <AutoSaveIndicator status={status} />
      </header>

      <SettingsRow
        label="Theme"
        description="Match your operating system or pick a fixed look."
      >
        <SegmentedControl
          name="theme"
          value={preferences.theme}
          onChange={(value) => handleChange('theme', value)}
          options={THEME_OPTIONS}
        />
      </SettingsRow>

      <SettingsRow
        label="Font size"
        description="Scales body text across the app."
      >
        <SegmentedControl
          name="fontSize"
          value={preferences.fontSize}
          onChange={(value) => handleChange('fontSize', value)}
          options={FONT_SIZE_OPTIONS}
        />
      </SettingsRow>

      <SettingsRow
        label="Content density"
        description="Tighten or relax spacing in lists and cards."
      >
        <SegmentedControl
          name="contentDensity"
          value={preferences.contentDensity}
          onChange={(value) => handleChange('contentDensity', value)}
          options={DENSITY_OPTIONS}
        />
      </SettingsRow>

      <SettingsRow
        label="Animations"
        description="Disable to honour reduced-motion preferences platform-wide."
      >
        <Toggle
          checked={preferences.animations}
          onChange={(next) => handleChange('animations', next)}
          label={preferences.animations ? 'Enabled' : 'Disabled'}
        />
      </SettingsRow>
    </div>
  );
}
