/**
 * Barrel for the Progressive Web App layer (STEP 44).
 *
 * Both components are mounted exactly once, from `MainLayout`, so the
 * install banner / update toast survive every route transition and
 * don't double-fire when nested layouts mount.
 */

export { InstallPrompt } from './InstallPrompt.jsx';
export { PWAUpdatePrompt } from './PWAUpdatePrompt.jsx';
