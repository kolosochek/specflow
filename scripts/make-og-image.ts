import sharp from 'sharp';
import { resolve } from 'path';
import { mkdirSync } from 'fs';

// Open Graph preview, 1200x630. Composition:
//   left rail accent (emerald) anchors the type
//   eyebrow tagline + dominant wordmark + 3-line tenet block
//   bottom: 4-layer hierarchy strip (Epic → Milestone → Wave → Slice)
//   bottom-right: URL
// Palette tracks the site theme: slate-900 / emerald-500 / slate-300 / slate-500
const SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <!-- background -->
  <rect width="1200" height="630" fill="#0f172a"/>

  <!-- subtle gradient overlay top-right -->
  <defs>
    <radialGradient id="halo" cx="80%" cy="0%" r="70%">
      <stop offset="0%" stop-color="#10b981" stop-opacity="0.10"/>
      <stop offset="100%" stop-color="#10b981" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#halo)"/>

  <!-- left rail accent -->
  <rect x="64" y="80" width="4" height="470" fill="#10b981"/>

  <!-- eyebrow -->
  <text x="100" y="130" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="22" fill="#94a3b8" letter-spacing="2">SPEC-DRIVEN DEVELOPMENT WITH TDD DISCIPLINE</text>

  <!-- wordmark -->
  <text x="100" y="270" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="160" font-weight="700" fill="#10b981" letter-spacing="-4">specflow</text>

  <!-- accent underline -->
  <rect x="100" y="290" width="180" height="4" fill="#10b981" opacity="0.4"/>

  <!-- tenet block -->
  <text x="100" y="370" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="28" fill="#cbd5e1">Markdown is the source of truth.</text>
  <text x="100" y="410" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="28" fill="#cbd5e1">The CLI is the only legal mutator.</text>
  <text x="100" y="450" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="28" fill="#cbd5e1">Every slice is a test-first commit.</text>

  <!-- 4-layer hierarchy strip -->
  <g font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="20" font-weight="600">
    <!-- Epic -->
    <rect x="100" y="510" width="160" height="46" rx="6" fill="#1e293b" stroke="#334155" stroke-width="1"/>
    <text x="180" y="540" fill="#10b981" text-anchor="middle">Epic</text>
    <!-- arrow -->
    <text x="277" y="540" fill="#475569" text-anchor="middle" font-size="18">→</text>
    <!-- Milestone -->
    <rect x="296" y="510" width="200" height="46" rx="6" fill="#1e293b" stroke="#334155" stroke-width="1"/>
    <text x="396" y="540" fill="#10b981" text-anchor="middle">Milestone</text>
    <!-- arrow -->
    <text x="513" y="540" fill="#475569" text-anchor="middle" font-size="18">→</text>
    <!-- Wave -->
    <rect x="532" y="510" width="160" height="46" rx="6" fill="#1e293b" stroke="#334155" stroke-width="1"/>
    <text x="612" y="540" fill="#10b981" text-anchor="middle">Wave</text>
    <!-- arrow -->
    <text x="709" y="540" fill="#475569" text-anchor="middle" font-size="18">→</text>
    <!-- Slice -->
    <rect x="728" y="510" width="160" height="46" rx="6" fill="#1e293b" stroke="#10b981" stroke-width="2"/>
    <text x="808" y="540" fill="#10b981" text-anchor="middle">Slice</text>
  </g>

  <!-- footer URL bottom-right -->
  <text x="1140" y="600" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="20" fill="#64748b" text-anchor="end">kolosochek.github.io/specflow</text>
</svg>`;

const outDir = resolve(process.cwd(), 'docs-site/public');
const outPath = resolve(outDir, 'og-image.png');

mkdirSync(outDir, { recursive: true });

await sharp(Buffer.from(SVG))
  .png()
  .toFile(outPath);

console.log(`Wrote ${outPath} (1200x630 PNG)`);
