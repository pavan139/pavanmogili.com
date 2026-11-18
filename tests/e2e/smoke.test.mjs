/**
 * Smoke tests for the built site (dist/), served like Cloudflare Pages with _headers live.
 * Run by `npm run check` (or `node --test tests/e2e/`). One Chrome with software WebGL;
 * every page fails on console errors or warnings, page errors, failed or third-party
 * requests and CSP violations.
 *
 * Soft checks (reported, not failing yet) are marked SOFT: they cover behaviour another lane
 * still has to land; turn them hard when it does.
 */
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { after, before, describe, it } from 'node:test';
import { decodePng, diffFraction, imageStats, openPage, OUT, reaches, startHarness, waitForWorld } from './harness.mjs';

const SCREENS = `${OUT}/screens`;
mkdirSync(SCREENS, { recursive: true });
const DESKTOP = { width: 1440, height: 900 };
const PHONE = { width: 390, height: 844 };
const soft = (msg) => console.log(`  SOFT  ${msg}`);

let h;
before(async () => {
  h = await startHarness();
});
after(async () => {
  await h?.close();
});

async function clean(p) {
  const problems = await p.collect();
  await p.close();
  assert.deepEqual(problems, [], `problems on the page:\n  ${problems.join('\n  ')}`);
}

const noOverflow = (page) => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);

/** The classic page has everything a recruiter needs, visible. */
async function classicComplete(page) {
  return page.evaluate(() => {
    const vis = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return false;
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && Number(s.opacity) > 0.01;
    };
    return {
      main: vis('#main'),
      name: vis('#main .c-name') || vis('#main h1, #main h2'),
      email: vis('#main a[href^="mailto:"]'),
      linkedin: vis('#main a[href*="linkedin.com"]'),
      github: vis('#main a[href*="github.com/pavan139"]'),
      sections: ['work', 'contact'].every((id) => !!document.getElementById(id)),
    };
  });
}

describe('classic view', () => {
  for (const [label, viewport, mobile] of [
    ['phone', PHONE, true],
    ['desktop', DESKTOP, false],
  ]) {
    it(`is complete with JavaScript off (${label})`, async () => {
      const p = await openPage(h, { viewport, mobile, js: false });
      await p.page.goto(h.base, { waitUntil: 'load' });
      const c = await classicComplete(p.page);
      assert.deepEqual(c, { main: true, name: true, email: true, linkedin: true, github: true, sections: true });
      assert.ok(await noOverflow(p.page), 'horizontal overflow');
      await p.page.screenshot({ path: `${SCREENS}/classic-nojs-${viewport.width}x${viewport.height}.png`, fullPage: true });
      await clean(p);
    });
  }

  it('opens by default under reduced motion', async () => {
    const p = await openPage(h, { viewport: PHONE, mobile: true, reducedMotion: 'reduce' });
    await p.page.goto(h.base, { waitUntil: 'load' });
    await p.page.waitForTimeout(500);
    assert.ok(await p.page.evaluate(() => document.documentElement.classList.contains('classic')), 'html.classic expected');
    assert.equal(await p.page.evaluate(() => !!document.querySelector('[data-world] canvas')), false, 'the world should not load');
    await clean(p);
  });

  it('is the fallback without WebGL 2', async () => {
    const p = await openPage(h, {
      viewport: DESKTOP,
      init: [
        () => {
          const get = HTMLCanvasElement.prototype.getContext;
          HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
            return /webgl/i.test(type) ? null : get.call(this, type, ...rest);
          };
        },
      ],
    });
    await p.page.goto(`${h.base}?view=world`, { waitUntil: 'load' });
    await p.page.waitForTimeout(800);
    const s = await p.page.evaluate(() => ({
      classic: document.documentElement.classList.contains('classic'),
      toggleHidden: document.querySelector('[data-view-toggle]')?.hidden ?? true,
    }));
    assert.deepEqual(s, { classic: true, toggleHidden: true });
    assert.deepEqual(await classicComplete(p.page), { main: true, name: true, email: true, linkedin: true, github: true, sections: true });
    await clean(p);
  });
});

