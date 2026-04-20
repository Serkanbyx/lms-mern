/**
 * Generates the binary favicon / OG / PWA icon set from the SVG source mark.
 *
 * Why this lives outside the runtime bundle:
 *  - PNG/ICO are heavyweight build-time artifacts. Keeping the generator out
 *    of `dependencies` means production installs stay slim.
 *  - The SVG source (`public/favicon.svg`) is the single source of truth;
 *    re-run this script whenever the brand mark changes.
 *
 * Usage (one-time, from `client/`):
 *   npm install --save-dev sharp png-to-ico
 *   node scripts/generate-favicons.mjs
 *
 * Outputs into `client/public/`:
 *   favicon.ico (multi-res 16/32/48), favicon-16x16.png, favicon-32x32.png,
 *   apple-touch-icon.png (180), android-chrome-192x192.png,
 *   android-chrome-512x512.png, og-default.png (1200x630).
 */
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = resolve(__dirname, '..', 'public');
const sourceSvg = resolve(publicDir, 'favicon.svg');

let sharp;
let pngToIco;
try {
  ({ default: sharp } = await import('sharp'));
  ({ default: pngToIco } = await import('png-to-ico'));
} catch {
  console.error(
    '\n[generate-favicons] Missing dependencies.\n' +
      '  Run: npm install --save-dev sharp png-to-ico\n'
  );
  process.exit(1);
}

const BRAND_BG = '#0b0f17';
const OG_BG = '#4f46e5';

const pngTargets = [
  { name: 'favicon-16x16.png', size: 16 },
  { name: 'favicon-32x32.png', size: 32 },
  { name: 'apple-touch-icon.png', size: 180 },
  { name: 'android-chrome-192x192.png', size: 192 },
  { name: 'android-chrome-512x512.png', size: 512 },
];

const svgBuffer = await readFile(sourceSvg);

await Promise.all(
  pngTargets.map(({ name, size }) =>
    sharp(svgBuffer, { density: 384 })
      .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png({ compressionLevel: 9 })
      .toFile(resolve(publicDir, name))
      .then(() => console.log(`  ✓ ${name}`))
  )
);

const icoBuffers = await Promise.all(
  [16, 32, 48].map((size) =>
    sharp(svgBuffer, { density: 384 })
      .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer()
  )
);
await writeFile(resolve(publicDir, 'favicon.ico'), await pngToIco(icoBuffers));
console.log('  ✓ favicon.ico');

const ogSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="${OG_BG}" />
  <g transform="translate(120, 215) scale(6)">
    <rect width="32" height="32" rx="8" fill="${BRAND_BG}" />
    <path d="M16 6 L24 13 L16 20 L8 13 Z" fill="#ffffff" fill-opacity="0.95" />
    <path d="M16 14 L24 21 L16 28 L8 21 Z" fill="#ffffff" fill-opacity="0.6" />
  </g>
  <text x="360" y="310" font-family="Inter, system-ui, sans-serif" font-size="84"
        font-weight="800" letter-spacing="-0.02em" fill="#ffffff">Lumen LMS</text>
  <text x="360" y="380" font-family="Inter, system-ui, sans-serif" font-size="32"
        font-weight="500" fill="#ffffff" fill-opacity="0.85">Learn anything. Teach anyone.</text>
</svg>`;

await sharp(Buffer.from(ogSvg))
  .png({ compressionLevel: 9 })
  .toFile(resolve(publicDir, 'og-default.png'));
console.log('  ✓ og-default.png');

console.log('\n[generate-favicons] Done. Outputs in client/public/.\n');
