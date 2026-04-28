import sharp from 'sharp';
import { resolve } from 'path';
import { mkdirSync } from 'fs';

const SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
  <rect width="1200" height="630" fill="#0f172a"/>
  <text x="80" y="280" font-family="ui-monospace, monospace" font-size="120" fill="#10b981" font-weight="700">specflow</text>
  <text x="80" y="380" font-family="ui-monospace, monospace" font-size="36" fill="#cbd5e1">Spec-driven development</text>
  <text x="80" y="440" font-family="ui-monospace, monospace" font-size="36" fill="#cbd5e1">with TDD discipline</text>
  <text x="80" y="560" font-family="ui-monospace, monospace" font-size="24" fill="#64748b">kolosochek.github.io/specflow</text>
</svg>`;

const outDir = resolve(process.cwd(), 'docs-site/public');
const outPath = resolve(outDir, 'og-image.png');

mkdirSync(outDir, { recursive: true });

await sharp(Buffer.from(SVG))
  .png()
  .toFile(outPath);

console.log(`Wrote ${outPath} (1200x630 PNG)`);
