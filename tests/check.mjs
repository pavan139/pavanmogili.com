#!/usr/bin/env node
/**
 * `npm run check`: the gate every branch must pass before LEAD merges it.
 *
 *   1. build      npm run build: corpus, vite build, then scripts/postbuild.mjs (byte
 *                 budgets and the content lint: banned copy, emoji, truth rules, JSON-LD,
 *                 anchors, CSP hazards)
 *   2. html       html-validate on dist/*.html (tests/known-issues.json lists tolerated
 *                 findings in files PERF does not own)
 *      unit       node:test unit tests (tests/unit), e.g. the frame-time governor
 *   3. smoke      headless Chrome against a Pages-like server with _headers live: classic
 *                 view with JS off, reduced motion, no-WebGL fallback, the world reveals and
 *                 rolls by keyboard and drag, classic toggle, context loss; screenshots at
 *                 390x844 and 1440x900 in tests/.out/screens
 *   4. profile    scripts/profile.mjs --ci: on the capture clock with a warm JIT, frame CPU,
 *                 allocation per frame (ours named by source file), GC, forced layouts, and no
 *                 shader compile or upload after reveal (skipped if not present)
 *
 * Flags: --quick (steps 1-2 only), --no-build, --only=<step>. Exit code 1 on any failure.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';

const args = process.argv.slice(2);
const quick = args.includes('--quick');
const noBuild = args.includes('--no-build');
const only = (args.find((a) => a.startsWith('--only=')) ?? '').slice(7);
const results = [];

function run(name, cmd, cmdArgs, opts = {}) {
  if (only && only !== name) return true;
  const t0 = Date.now();
  console.log(`\n=== ${name}: ${[cmd, ...cmdArgs].join(' ')}`);
  const r = spawnSync(cmd, cmdArgs, { stdio: opts.capture ? 'pipe' : 'inherit', encoding: 'utf8', env: { ...process.env, FORCE_COLOR: '0' } });
  const ok = opts.judge ? opts.judge(r) : r.status === 0;
  results.push({ name, ok, s: ((Date.now() - t0) / 1000).toFixed(1) });
  return ok;
}

function htmlValidate() {
  if (only && only !== 'html') return;
  const t0 = Date.now();
  console.log('\n=== html: html-validate dist/*.html');
  const pages = readdirSync('dist').filter((f) => f.endsWith('.html')).map((f) => `dist/${f}`);
  const r = spawnSync('npx', ['html-validate', '--formatter', 'json', ...pages], { encoding: 'utf8' });
  const known = JSON.parse(readFileSync('tests/known-issues.json', 'utf8'))['html-validate'] ?? [];
  let report = [];
  try {
    report = JSON.parse(r.stdout || '[]');
  } catch {
    console.log(r.stdout, r.stderr);
    results.push({ name: 'html', ok: false, s: ((Date.now() - t0) / 1000).toFixed(1) });
    return;
  }
  const seen = new Set();
  let fail = 0;
  for (const file of report) {
    for (const m of file.messages) {
      const k = known.find((x) => x.rule === m.ruleId);
      const where = `${file.filePath.replace(process.cwd() + '/', '')}:${m.line}:${m.column}`;
      if (k) {
        seen.add(k.rule);
        console.log(`  known  ${where} ${m.ruleId}: ${m.message} [owner ${k.owner}: ${k.note}]`);
      } else {
        fail++;
        console.log(`  FAIL   ${where} ${m.ruleId}: ${m.message}`);
      }
    }
  }
  for (const k of known) if (!seen.has(k.rule)) console.log(`  stale  tests/known-issues.json: '${k.rule}' no longer occurs; remove the entry`);
  console.log(fail ? `html: ${fail} error(s)` : `html: OK (${pages.length} pages)`);
  results.push({ name: 'html', ok: fail === 0, s: ((Date.now() - t0) / 1000).toFixed(1) });
}

const built = noBuild ? existsSync('dist/index.html') : run('build', 'npm', ['run', '--silent', 'build']);
if (!built) results.push({ name: 'build', ok: false, s: '0' });
if (built) {
  htmlValidate();
  if (!quick) {
    run('smoke', process.execPath, ['--test', '--test-concurrency=1', '--test-reporter=spec', 'tests/e2e/*.test.mjs']);
  }
}

console.log('\n=== check summary');
for (const r of results) console.log(`  ${r.ok ? 'pass' : 'FAIL'}  ${r.name.padEnd(8)} ${r.s.padStart(6)} s`);
const failed = results.filter((r) => !r.ok);
console.log(failed.length ? `check: FAILED (${failed.map((r) => r.name).join(', ')})` : 'check: all green');
process.exit(failed.length ? 1 : 0);
