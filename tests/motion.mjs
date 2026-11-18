// Walk every stop with the keyboard and look for jumps: a frame where the camera (or the
// marble) moves several times further than in the frames around it.
import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.on('pageerror', (e) => console.log('[pageerror]', String(e).slice(0, 300)));
await page.goto('http://127.0.0.1:4174/?view=world&quality=test', { waitUntil: 'load' });
await page.waitForFunction(() => document.documentElement.classList.contains('world-ready'), null, { timeout: 120000 });
await page.evaluate(() => {
  const r = window.__run;
  window.__rec = [];
  const cam = r.stage.camera;
  const loop = () => {
    const e = cam.projectionMatrix.elements;
    window.__rec.push([performance.now(), r.s, cam.position.x, cam.position.y, cam.position.z, e[8], e[9]]);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
});
await page.click('[data-enter]');
await page.waitForTimeout(5000);
const n = await page.evaluate(() => window.__run.beats.length);
for (let i = 1; i < Math.min(n, Number(process.argv[2] || n)); i++) {
  await page.keyboard.press('ArrowRight');
  await page.waitForFunction((k) => Math.abs(window.__run.s - window.__run.beats[k].s) < 0.01, i, { timeout: 120000, polling: 100 });
  await page.waitForTimeout(700);
}
const rec = await page.evaluate(() => window.__rec);
await browser.close();
// per-frame step sizes; a jump is a step much larger than both neighbours
const step = (a, b) => Math.hypot(b[2] - a[2], b[3] - a[3], b[4] - a[4]) + 40 * Math.hypot(b[5] - a[5], b[6] - a[6]);
const d = rec.slice(1).map((r, i) => ({ t: r[0], s: r[1], cam: step(rec[i], r), ds: Math.abs(r[1] - rec[i][1]), dt: r[0] - rec[i][0] }));
const jumps = [];
for (let i = 2; i < d.length - 2; i++) {
  const around = Math.max(d[i - 1].cam, d[i + 1].cam, d[i - 2].cam, d[i + 2].cam, 0.02);
  if (d[i].cam > 0.5 && d[i].cam > around * 3) jumps.push({ s: d[i].s.toFixed(1), cam: d[i].cam.toFixed(2), around: around.toFixed(2) });
  if (d[i].ds > 0.75) jumps.push({ s: d[i].s.toFixed(1), marbleStep: d[i].ds.toFixed(2) });
}
const dts = d.map((x) => x.dt).sort((a, b) => a - b);
console.log('frames', d.length, 'median frame ms', dts[Math.floor(dts.length / 2)].toFixed(0), 'max camera step', Math.max(...d.map((x) => x.cam)).toFixed(2), 'max marble step', Math.max(...d.map((x) => x.ds)).toFixed(2));
console.log('jumps', jumps.length, JSON.stringify(jumps.slice(0, 14)));
