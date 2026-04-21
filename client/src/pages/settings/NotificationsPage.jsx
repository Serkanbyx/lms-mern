/**
 * Settings → Notifications.
 *
 * Two transactional email toggles. Auto-saves through
 * `PreferencesContext`; the server uses these flags when deciding
 * whether to dispatch enrollment / quiz-graded notifications.
 *
 * Marketing emails would live next to these once we ship them — the
 * row layout is designed to scale to N toggles without redesign.
 */

import { Toggle } from '../../components/ui/index.js';
import { usePreferences } from '../../context/usePreferences.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import {
  AutoSaveIndicator,
  SettingsRow,
} from './_settingsShared.jsx';
import { useAutoSaveIndicator } from './useAutoSaveIndicator.js';

export default function SettingsNotificationsPage() {
  useDocumentTitle('Notification settings');
  const { preferences, updatePreference } = usePreferences();
  const { status, markChanged } = useAutoSaveIndicator();

  const notifications = preferences.notifications ?? {};

  const handleChange = (key, value) => {
    updatePreference(`notifications.${key}`, value);
    markChanged();
  };

  return (
    <div className="space-y-10">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-text">Notifications</h2>
          <p className="text-sm text-text-muted mt-0.5">
            Choose which transactional emails reach your inbox. We never send
            marketing without your explicit opt-in.
          </p>
        </div>
        <AutoSaveIndicator status={status} />
      </header>

      <SettingsRow
        label="Enrollment confirmations"
        description="Email me a receipt every time I enroll in a new course."
      >
        <Toggle
          checked={notifications.emailOnEnroll !== false}
          onChange={(next) => handleChange('emailOnEnroll', next)}
          label={notifications.emailOnEnroll !== false ? 'On' : 'Off'}
        />
      </SettingsRow>

      <SettingsRow
        label="Quiz results"
        description="Email me when a quiz attempt finishes grading (pass or fail)."
      >
        <Toggle
          checked={notifications.emailOnQuizGraded !== false}
          onChange={(next) => handleChange('emailOnQuizGraded', next)}
          label={notifications.emailOnQuizGraded !== false ? 'On' : 'Off'}
        />
      </SettingsRow>
    </div>
  );
}
