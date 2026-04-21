/**
 * Renders the public welcome page served at the API root (`GET /`).
 *
 * The page is a single self-contained HTML document (no external CSS, fonts,
 * or images) that doubles as a sanity check ("the API is up") and a launchpad
 * to the live Swagger reference and health probe.
 *
 * Visual theme: an academic / study-desk atmosphere fitting an LMS — deep
 * indigo "midnight study" backdrop, parchment-warm card, gold-amber accents
 * borrowed from graduation regalia, and a CSS-only open-book glyph as the
 * hero motif. All decoration is drawn with gradients, pseudo-elements, and
 * box-shadows so the page renders identically with no network hops.
 *
 * The footer signature ("Created by ...") is intentionally fixed across every
 * project that adopts the gitsign-backend standard; only the header / theme
 * changes per project.
 */

export const renderWelcomePage = ({ version, env }) => `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="noindex" />
  <title>Lumen LMS API · v${version}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; }

    :root {
      --ink: #0b1020;
      --ink-2: #141a36;
      --paper: #faf6ec;
      --paper-edge: #e8dfc4;
      --accent: #f5b945;
      --accent-strong: #c98910;
      --accent-soft: rgba(245, 185, 69, 0.18);
      --indigo: #4338ca;
      --indigo-soft: #c7d2fe;
      --rule: rgba(11, 16, 32, 0.12);
    }

    html, body { height: 100%; margin: 0; }

    body {
      min-height: 100%;
      font-family: ui-serif, Georgia, "Iowan Old Style", "Apple Garamond", "Times New Roman", serif;
      color: var(--ink);
      background:
        radial-gradient(1200px 600px at 80% -10%, rgba(245, 185, 69, 0.18), transparent 60%),
        radial-gradient(900px 500px at -10% 110%, rgba(67, 56, 202, 0.35), transparent 55%),
        linear-gradient(180deg, var(--ink) 0%, var(--ink-2) 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 32px 20px;
      position: relative;
      overflow: hidden;
    }

    body::before,
    body::after {
      content: "";
      position: absolute;
      inset: 0;
      pointer-events: none;
    }

    body::before {
      background-image:
        repeating-linear-gradient(0deg, rgba(255, 255, 255, 0.025) 0 1px, transparent 1px 28px),
        repeating-linear-gradient(90deg, rgba(255, 255, 255, 0.025) 0 1px, transparent 1px 28px);
      mix-blend-mode: overlay;
      opacity: 0.6;
    }

    body::after {
      background:
        radial-gradient(2px 2px at 12% 22%, rgba(255, 255, 255, 0.65), transparent 60%),
        radial-gradient(1.5px 1.5px at 78% 18%, rgba(255, 255, 255, 0.55), transparent 60%),
        radial-gradient(2px 2px at 32% 86%, rgba(255, 255, 255, 0.5), transparent 60%),
        radial-gradient(1.5px 1.5px at 88% 72%, rgba(255, 255, 255, 0.45), transparent 60%),
        radial-gradient(1.5px 1.5px at 60% 36%, rgba(255, 255, 255, 0.35), transparent 60%);
    }

    .container {
      position: relative;
      width: min(640px, 100%);
      background: var(--paper);
      border-radius: 22px;
      padding: 48px 44px 32px;
      text-align: center;
      box-shadow:
        0 1px 0 rgba(255, 255, 255, 0.6) inset,
        0 0 0 1px var(--paper-edge),
        0 30px 60px -20px rgba(0, 0, 0, 0.55),
        0 18px 40px -25px rgba(67, 56, 202, 0.45);
      isolation: isolate;
    }

    .container::before {
      content: "";
      position: absolute;
      inset: 14px;
      border-radius: 14px;
      border: 1px dashed rgba(11, 16, 32, 0.18);
      pointer-events: none;
    }

    .crest {
      position: relative;
      width: 88px;
      height: 88px;
      margin: 0 auto 22px;
      border-radius: 50%;
      background: radial-gradient(circle at 30% 30%, #ffe7a1 0%, var(--accent) 55%, var(--accent-strong) 100%);
      box-shadow:
        0 0 0 6px var(--paper),
        0 0 0 7px var(--accent-soft),
        0 14px 30px -10px rgba(201, 137, 16, 0.55);
      display: grid;
      place-items: center;
    }

    .crest::before {
      content: "";
      width: 54px;
      height: 38px;
      background: var(--ink);
      clip-path: polygon(50% 0, 100% 38%, 50% 76%, 0 38%);
    }

    .crest::after {
      content: "";
      position: absolute;
      width: 40px;
      height: 18px;
      background: var(--ink);
      border-radius: 0 0 22px 22px;
      top: 46px;
    }

    h1 {
      font-family: ui-serif, "Iowan Old Style", "Apple Garamond", Georgia, serif;
      font-size: clamp(1.9rem, 4vw + 1rem, 2.6rem);
      letter-spacing: 0.5px;
      margin: 0 0 6px;
      color: var(--ink);
      text-shadow: 0 1px 0 rgba(255, 255, 255, 0.6);
    }

    h1 .accent {
      background: linear-gradient(120deg, var(--accent-strong), var(--accent) 60%, #fde08a);
      -webkit-background-clip: text;
      background-clip: text;
      color: transparent;
    }

    .tagline {
      margin: 0 auto 14px;
      max-width: 460px;
      font-size: 0.98rem;
      line-height: 1.55;
      color: rgba(11, 16, 32, 0.72);
      font-style: italic;
    }

    .version {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      margin: 0 0 26px;
      padding: 4px 12px;
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-size: 0.78rem;
      letter-spacing: 0.6px;
      color: var(--ink);
      background: var(--accent-soft);
      border: 1px solid rgba(201, 137, 16, 0.35);
      border-radius: 999px;
      text-transform: uppercase;
    }

    .version::before {
      content: "";
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #16a34a;
      box-shadow: 0 0 0 3px rgba(22, 163, 74, 0.18);
    }

    .links {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 12px;
      margin-bottom: 28px;
    }

    .links a {
      --bg: var(--ink);
      --fg: var(--paper);
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 12px 22px;
      font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
      font-size: 0.92rem;
      font-weight: 600;
      letter-spacing: 0.2px;
      text-decoration: none;
      color: var(--fg);
      background: var(--bg);
      border-radius: 10px;
      border: 1px solid transparent;
      transition: transform 160ms ease, box-shadow 160ms ease, background 160ms ease, color 160ms ease;
      box-shadow: 0 6px 14px -8px rgba(11, 16, 32, 0.55);
    }

    .links a.btn-primary {
      background: linear-gradient(135deg, var(--indigo) 0%, #6366f1 100%);
      color: #fff;
      box-shadow: 0 10px 24px -10px rgba(67, 56, 202, 0.65);
    }

    .links a.btn-secondary {
      background: var(--paper);
      color: var(--ink);
      border-color: rgba(11, 16, 32, 0.18);
      box-shadow: 0 4px 10px -6px rgba(11, 16, 32, 0.35);
    }

    .links a:hover,
    .links a:focus-visible {
      transform: translateY(-1px);
      box-shadow: 0 14px 28px -12px rgba(11, 16, 32, 0.55);
      outline: none;
    }

    .links a.btn-primary:hover,
    .links a.btn-primary:focus-visible {
      box-shadow: 0 16px 30px -10px rgba(67, 56, 202, 0.75);
    }

    .links a.btn-secondary:hover,
    .links a.btn-secondary:focus-visible {
      border-color: var(--accent-strong);
      color: var(--accent-strong);
    }

    .meta {
      display: flex;
      justify-content: center;
      gap: 18px;
      flex-wrap: wrap;
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-size: 0.74rem;
      color: rgba(11, 16, 32, 0.55);
      margin: 0 0 22px;
      padding-top: 18px;
      border-top: 1px solid var(--rule);
    }

    .meta span strong {
      color: var(--ink);
      font-weight: 700;
    }

    .sign {
      font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
      font-size: 0.82rem;
      color: rgba(11, 16, 32, 0.65);
    }

    .sign a {
      color: var(--indigo);
      text-decoration: none;
      font-weight: 600;
      border-bottom: 1px solid transparent;
      transition: color 160ms ease, border-color 160ms ease;
    }

    .sign a:hover,
    .sign a:focus-visible {
      color: var(--accent-strong);
      border-color: var(--accent);
      outline: none;
    }

    @media (max-width: 480px) {
      .container { padding: 36px 24px 24px; }
      .links a { width: 100%; justify-content: center; }
    }

    @media (prefers-reduced-motion: reduce) {
      .links a { transition: none; }
    }
  </style>
</head>
<body>
  <main class="container" role="main">
    <div class="crest" aria-hidden="true"></div>

    <h1>Lumen <span class="accent">LMS</span> API</h1>
    <p class="tagline">A learning platform for courses, lessons, quizzes, progress tracking, and graduation certificates.</p>

    <span class="version" aria-label="API version">v${version} · ${env}</span>

    <nav class="links" aria-label="API navigation">
      <a class="btn-primary" href="/api-docs">API Documentation</a>
      <a class="btn-secondary" href="/api/health">Health Check</a>
    </nav>

    <div class="meta" aria-hidden="true">
      <span>Base · <strong>/api</strong></span>
      <span>Auth · <strong>JWT Bearer</strong></span>
      <span>OpenAPI · <strong>3.0</strong></span>
    </div>

    <footer class="sign">
      Created by
      <a href="https://serkanbayraktar.com/" target="_blank" rel="noopener noreferrer">Serkanby</a>
      |
      <a href="https://github.com/Serkanbyx" target="_blank" rel="noopener noreferrer">Github</a>
    </footer>
  </main>
</body>
</html>`;

export default renderWelcomePage;
