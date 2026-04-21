/**
 * Client entry point.
 *
 * Provider order (outer → inner):
 *   1. `HelmetProvider`        — async meta tag manager (titles, OG, etc).
 *   2. `BrowserRouter`         — must wrap any consumer of router hooks.
 *   3. `AuthProvider`          — owns the session; Preferences depends on it.
 *   4. `PreferencesProvider`   — applies theme / density DOM side-effects.
 *   5. `MotionProvider`        — global Framer Motion config.
 *   6. `App`                   — route table.
 *   7. `Toaster`               — overlays at the document root so toasts
 *                                survive route changes.
 *
 * `StrictMode` stays on in dev to surface unsafe lifecycle patterns
 * early (it double-invokes effects which is intentional and harmless).
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { Toaster } from 'react-hot-toast';

import App from './App.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { PreferencesProvider } from './context/PreferencesContext.jsx';
import { MotionProvider } from './components/layout/MotionProvider.jsx';
import { ErrorBoundary } from './components/ErrorBoundary.jsx';

import './index.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <HelmetProvider>
      <BrowserRouter>
        <ErrorBoundary>
          <AuthProvider>
            <PreferencesProvider>
              <MotionProvider>
                <App />
                <Toaster
                  position="top-right"
                  gutter={8}
                  toastOptions={{
                    // The `toast` wrapper in `components/ui/toast.js` already
                    // sets per-call styles; this default keeps any third-party
                    // calls visually consistent.
                    style: {
                      background: 'var(--color-bg-subtle)',
                      color: 'var(--color-text)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-lg)',
                      boxShadow: 'var(--shadow-md)',
                    },
                  }}
                />
              </MotionProvider>
            </PreferencesProvider>
          </AuthProvider>
        </ErrorBoundary>
      </BrowserRouter>
    </HelmetProvider>
  </StrictMode>,
);
