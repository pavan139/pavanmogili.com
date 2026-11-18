/**
 * Shared harness for the smoke tests and the profile: one Chrome, one Pages-like server,
 * pages that record every problem (console errors and warnings, page errors, failed
 * requests, third-party requests, CSP violations), and a tiny PNG decoder for pixel checks.
 *
 * Chrome: CHROME_PATH or /usr/bin/google-chrome, software WebGL through SwiftShader. Judge
 * visuals from screenshots, never from frame rates, on this machine.
 */
import { inflateSync } from 'node:zlib';
import { chromium } from 'playwright-core';
import { serve } from '../serve.mjs';

export const CHROME = process.env.CHROME_PATH || '/usr/bin/google-chrome';
export const GL_ARGS = ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-precise-memory-info'];
export const OUT = process.env.CHECK_OUT || 'tests/.out';
/** How long the world may take to reveal under software GL on a shared 2-CPU box. */
export const REVEAL_MS = Number(process.env.REVEAL_MS || 120000);

/** Driver chatter under SwiftShader that says nothing about the site. */
const NOISE = /GPU stall due to ReadPixels|GL Driver Message|KHR_parallel_shader_compile|Automatic fallback to software WebGL|swiftshader|WebGL: CONTEXT_LOST_WEBGL|loseContext/i;

export async function startHarness({ root = 'dist', mode = 'pages', wasm = true } = {}) {
  const server = await serve({ root, port: Number(process.env.CHECK_PORT || 0), mode, wasm });
  const browser = await chromium.launch({ executablePath: CHROME, args: GL_ARGS });
  return {
    server,
    browser,
    base: server.url,
    async close() {
      await browser.close();
      await server.close();
    },
  };
}

/**
 * A page with every problem recorded in `problems`. Options: viewport, mobile (touch,
 * isMobile, DPR 3 unless dpr given), js, reducedMotion, init (scripts run before any page
 * script), dpr.
 */
export async function openPage(h, { viewport = { width: 1440, height: 900 }, mobile = false, js = true, reducedMotion = 'no-preference', init = [], dpr } = {}) {
  const ctx = await h.browser.newContext({
    viewport,
    deviceScaleFactor: dpr ?? (mobile ? 3 : 1),
    isMobile: mobile,
    hasTouch: mobile,
    javaScriptEnabled: js,
    reducedMotion,
  });
  const origin = new URL(h.base).origin;
  const problems = [];
  await ctx.addInitScript(() => {
    window.__csp = [];
    addEventListener('securitypolicyviolation', (e) => window.__csp.push(`${e.violatedDirective} blocked ${e.blockedURI || 'inline'}`));
  });
  for (const fn of init) await ctx.addInitScript(fn);
  // world pages under software GL on a loaded box: actions get 60 s, navigations 120 s
  ctx.setDefaultTimeout(60000);
  ctx.setDefaultNavigationTimeout(120000);
  const page = await ctx.newPage();
  page.on('console', (m) => {
    const type = m.type();
    if ((type === 'error' || type === 'warning') && !NOISE.test(m.text())) problems.push(`console ${type}: ${m.text()}`);
  });
  page.on('pageerror', (e) => problems.push(`page error: ${e.message}`));
  page.on('requestfailed', (r) => {
    const why = r.failure()?.errorText ?? '';
    if (!/ERR_ABORTED/.test(why)) problems.push(`request failed: ${r.url()} (${why})`);
  });
  page.on('request', (r) => {
    const u = r.url();
    if (!u.startsWith(origin) && !/^(data|blob|about):/.test(u)) problems.push(`third-party request: ${u}`);
  });
  page.on('response', (r) => {
    if (r.status() >= 400 && !r.url().endsWith('/favicon.ico')) problems.push(`HTTP ${r.status()}: ${r.url()}`);
  });
  return {
    page,
    ctx,
    problems,
    /** CSP violations seen by the page, added to problems; call before closing. */
    async collect() {
      if (js) {
        const csp = await page.evaluate(() => window.__csp ?? []).catch(() => []);
        for (const v of csp) problems.push(`CSP violation: ${v}`);
      }
      return problems;
    },
    close: () => ctx.close(),
  };
}