describe('tabletop view', () => {
  it('reveals, steps by keyboard and by Next, scrubs back, toggles to classic and back (1440x900)', async () => {
    const p = await openPage(h, { viewport: DESKTOP });
    const { page } = p;
    await page.goto(`${h.base}?view=world&test`, { waitUntil: 'load' });
    await waitForWorld(page);
    await page.screenshot({ path: `${SCREENS}/world-intro-1440x900.png` });

    await page.click('[data-enter]');
    await page.waitForTimeout(600);
    assert.ok(await page.evaluate(() => document.documentElement.classList.contains('is-entered')), 'html.is-entered after Start');
    const canvas = decodePng(await page.locator('[data-world] canvas').screenshot());
    const stats = imageStats(canvas);
    assert.ok(stats.std > 4 && stats.colours > 24, `the canvas looks blank (std ${stats.std.toFixed(1)}, ${stats.colours} colours)`);

    assert.ok(await reaches(page, 1, () => page.keyboard.press('ArrowRight')), 'ArrowRight rolls the marble to the next stop');
    assert.ok(await reaches(page, 2, () => page.click('.run-next')), 'Next rolls the marble to the next stop');
    assert.ok(await reaches(page, 1, () => page.keyboard.press('ArrowLeft')), 'ArrowLeft rolls it back');
    await page.screenshot({ path: `${SCREENS}/world-stop-1440x900.png` });
    // text stays readable: body at 16px or more, pinned labels at 14px or more
    const sizes = await page.evaluate(() => ({
      body: parseFloat(getComputedStyle(document.querySelector('.run-body')).fontSize),
      tag: parseFloat(getComputedStyle(document.querySelector('.run-tag')).fontSize),
    }));
    assert.ok(sizes.body >= 16 && sizes.tag >= 14, `text too small (body ${sizes.body}px, labels ${sizes.tag}px)`);

    await page.click('[data-view-toggle]');
    await page.waitForTimeout(300);
    assert.ok(await page.evaluate(() => document.documentElement.classList.contains('classic')), 'the toggle shows the classic view');
    await page.screenshot({ path: `${SCREENS}/classic-js-1440x900.png` });
    await page.click('[data-view-toggle]');
    await page.waitForTimeout(300);
    assert.ok(await reaches(page, 2, () => page.keyboard.press('ArrowRight')), 'the tabletop runs again after coming back');
    await clean(p);
  });

  it('reveals and steps by tapping Next on a phone, text at 16px (390x844)', async () => {
    // DPR 2 rather than 3: a third of the pixels for software GL, same layout
    const p = await openPage(h, { viewport: PHONE, mobile: true, dpr: 2 });
    const { page } = p;
    await page.goto(`${h.base}?view=world&test`, { waitUntil: 'load' });
    await waitForWorld(page);
    assert.ok(await noOverflow(page), 'horizontal overflow');
    await page.screenshot({ path: `${SCREENS}/world-intro-390x844.png` });
    await page.tap('[data-enter]');
    await page.waitForTimeout(600);
    assert.ok(await reaches(page, 1, () => page.tap('.run-next')), 'tapping Next rolls the marble to the next stop');
    const layout = await page.evaluate(() => {
      const panel = document.querySelector('.run-panel').getBoundingClientRect();
      const next = document.querySelector('.run-next').getBoundingClientRect();
      return {
        body: parseFloat(getComputedStyle(document.querySelector('.run-body')).fontSize),
        nextH: next.height,
        nextVisible: next.bottom <= innerHeight + 1,
        free: panel.top / innerHeight,
      };
    });
    assert.ok(layout.body >= 16, `body text is ${layout.body}px`);
    assert.ok(layout.nextH >= 44 && layout.nextVisible, 'Next is a full-size tap target on screen');
    assert.ok(layout.free >= 0.5, `the model keeps at least half the screen (${(layout.free * 100).toFixed(0)}%)`);
    await page.screenshot({ path: `${SCREENS}/world-stop-390x844.png` });
    await clean(p);
  });

  it('keeps still under reduced motion when the tabletop is chosen', async () => {
    const p = await openPage(h, { viewport: DESKTOP, reducedMotion: 'reduce' });
    const { page } = p;
    await page.goto(`${h.base}?view=world&test`, { waitUntil: 'load' });
    await waitForWorld(page);
    await page.click('[data-enter]');
    await page.waitForTimeout(1500);
    const shot = async () => decodePng(await page.locator('[data-world] canvas').screenshot());
    const a = await shot();
    await page.waitForTimeout(1200);
    const b = await shot();
    const d = diffFraction(a, b);
    if (d > 0.005) soft(`under reduced motion ${(d * 100).toFixed(1)}% of the canvas changed in 1.2 s with no input`);
    await clean(p);
  });
});
