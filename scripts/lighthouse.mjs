#!/usr/bin/env node
/**
 * Lighthouse on the built site (PERF), served like Cloudflare Pages (tests/serve.mjs).
 *
 *   node scripts/lighthouse.mjs [--runs 1] [--world] [--report-only]
 *
 * Audits the classic page on mobile (simulated slow 4G, 4x CPU) and desktop; that is what
 * crawlers and Lighthouse get (main.ts sends bots to the classic view, the SEO surface).
 * --world also audits ?view=world on mobile, for information (software GL here).
 *
 * Lighthouse is not a dependency of the site: set LIGHTHOUSE_CLI, or it is looked up in
 * node_modules/lighthouse. Thresholds (classic): performance >= 95 mobile, >= 98 desktop,
 * accessibility, best practices and SEO 100, CLS <= 0.02. Median of --runs.
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { OUT } from '../tests/e2e/harness.mjs';
import { serve } from '../tests/serve.mjs';

const args = process.argv.slice(2);
const arg = (n, d) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 ? args[i + 1] : d;
};
const runs = Number(arg('runs', 1));
const reportOnly = args.includes('--report-only');
const cli =
  process.env.LIGHTHOUSE_CLI ||
  ['node_modules/lighthouse/cli/index.js', '../site-v2/node_modules/lighthouse/cli/index.js', '/home/claude/site-v2/node_modules/lighthouse/cli/index.js'].find((p) => existsSync(p));
if (!cli) {
  console.log('lighthouse: not installed (npm i -D lighthouse, or set LIGHTHOUSE_CLI); skipped');
  process.exit(0);
}
const CHROME_FLAGS = '--headless=new --no-sandbox --use-angle=swiftshader --enable-unsafe-swiftshader --ignore-gpu-blocklist';
mkdirSync(`${OUT}/lighthouse`, { recursive: true });

const server = await serve({ root: 'dist', port: 0 });
const jobs = [
  { name: 'classic-mobile', url: server.url, flags: [], min: { performance: 95, accessibility: 100, 'best-practices': 100, seo: 100 } },
  { name: 'classic-desktop', url: server.url, flags: ['--preset=desktop'], min: { performance: 98, accessibility: 100, 'best-practices': 100, seo: 100 } },
];
if (args.includes('--world')) jobs.push({ name: 'world-mobile', url: `${server.url}?view=world`, flags: [], min: {} });

function run(cmd, argv, env, timeout) {
  return new Promise((resolve) => {
    const child = spawn(cmd, argv, { env, stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', (d) => (stderr = (stderr + d).slice(-4000)));
    const timer = setTimeout(() => child.kill('SIGKILL'), timeout);
    child.on('close', (status, signal) => {
      clearTimeout(timer);
      resolve({ status, signal, stderr });
    });
  });
}
const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const problems = [];
const rows = [];
for (const job of jobs) {
  const results = [];
  for (let r = 0; r < runs; r++) {
    const out = `${OUT}/lighthouse/${job.name}-${r + 1}.json`;
    // async: the server runs in this process, so a synchronous spawn would starve it
    const res = await run(
      process.execPath,
      [cli, job.url, '--quiet', '--output=json', `--output-path=${out}`, `--chrome-flags=${CHROME_FLAGS}`, '--only-categories=performance,accessibility,best-practices,seo', '--max-wait-for-load=120000', ...job.flags],
      { ...process.env, CHROME_PATH: process.env.CHROME_PATH || '/usr/bin/google-chrome' },
      600000,
    );
    if (res.status !== 0 || !existsSync(out)) {
      problems.push(`${job.name}: lighthouse failed (status ${res.status}${res.signal ? `, ${res.signal}` : ''}: ${(res.stderr || '').trim().split('\n').slice(-3).join(' ')})`);
      continue;
    }
    results.push(JSON.parse(readFileSync(out, 'utf8')));
  }
  if (!results.length) continue;
  const score = (k) => median(results.map((x) => Math.round((x.categories[k]?.score ?? 0) * 100)));
  const metric = (id) => median(results.map((x) => x.audits[id]?.numericValue ?? NaN));
  const row = {
    name: job.name,
    performance: score('performance'),
    accessibility: score('accessibility'),
    'best-practices': score('best-practices'),
    seo: score('seo'),
    fcp: metric('first-contentful-paint'),
    lcp: metric('largest-contentful-paint'),
    tbt: metric('total-blocking-time'),
    cls: metric('cumulative-layout-shift'),
    si: metric('speed-index'),
  };
  rows.push(row);
  for (const [k, min] of Object.entries(job.min)) if (row[k] < min) problems.push(`${job.name}: ${k} ${row[k]} < ${min}`);
  if (job.name.startsWith('classic') && row.cls > 0.02) problems.push(`${job.name}: CLS ${row.cls.toFixed(3)} > 0.02`);
  // the failing audits, for the report
  const last = results[results.length - 1];
  const failing = Object.values(last.audits)
    .filter((a) => a.score !== null && a.score < 0.9 && a.scoreDisplayMode !== 'informative' && a.scoreDisplayMode !== 'manual' && a.scoreDisplayMode !== 'notApplicable')
    .map((a) => `${a.id} (${Math.round(a.score * 100)})`);
  row.failing = failing;
}
await server.close();

console.log(`lighthouse ${runs > 1 ? `(median of ${runs})` : ''}`);
for (const r of rows) {
  console.log(
    `  ${r.name.padEnd(16)} perf ${String(r.performance).padStart(3)}  a11y ${String(r.accessibility).padStart(3)}  bp ${String(r['best-practices']).padStart(3)}  seo ${String(r.seo).padStart(3)}  FCP ${(r.fcp / 1000).toFixed(2)} s  LCP ${(r.lcp / 1000).toFixed(2)} s  TBT ${Math.round(r.tbt)} ms  CLS ${r.cls.toFixed(3)}  SI ${(r.si / 1000).toFixed(2)} s`,
  );
  if (r.failing.length) console.log(`    below 90: ${r.failing.join(', ')}`);
}
for (const p of problems) console.log(`  FAIL  ${p}`);
process.exit(problems.length && !reportOnly ? 1 : 0);
