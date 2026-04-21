/**
 * `ErrorBoundary` — last-line-of-defence for unexpected render failures.
 *
 * Two intended call sites:
 *   1. App-wide (mounted in `main.jsx` around `<App />`): catches the
 *      catastrophic case where the chrome itself throws so the user
 *      never stares at a blank white screen.
 *   2. Per-route (wrapped around each lazy element in `App.jsx`): keeps
 *      a single page crash from blowing up the whole shell — Navbar,
 *      Footer, and sibling routes stay reachable.
 *
 * Why a class component? The error boundary lifecycle (`getDerivedStateFromError`,
 * `componentDidCatch`) is only available on classes; React has no Hooks
 * equivalent yet (as of React 19). Everything inside the fallback UI is
 * still plain JSX the rest of the app understands.
 *
 * Crash recovery hint:
 *   - We count consecutive crashes that happen within a 60-second window
 *     in `sessionStorage`. After three the fallback nudges the user to
 *     log out and back in (a fresh token / state often clears the issue).
 *   - The counter resets the moment the boundary mounts cleanly again.
 *
 * Production logging:
 *   - In dev we dump the error + stack to `console.error` so developers
 *     see the trace in the terminal-style overlay.
 *   - In production we leave a single `// TODO` hook for Sentry / LogRocket
 *     wiring; we never log raw error objects there because they can leak
 *     auth headers / request bodies that axios serialises into them.
 */

import { Component } from 'react';
import { Link } from 'react-router-dom';

import { Button } from './ui/Button.jsx';
import { Icon } from './ui/Icon.jsx';
import { ROUTES, STORAGE_KEYS } from '../utils/constants.js';

const CRASH_COUNTER_KEY = 'lms.crashCounter';
const CRASH_WINDOW_MS = 60_000;
const CRASH_RECOVERY_THRESHOLD = 3;

const readCrashCounter = () => {
  if (typeof window === 'undefined') return { count: 0, firstAt: 0 };
  try {
    const raw = window.sessionStorage.getItem(CRASH_COUNTER_KEY);
    if (!raw) return { count: 0, firstAt: 0 };
    const parsed = JSON.parse(raw);
    return {
      count: Number(parsed.count) || 0,
      firstAt: Number(parsed.firstAt) || 0,
    };
  } catch {
    return { count: 0, firstAt: 0 };
  }
};

const writeCrashCounter = (next) => {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(CRASH_COUNTER_KEY, JSON.stringify(next));
  } catch {
    // sessionStorage may be disabled — recovery hint just won't appear.
  }
};

const recordCrash = () => {
  const now = Date.now();
  const previous = readCrashCounter();
  const withinWindow = now - previous.firstAt < CRASH_WINDOW_MS;
  const next = withinWindow
    ? { count: previous.count + 1, firstAt: previous.firstAt || now }
    : { count: 1, firstAt: now };
  writeCrashCounter(next);
  return next.count;
};

const clearCrashCounter = () => {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(CRASH_COUNTER_KEY);
  } catch {
    // Ignore — counter is best-effort only.
  }
};

const handleHardReset = () => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(STORAGE_KEYS.token);
    window.sessionStorage.removeItem(CRASH_COUNTER_KEY);
  } catch {
    // Storage may be locked down — fall through to the redirect.
  }
  window.location.assign(ROUTES.login);
};

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      info: null,
      crashCount: 0,
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    const crashCount = recordCrash();
    this.setState({ info, crashCount });

    if (import.meta.env.DEV) {
      console.error('[ErrorBoundary]', error, info?.componentStack);
    }
    // TODO: forward `error` + `info.componentStack` to Sentry / LogRocket
    // in production. Do NOT log raw axios errors — they serialise
    // request headers and can leak the bearer token.
  }

  handleReload = () => {
    clearCrashCounter();
    if (typeof window !== 'undefined') window.location.reload();
  };

  handleReset = () => {
    clearCrashCounter();
    this.setState({ hasError: false, error: null, info: null, crashCount: 0 });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    const { error, info, crashCount } = this.state;
    const showRecoveryHint = crashCount >= CRASH_RECOVERY_THRESHOLD;
    const isInline = this.props.variant === 'inline';

    return (
      <div
        role="alert"
        className={
          isInline
            ? 'mx-auto my-10 max-w-2xl rounded-2xl border border-border bg-bg-subtle p-8 text-center shadow-sm'
            : 'min-h-screen flex items-center justify-center bg-bg px-6 text-text'
        }
      >
        <div className="max-w-lg w-full space-y-5 text-center">
          <div
            aria-hidden="true"
            className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-full bg-danger/10 text-danger"
          >
            <Icon name="AlertTriangle" size={28} />
          </div>

          <div className="space-y-2">
            <h1 className="text-xl font-semibold text-text">
              Something went wrong
            </h1>
            <p className="text-sm text-text-muted">
              We&apos;ve logged the error. Try refreshing the page — if it keeps
              happening, head back to the home page and try again.
            </p>
          </div>

          {showRecoveryHint && (
            <div className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-left text-sm text-warning">
              <p className="font-medium">It looks like something is broken.</p>
              <p className="mt-1 text-warning/90">
                Try logging out and back in — that often clears the problem.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={handleHardReset}
                className="mt-3"
                leftIcon={<Icon name="LogOut" size={14} />}
              >
                Log out and reset
              </Button>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button
              onClick={this.handleReload}
              leftIcon={<Icon name="RotateCw" size={16} />}
            >
              Reload
            </Button>
            <Button
              as={Link}
              to={ROUTES.home}
              variant="outline"
              onClick={this.handleReset}
              leftIcon={<Icon name="Home" size={16} />}
            >
              Back to home
            </Button>
          </div>

          {import.meta.env.DEV && error && (
            <details className="mt-4 rounded-md border border-border bg-bg-muted p-3 text-left text-xs text-text-muted">
              <summary className="cursor-pointer font-medium text-text">
                Error details (dev only)
              </summary>
              <pre className="mt-2 overflow-auto whitespace-pre-wrap wrap-break-word text-text">
                {error.message}
              </pre>
              {info?.componentStack && (
                <pre className="mt-2 overflow-auto whitespace-pre-wrap wrap-break-word text-text-muted">
                  {info.componentStack}
                </pre>
              )}
            </details>
          )}
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
