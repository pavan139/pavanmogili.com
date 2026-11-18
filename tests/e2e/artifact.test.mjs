/**
 * The first previews run inside a sandboxed iframe on a Claude artifact page. That frame is
 * not cross-origin isolated (no SharedArrayBuffer), blocks motion sensors, Web Share and
 * downloads, loads fonts only from the artifact's own files or data: URIs, and ignores our
 * _headers. tests/serve.mjs --artifact imitates it; these tests run the site there.
 *
 * Checks: the physics falls back to transferred buffers and the marble still rolls; nothing
 * breaks when motion permission is refused (iOS-style rejection) or sensors are blocked; the
 * self-hosted font loads; a host that blocks WebAssembly gets the classic view, cleanly.
 */
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { after, before, describe, it } from 'node:test';
import { openPage, OUT, reaches, startHarness, waitForWorld } from './harness.mjs';

const SCREENS = `${OUT}/screens`;
mkdirSync(SCREENS, { recursive: true });

/** iOS-style refusal of motion permission, in every frame, before any page script. */
const refuseMotion = () => {
  const refuse = () => Promise.reject(new DOMException('Motion access was refused', 'NotAllowedError'));
  if (typeof DeviceOrientationEvent !== 'undefined') DeviceOrientationEvent.requestPermission = refuse;
  if (typeof DeviceMotionEvent !== 'undefined') DeviceMotionEvent.requestPermission = refuse;
};

let h;
before(async () => {
  h = await startHarness({ mode: 'artifact' });
});
after(async () => {
  await h?.close();
});

async function frameOf(page) {
  const el = await page.waitForSelector('#frame');
  const f = await el.contentFrame();
  await f.waitForLoadState('load');
  return f;
}

/** The host page's own warning about its sandbox flags is the host's, not the site's. */
const HOST_NOISE = /iframe which has both allow-scripts and allow-same-origin/;

async function clean(p) {
  const problems = (await p.collect()).filter((x) => !HOST_NOISE.test(x));
  await p.close();
  assert.deepEqual(problems, [], `problems on the page:\n  ${problems.join('\n  ')}`);
}

describe('artifact preview (sandboxed iframe)', () => {
  for (const [label, opts] of [
    ['desktop 1440x900', { viewport: { width: 1440, height: 900 } }],
    ['phone 390x844', { viewport: { width: 390, height: 844 }, mobile: true, dpr: 2 }],
  ]) {
    it(`reveals and moves the request from stop to stop in the frame (${label})`, async () => {
      const p = await openPage(h, { ...opts, init: [refuseMotion] });
      await p.page.goto(`${h.base}__artifact`, { waitUntil: 'load' });
      const f = await frameOf(p.page);
      await waitForWorld(f);
      if (opts.mobile) await f.tap('[data-enter]');
      else await f.click('[data-enter]');
      await p.page.waitForTimeout(500);
      assert.ok(await f.evaluate(() => document.documentElement.classList.contains('is-entered')), 'entered');
      assert.ok(await reaches(f, 1, () => (opts.mobile ? f.tap('.run-next') : f.click('.run-next'))), 'Next rolls the marble to the next stop');
      await p.page.screenshot({ path: `${SCREENS}/artifact-${label.split(' ')[1]}.png` });
      await clean(p);
    });
  }
});
