/**
 * Settings → Privacy.
 *
 * Two binary preferences that control the public profile surface:
 *   - `showEmail`            — exposes the email field on `/u/:id`.
 *   - `showEnrolledCourses`  — exposes the learner stats counter.
 *
 * Both auto-save through `PreferencesContext`. The server enforces
 * the same flags when serving `GET /api/users/:id`, so flipping a
 * toggle here immediately changes what other users see.
 */

import { Toggle } from '../../components/ui/index.js';
import { usePreferences } from '../../context/usePreferences.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import {
  AutoSaveIndicator,
  SettingsRow,
} from './_settingsShared.jsx';
import { useAutoSaveIndicator } from './useAutoSaveIndicator.js';

export default function SettingsPrivacyPage() {
  useDocumentTitle('Privacy settings');
  const { preferences, updatePreference } = usePreferences();
  const { status, markChanged } = useAutoSaveIndicator();

  const handleChange = (key, value) => {
    updatePreference(`privacy.${key}`, value);
    markChanged();
  };

  const privacy = preferences.privacy ?? {};

  return (
    <div className="space-y-10">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-text">Privacy</h2>
          <p className="text-sm text-text-muted mt-0.5">
            Choose what other learners can see on your public profile.
          </p>
        </div>
        <AutoSaveIndicator status={status} />
      </header>

      <SettingsRow
        label="Show email on my public profile"
        description="When off, your email is hidden from `/u/your-id` even when someone is signed in."
      >
        <Toggle
          checked={Boolean(privacy.showEmail)}
          onChange={(next) => handleChange('showEmail', next)}
          label={privacy.showEmail ? 'Visible' : 'Hidden'}
        />
      </SettingsRow>

      <SettingsRow
        label="Show enrolled course count"
        description="Display how many courses you're learning. Individual course names are never shared."
      >
        <Toggle
          checked={privacy.showEnrolledCourses !== false}
          onChange={(next) => handleChange('showEnrolledCourses', next)}
          label={
            privacy.showEnrolledCourses !== false ? 'Visible' : 'Hidden'
          }
        />
      </SettingsRow>
    </div>
  );
}