/** Waits for html.world-ready (the reveal). Works on a Page or a Frame. */
export async function waitForWorld(page, timeout = REVEAL_MS) {
  await page.waitForFunction(() => document.documentElement.classList.contains('world-ready') || document.documentElement.classList.contains('classic'), null, { timeout, polling: 250 });
  const ready = await page.evaluate(() => document.documentElement.classList.contains('world-ready'));
  if (!ready) throw new Error('the world fell back to the classic view instead of revealing');
}

/**
 * Software GL renders anywhere from 1 to 30 frames a second, so wall-clock windows mean
 * nothing. Act, then wait until the marble itself has arrived at stop `index` and the
 * panel shows that stop.
 */
export async function reaches(page, index, act, timeout = 180000) {
  await act();
  try {
    await page.waitForFunction(
      (i) => {
        const r = window.__run;
        const b = r.beats[i];
        return Math.abs(r.s - b.s) < 0.05 && document.querySelector('.run-title')?.textContent === b.title;
      },
      index,
      { timeout, polling: 250 },
    );
    return true;
  } catch {
    return false;
  }
}

/** engine.respawn(at) puts the marble at a given point (WORLD's deep links). */
export async function respawnsAt(page, at = [6, 1.5, 4], timeout = 120000) {
  await page.evaluate((p) => window.__world.engine.respawn(p), at);
  await page.waitForFunction(
    ([x, z]) => {
      const p = window.__world.engine.marble.position;
      return Math.hypot(p.x - x, p.z - z) < 0.75;
    },
    [at[0], at[2]],
    { timeout, polling: 250 },
  );
  return true;
}

// -----------------------------------------------------------------------------------------
// PNG decoding (8-bit RGB or RGBA, not interlaced: what Chrome writes)
// -----------------------------------------------------------------------------------------
export function decodePng(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('not a PNG');
  let o = 8;
  let width = 0;
  let height = 0;
  let type = 0;
  const idat = [];
  while (o < buf.length) {
    const len = buf.readUInt32BE(o);
    const name = buf.toString('ascii', o + 4, o + 8);
    const data = buf.subarray(o + 8, o + 8 + len);
    if (name === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      if (data[8] !== 8 || data[12] !== 0) throw new Error('only 8-bit, non-interlaced PNGs');
      type = data[9];
    } else if (name === 'IDAT') idat.push(data);
    else if (name === 'IEND') break;
    o += 12 + len;
  }
  const bpp = type === 6 ? 4 : type === 2 ? 3 : 0;
  if (!bpp) throw new Error(`PNG colour type ${type} not supported`);
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * bpp;
  const out = new Uint8Array(width * height * 4);
  const prev = new Uint8Array(stride);
  const line = new Uint8Array(stride);
  for (let y = 0; y < height; y++) {
    const f = raw[y * (stride + 1)];
    const src = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? line[i - bpp] : 0;
      const b = prev[i];
      const c = i >= bpp ? prev[i - bpp] : 0;
      let v = src[i];
      if (f === 1) v += a;
      else if (f === 2) v += b;
      else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      line[i] = v & 255;
    }
    for (let x = 0; x < width; x++) {
      const d = (y * width + x) * 4;
      out[d] = line[x * bpp];
      out[d + 1] = line[x * bpp + 1];
      out[d + 2] = line[x * bpp + 2];
      out[d + 3] = bpp === 4 ? line[x * bpp + 3] : 255;
    }
    prev.set(line);
  }
  return { width, height, data: out };
}

/** Luminance spread and colour count of an image: is anything actually drawn? */
export function imageStats(img) {
  let sum = 0;
  let sum2 = 0;
  const colours = new Set();
  const n = img.width * img.height;
  for (let i = 0; i < n; i++) {
    const r = img.data[i * 4];
    const g = img.data[i * 4 + 1];
    const b = img.data[i * 4 + 2];
    const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    sum += l;
    sum2 += l * l;
    if (i % 7 === 0) colours.add(((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3));
  }
  const mean = sum / n;
  return { mean, std: Math.sqrt(Math.max(0, sum2 / n - mean * mean)), colours: colours.size };
}

/** Fraction of pixels that differ by more than `tol` in any channel. */
export function diffFraction(a, b, tol = 8) {
  if (a.width !== b.width || a.height !== b.height) return 1;
  let diff = 0;
  const n = a.width * a.height;
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    if (Math.abs(a.data[o] - b.data[o]) > tol || Math.abs(a.data[o + 1] - b.data[o + 1]) > tol || Math.abs(a.data[o + 2] - b.data[o + 2]) > tol) diff++;
  }
  return diff / n;
}
