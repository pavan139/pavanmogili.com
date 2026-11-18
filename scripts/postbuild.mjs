#!/usr/bin/env node
/**
 * Runs after `vite build` (part of `npm run build`): byte budgets from tests/budgets.json,
 * then the content lint (banned copy, emoji, truth rules, JSON-LD, anchors, CSP hazards).
 * Fails the build on any error, so nothing over budget or off-brief can be deployed.
 *
 *   node scripts/postbuild.mjs [--json]
 *
 * Groups (Brotli KB):
 *   html, classicCss, preloadedFonts, classicFirstPaint (the three together), entryJs (the
 *   entry chunk and its static imports), worldJs (src/app.ts and what it pulls in beyond the
 *   entry), searchJs, otherChunk (each other lazy chunk), physics (worker JS plus .wasm),
 *   worldData (meshes, lightmaps, atlases), totalWorld (worldJs + physics + worldData).
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { brotliCompressSync, constants as zc } from 'node:zlib';
import { lintContent } from '../tests/lint/content.mjs';

const DIST = 'dist';
const budgets = JSON.parse(readFileSync('tests/budgets.json', 'utf8'));
const pending = budgets.pending ?? {};
const KB = 1024;

const files = [];
(function walk(d) {
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    if (statSync(p).isDirectory()) walk(p);
    else files.push(relative(DIST, p));
  }
})(DIST);

const PRECOMPRESSED = /\.(woff2|webp|avif|jpe?g|png|gif|ktx2|mp4|webm|zip|gz|br)$/i;
const brCache = new Map();
/** Bytes as served: Brotli for text and WASM, as-is for formats that are already compressed. */
const br = (f) => {
  if (!brCache.has(f)) {
    const b = readFileSync(join(DIST, f));
    brCache.set(f, PRECOMPRESSED.test(f) ? b.length : brotliCompressSync(b, { params: { [zc.BROTLI_PARAM_QUALITY]: 9 } }).length);
  }
  return brCache.get(f);
};
const sum = (list) => list.reduce((a, f) => a + br(f), 0);

const html = readFileSync(join(DIST, 'index.html'), 'utf8');
const attr = (tag, name) => (tag.match(new RegExp(`\\s${name}="([^"]*)"`)) ?? [])[1];
const rel = (href) => href.replace(/^\.?\//, '');
const css = [...html.matchAll(/<link\b[^>]*rel="stylesheet"[^>]*>/g)].map((m) => rel(attr(m[0], 'href')));
const fonts = [...html.matchAll(/<link\b[^>]*rel="preload"[^>]*as="font"[^>]*>/g)].map((m) => rel(attr(m[0], 'href')));

// module graph from the bundle report written by vite.config.ts
const report = existsSync('.build/bundle-report.json') ? JSON.parse(readFileSync('.build/bundle-report.json', 'utf8')) : { chunks: [], assets: [] };
const byFile = new Map(report.chunks.map((c) => [c.file, c]));
const closure = (start) => {
  const seen = new Set();
  const visit = (f) => {
    if (seen.has(f) || !byFile.has(f)) return;
    seen.add(f);
    for (const i of byFile.get(f).imports) visit(i);
  };
  start.forEach(visit);
  return seen;
};
const entry = closure(report.chunks.filter((c) => c.isEntry).map((c) => c.file));
const facade = (path) => report.chunks.find((c) => c.facade === path);
const lazy = (path) => {
  const c = facade(path);
  return c ? [...closure([c.file])].filter((f) => !entry.has(f)) : [];
};
const world = lazy('src/app.ts');
const search = lazy('src/classic/search/ui.ts');
const named = new Set([...entry, ...world, ...search]);
const others = report.chunks.filter((c) => !named.has(c.file)).map((c) => c.file);
const physics = files.filter((f) => /physics\.worker[^/]*\.js$/.test(f) || /\.wasm$/.test(f));
const worldData = files.filter((f) => /\.(glb|gltf|bin|ktx2)$/i.test(f) || (/^assets\//.test(f) && /\.(webp|avif|png|jpe?g)$/i.test(f)) || /(^|\/)world\//.test(f));

const rows = [];
const problems = [];
const check = (key, label, list, value = sum(list)) => {
  const limit = budgets[key];
  const over = limit !== undefined && value > limit * KB;
  const status = !over ? 'ok' : pending[key] ? 'PENDING' : 'OVER';
  rows.push({ key, label, kb: value / KB, limit, status, files: list });
  if (over && !pending[key]) problems.push(`${label}: ${(value / KB).toFixed(1)} KB > ${limit} KB`);
  if (over && pending[key]) console.log(`budget pending: ${label} ${(value / KB).toFixed(1)} KB > ${limit} KB (${pending[key]})`);
};

check('html', 'HTML (index.html)', ['index.html']);
check('classicCss', 'classic CSS', css);
check('preloadedFonts', 'preloaded fonts', fonts);
check('classicFirstPaint', 'classic first paint (HTML + CSS + fonts)', ['index.html', ...css, ...fonts]);
check('entryJs', 'entry JS', [...entry]);
check('worldJs', 'world JS (src/app.ts closure)', world);
check('searchJs', 'search JS', search);
for (const f of others) check('otherChunk', `lazy chunk ${f}`, [f]);
check('physics', 'physics (worker + wasm)', physics);
check('worldData', 'world data (meshes, lightmaps, atlases)', worldData);
check('totalWorld', 'total world (JS + physics + data)', [...world, ...physics, ...worldData]);
const distBytes = files.reduce((a, f) => a + statSync(join(DIST, f)).size, 0);
if (files.length > budgets.distFiles) problems.push(`dist/ has ${files.length} files > ${budgets.distFiles}`);
if (distBytes > budgets.distMB * KB * KB) problems.push(`dist/ is ${(distBytes / KB / KB).toFixed(2)} MB > ${budgets.distMB} MB`);

if (process.argv.includes('--json')) console.log(JSON.stringify({ rows, files: files.length, distBytes }, null, 2));
else {
  console.log(`budgets (KB, Brotli as served)   dist/: ${files.length} files, ${(distBytes / KB / KB).toFixed(2)} MB`);
  for (const r of rows) console.log(`  ${r.status.padEnd(7)} ${r.label.padEnd(46)} ${r.kb.toFixed(1).padStart(8)} / ${String(r.limit ?? '-').padStart(5)}`);
}

const { errors, warnings } = await lintContent({ dist: DIST });
for (const w of warnings) console.log(`  warn  ${w}`);
for (const e of errors) console.log(`  FAIL  ${e}`);
problems.push(...errors);

if (problems.length) {
  console.error(`postbuild: ${problems.length} problem(s)`);
  process.exit(1);
}
console.log(`postbuild: budgets and content OK${warnings.length ? ` (${warnings.length} warnings)` : ''}`);
