// Vercel's upload skips any folder named "node_modules", and Expo's web export
// puts fonts and icons in dist/assets/node_modules/..., so they never arrive
// (the site then falls back to plain system fonts). This renames that folder
// to dist/assets/vendor and rewrites every reference to it, then copies in
// vercel.json so deep links work. Run after `expo export --platform web`.
import { existsSync, readdirSync, readFileSync, renameSync, writeFileSync, copyFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const dist = 'dist';
const from = join(dist, 'assets', 'node_modules');
if (existsSync(from)) renameSync(from, join(dist, 'assets', 'vendor'));

let rewritten = 0;
function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) { walk(p); continue; }
    if (!/\.(js|html|css|json)$/.test(name)) continue;
    const text = readFileSync(p, 'utf8');
    if (!text.includes('assets/node_modules')) continue;
    writeFileSync(p, text.replaceAll('assets/node_modules', 'assets/vendor'));
    rewritten += 1;
  }
}
walk(dist);

if (existsSync('vercel.json')) copyFileSync('vercel.json', join(dist, 'vercel.json'));
console.log(`web build fixed: renamed assets/node_modules to assets/vendor, rewrote ${rewritten} file(s)`);
