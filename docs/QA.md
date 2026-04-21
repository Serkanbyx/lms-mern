# QA — Browser Support & Mobile Testing Matrix

> The authoritative answer to "is this device officially supported?" and
> "what do we sweep through before each deploy?".

---

## Table of contents

1. [Browser support policy](#browser-support-policy)
2. [Mobile QA matrix](#mobile-qa-matrix)
3. [Pre-release smoke checklist](#pre-release-smoke-checklist)
4. [Test tooling](#test-tooling)

---

## Browser support policy

The supported set is encoded in `client/package.json` under the
`browserslist` key, which Vite reads to target its bundle output. Any
change here MUST be made in both places to keep the docs honest.

| Browser            | Versions                         | Tier                |
| ------------------ | -------------------------------- | ------------------- |
| Chrome (desktop)   | latest 2                         | Tier 1 — full QA    |
| Firefox (desktop)  | latest 2                         | Tier 1 — full QA    |
| Safari (desktop)   | latest 2                         | Tier 1 — full QA    |
| Edge (desktop)     | latest 2                         | Tier 1 — full QA    |
| Safari (iOS)       | iOS 15 and newer                 | Tier 1 — full QA    |
| Chrome (Android)   | latest stable                    | Tier 1 — full QA    |
| Samsung Internet   | latest stable                    | Tier 2 — smoke only |

Explicitly **not supported**:

- Internet Explorer (any version) — disabled in `browserslist` and the
  CSP / modern syntax in the bundle would break it anyway.
- Android Browser ≤ 4.x (legacy stock).
- Opera Mini in extreme-saving mode (no JS engine guarantees).

When a user reports an issue on an unsupported browser the response
template is "we don't ship to that browser; here are the supported
versions" — see `docs/RUNBOOK.md`.

---

## Mobile QA matrix

| Tier   | Device                       | Browser               | Cadence              |
| ------ | ---------------------------- | --------------------- | -------------------- |
| Tier 1 | iPhone 13 / 14               | Safari iOS latest     | Every release        |
| Tier 1 | Pixel 6 / 7                  | Chrome Android latest | Every release        |
| Tier 2 | iPad (10th gen)              | Safari iOS            | Weekly smoke         |
| Tier 2 | Galaxy S21                   | Samsung Internet      | Weekly smoke         |
| Tier 3 | iPhone SE (small viewport)   | Safari iOS            | Release smoke        |
| Tier 3 | Foldable (Galaxy Z Fold)     | Chrome Android        | Major release only   |

Daily development uses Chrome DevTools device emulation — fast enough
for layout checks but **never** the final word on iOS Safari behaviour
(scroll quirks, viewport units, safe-area insets all differ from
emulated Chrome). BrowserStack / Sauce Labs free trials cover the
real-device sweep before major releases.

---

## Pre-release smoke checklist

Run through these on at least one Tier 1 mobile device and one Tier 1
desktop browser before promoting a build to production:

### Auth
- [ ] Sign up with a fresh email; verification email arrives; link
      lands on `/verify-email/:token` and grants access.
- [ ] Forgot password flow → reset email → new password works.
- [ ] Login lockout: 10 wrong passwords locks the account; lock
      message is generic ("invalid email or password").

### Catalog
- [ ] Catalog loads, filters apply without page reload, empty state
      shows the reset CTA.
- [ ] Course detail renders curriculum, instructor card, enroll CTA.

### Learning
- [ ] Enroll a free course → "Continue learning" appears on dashboard.
- [ ] Lesson player streams, progress bar updates, completion ticks.
- [ ] Quiz: intro → taking → submit → results works end-to-end.
- [ ] Quiz tab-switch: minimise the browser during a `taking` phase,
      a toast warns about the switch and `tabSwitches` increments on
      the persisted attempt.
- [ ] Certificate downloads as a non-corrupt PDF (when feature flag is
      ON).

### Instructor
- [ ] Create a course → submit for review → admin approves → student
      sees it in the catalog.
- [ ] Quiz builder: add 2 questions, save, the new quiz appears in the
      lesson side-nav with the correct count.

### Settings
- [ ] Theme toggle persists across reload (cookie-less LocalStorage).
- [ ] Notification toggles round-trip through the server.

### Operational
- [ ] `/api/health` returns `200 { status: 'ok' }`.
- [ ] Send a `SIGTERM` to the local dev server; logs show
      "Shutdown signal received" and exit within 10 seconds.
- [ ] Run each cron script manually (`npm run cron:cleanup-tokens`,
      etc.) — they finish with exit code 0 and emit a summary log.

---

## Test tooling

| Tool                           | Use                                              |
| ------------------------------ | ------------------------------------------------ |
| Chrome DevTools Device Mode    | Daily layout / responsive checks                 |
| Lighthouse (Chrome DevTools)   | Perf + a11y regression spot-check                |
| `react-helmet-async` checker   | Verify SEO + OG meta on the catalog & detail     |
| `@axe-core/playwright`         | Automated a11y rules (planned)                   |
| BrowserStack / Sauce Labs      | Real-device QA before major releases             |

> Automated end-to-end tests are explicitly out of scope for v1 — they
> land in a follow-up release. Until then this checklist plus the
> per-PR review notes are the gate.
