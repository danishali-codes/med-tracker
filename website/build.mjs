// Builds the site into dist/: the static files from public/, plus the screenshots of the
// newest version under docs/screenshots, so the site always shows the current app.
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const dist = join(here, 'dist');
const shotsRoot = join(here, '..', 'docs', 'screenshots');

rmSync(dist, { recursive: true, force: true });
cpSync(join(here, 'public'), dist, { recursive: true });

const parse = (v) => v.split('.').map(Number);
const newer = (a, b) => {
  const [x, y] = [parse(a), parse(b)];
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) - (y[i] || 0);
  }
  return 0;
};
const versions = readdirSync(shotsRoot).filter((d) => /^\d+(\.\d+)*$/.test(d)).sort(newer);
const newest = versions[versions.length - 1];
if (!newest) throw new Error('No versioned screenshots in docs/screenshots');

// Each screen comes from the newest version that has it.
const html = readFileSync(join(dist, 'index.html'), 'utf8');
const wanted = [...new Set([...html.matchAll(/data-shot="([^"]+)"/g)].map((m) => m[1]))];
mkdirSync(join(dist, 'shots'));
for (const name of wanted) {
  for (const variant of [name, `${name}-dark`]) {
    const from = [...versions].reverse().map((v) => join(shotsRoot, v, `${variant}.png`)).find(existsSync);
    if (!from) throw new Error(`No screenshot for ${variant}`);
    cpSync(from, join(dist, 'shots', `${variant}.png`));
  }
}
console.log(`Built dist/ with ${wanted.length} screens, newest screenshots from ${newest}`);
