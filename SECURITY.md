# Security Policy

Thanks for taking the time to keep Lumen LMS secure. This document is the
**public-facing** contact for vulnerability reports.

---

## Supported versions

Only the latest `main` branch is actively supported. Tagged releases on
GitHub receive backported security fixes for **30 days** after a newer
tag ships; older tags are unsupported and should be upgraded.

| Version          | Supported          |
| ---------------- | ------------------ |
| `main` (latest)  | ✅ Yes             |
| Last tagged ≤30d | ✅ Backports only  |
| Older tags       | ❌ Upgrade required |

---

## Reporting a vulnerability

**Please do not open a public GitHub issue for security reports.** Public
issues become indexable within minutes and give attackers a head start.

Instead, please contact the maintainer privately through one of the
following channels:

- **Preferred:** GitHub's private vulnerability reporting flow on this
  repository (`Security` tab → `Report a vulnerability`).
- **Email:** include the project name (`Lumen LMS`) in the subject line
  and use the address listed on the maintainer's GitHub profile.

To help us triage quickly, please include:

1. A clear description of the vulnerability and the affected component
   (server route, client page, dependency, etc.).
2. Reproduction steps — a minimal request, payload, or page interaction.
3. The impact you observed (data exposure, privilege escalation, DoS,
   etc.) and any working proof-of-concept.
4. The commit SHA / deployed URL where you reproduced the issue.

---

## Response targets

| Phase             | Target SLA          |
| ----------------- | ------------------- |
| Acknowledge       | Within **48 hours** |
| Initial triage    | Within **5 days**   |
| Fix or mitigation | Within **30 days**  |
| Public disclosure | After patch ships   |

We aim to credit reporters in the release notes (opt-in). If a CVE is
warranted we will coordinate the assignment via GitHub's advisory flow.

---

## Out of scope

The following are explicitly **out of scope** for this project's bounty
expectations (we still appreciate the report — just no SLA):

- Vulnerabilities in third-party services we depend on (MongoDB Atlas,
  Cloudinary, Render, Netlify, SMTP providers). Please report those
  directly to the upstream vendor.
- Findings on a self-hosted deployment that diverges from the
  documented configuration (`README.md` + `docs/RUNBOOK.md`).
- Missing security headers on `*.example.com` placeholder content in
  documentation.
- Rate-limit bypass via clock skew (the limiter is sized for resilience
  not absolute precision).
- Theoretical XSS via the `dangerouslySetInnerHTML`-free codebase
  unless you provide a working PoC.

---

## What happens after disclosure

1. We confirm reproduction and assign a severity (CVSS v3.1).
2. A private patch is prepared on a security branch.
3. The fix is merged to `main`, deployed to the canonical instance, and
   tagged with security release notes.
4. The reporter is credited (with consent) in the GitHub release notes.

For internal procedures — secret rotation, log forensics, customer
notification — see [`docs/RUNBOOK.md`](./docs/RUNBOOK.md).
