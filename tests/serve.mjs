#!/usr/bin/env node
/**
 * Serves dist/ the way Cloudflare Pages does, so tests and Lighthouse see production
 * behaviour rather than `vite preview`:
 *
 *  - applies dist/_headers (same syntax: path patterns with * and :placeholders, rules
 *    merged in file order, duplicate names joined with ", ", "! Name" detaches), so the CSP
 *    is live in every test;
 *  - adds the Pages default headers (Cache-Control max-age=0 must-revalidate, nosniff,
 *    Referrer-Policy, Access-Control-Allow-Origin, ETag);
 *  - Brotli or gzip for text, like Pages;
 *  - /index.html and /x.html redirect to / and /x; /x serves x.html or x/index.html;
 *  - unknown paths get the nearest 404.html with status 404; _headers itself is not served.
 *
 *   node tests/serve.mjs [--root dist] [--port 4321] [--host 127.0.0.1] [--log] [--artifact]
 *   import { serve } from './serve.mjs'; const s = await serve({ root, port }); s.close();
 *
 * --artifact (mode 'artifact') imitates the first preview host instead: a sandboxed iframe on
 * a Claude artifact page. dist/_headers is ignored; every response gets a CSP like the
 * artifact page's (own files, inline script, the listed CDNs, fonts from own files, data: or
 * Google Fonts, images from data: and blob:), no COOP/COEP (so no SharedArrayBuffer), and a
 * Permissions-Policy that blocks motion sensors. /__artifact is a host page that frames the
 * site with a sandbox like the viewer's. Pass wasm: false to drop 'wasm-unsafe-eval' too.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { brotliCompressSync, constants as zc, gzipSync } from 'node:zlib';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.wasm': 'application/wasm',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.pdf': 'application/pdf',
};
const COMPRESSIBLE = /^(text\/|application\/(json|manifest\+json|xml|javascript)|image\/svg\+xml|image\/x-icon)/;
const HIDDEN = new Set(['/_headers', '/_redirects', '/_routes.json', '/_worker.js']);

/** Parses Cloudflare's _headers format into [{ pattern, host, set: [[name, value]], detach: [name] }]. */
export function parseHeaders(text) {
  const rules = [];
  let cur = null;
  for (const raw of text.split(/\r?\n/)) {
    if (!raw.trim() || raw.trim().startsWith('#')) continue;
    if (!/^\s/.test(raw)) {
      let pattern = raw.trim();
      let host = null;
      const abs = pattern.match(/^https?:\/\/([^/]+)(\/.*)?$/);
      if (abs) {
        host = abs[1];
        pattern = abs[2] || '/';
      }
      cur = { pattern, host, set: [], detach: [] };
      rules.push(cur);
      continue;
    }
    if (!cur) throw new Error(`_headers: header line before any path: ${raw}`);
    const line = raw.trim();
    if (line.startsWith('!')) {
      cur.detach.push(line.slice(1).trim().toLowerCase());
      continue;
    }
    const i = line.indexOf(':');
    if (i < 1) throw new Error(`_headers: malformed line: ${raw}`);
    cur.set.push([line.slice(0, i).trim(), line.slice(i + 1).trim()]);
  }
  return rules;
}

function patternToRegex(pattern, delimiter) {
  let re = '';
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i];
    if (c === '*') re += '(.*)';
    else if (c === ':' && /[A-Za-z_]/.test(pattern[i + 1] ?? '')) {
      let j = i + 1;
      while (j < pattern.length && /\w/.test(pattern[j])) j++;
      re += `([^${delimiter === '/' ? '/' : '.'}]+)`;
      i = j - 1;
    } else re += c.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${re}$`);
}

/** Headers for a path (and host) after applying every matching rule in order. */
export function headersFor(rules, path, host = '127.0.0.1') {
  const out = new Map(); // lower name -> { name, values[] }
  for (const r of rules) {
    if (r.host && !patternToRegex(r.host, '.').test(host)) continue;
    if (!patternToRegex(r.pattern, '/').test(path)) continue;
    for (const d of r.detach) out.delete(d);
    for (const [name, value] of r.set) {
      const k = name.toLowerCase();
      if (!out.has(k)) out.set(k, { name, values: [] });
      out.get(k).values.push(value);
    }
  }
  return [...out.values()].map(({ name, values }) => [name, values.join(', ')]);
}

/** Response headers on the artifact preview host, as far as its published rules describe them. */
export function artifactHeaders({ wasm = true } = {}) {
  const cdns = 'https://cdnjs.cloudflare.com https://cdn.jsdelivr.net https://unpkg.com https://cdn.tailwindcss.com https://code.jquery.com https://cdn.plot.ly';
  return [
    [
      'Content-Security-Policy',
      `default-src 'self'; script-src 'self' 'unsafe-inline'${wasm ? " 'wasm-unsafe-eval'" : ''} ${cdns}; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com; img-src 'self' data: blob:; media-src 'self' data: blob:; connect-src 'self'; worker-src 'self' blob:; frame-src 'self'`,
    ],
    ['Permissions-Policy', 'accelerometer=(), gyroscope=(), magnetometer=(), camera=(), microphone=(), geolocation=()'],
  ];
}

const ARTIFACT_HOST = (src) => `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><title>artifact host</title></head>
<body style="margin:0">
<iframe id="frame" title="preview" src="${src}" sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox" allow="fullscreen; clipboard-write; autoplay" style="border:0;width:100vw;height:100vh;display:block"></iframe>
</body></html>`;

export async function serve({ root = 'dist', port = 4321, host = '127.0.0.1', log = false, mode = 'pages', wasm = true } = {}) {
  const ROOT = resolve(root);
  if (!existsSync(join(ROOT, 'index.html'))) throw new Error(`serve: ${ROOT}/index.html not found; build first`);
  const headersPath = join(ROOT, '_headers');
  const artifact = mode === 'artifact';
  const rules = !artifact && existsSync(headersPath) ? parseHeaders(readFileSync(headersPath, 'utf8')) : [];
  const fixed = artifact ? artifactHeaders({ wasm }) : [];
  const fixedNoWasm = artifact ? artifactHeaders({ wasm: false }) : [];
  const cache = new Map();

  const fileFor = (p) => {
    const abs = normalize(join(ROOT, p));
    if (abs !== ROOT && !abs.startsWith(ROOT + sep)) return null;
    try {
      return statSync(abs).isFile() ? abs : null;
    } catch {
      return null;
    }
  };

  const server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? host}`);
    let path = decodeURIComponent(url.pathname);
    // artifact mode: /__nowasm/... serves the same files under a CSP without 'wasm-unsafe-eval'
    let headerSet = fixed;
    if (artifact && path.startsWith('/__nowasm/')) {
      path = path.slice('/__nowasm'.length);
      headerSet = fixedNoWasm;
    }
    const send = (status, file, extra = {}) => {
      const type = TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream';
      // cached per file, keyed on mtime and size, so a rebuild under a running server is served fresh
      const st = statSync(file);
      let entry = cache.get(file);
      if (!entry || entry.mtime !== st.mtimeMs || entry.size !== st.size) {
        const body = readFileSync(file);
        entry = { body, mtime: st.mtimeMs, size: st.size, etag: `"${createHash('sha1').update(body).digest('hex').slice(0, 20)}"`, br: null, gz: null };
        cache.set(file, entry);
      }
      const hdrs = {
        'Content-Type': type,
        'Access-Control-Allow-Origin': '*',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'public, max-age=0, must-revalidate',
        ETag: entry.etag,
        Vary: 'Accept-Encoding',
        ...extra,
      };
      for (const [k, v] of [...headersFor(rules, path, url.hostname), ...headerSet]) {
        // _headers replaces a default of the same name (that is what Pages does for Cache-Control)
        for (const existing of Object.keys(hdrs)) if (existing.toLowerCase() === k.toLowerCase()) delete hdrs[existing];
        hdrs[k] = v;
      }
      if (status === 200 && req.headers['if-none-match'] === entry.etag) {
        res.writeHead(304, hdrs);
        res.end();
        return;
      }
      let body = entry.body;
      const ae = String(req.headers['accept-encoding'] ?? '');
      if (COMPRESSIBLE.test(type) && body.length > 512) {
        if (/\bbr\b/.test(ae)) {
          entry.br ??= brotliCompressSync(body, { params: { [zc.BROTLI_PARAM_QUALITY]: 9 } });
          body = entry.br;
          hdrs['Content-Encoding'] = 'br';
        } else if (/\bgzip\b/.test(ae)) {
          entry.gz ??= gzipSync(body, { level: 9 });
          body = entry.gz;
          hdrs['Content-Encoding'] = 'gzip';
        }
      }
      hdrs['Content-Length'] = body.length;
      res.writeHead(status, hdrs);
      res.end(req.method === 'HEAD' ? undefined : body);
      if (log) console.log(`${status} ${req.method} ${url.pathname} ${body.length}`);
    };
    const redirect = (to) => {
      res.writeHead(308, { Location: to + url.search });
      res.end();
      if (log) console.log(`308 ${url.pathname} -> ${to}`);
    };

    if (artifact && path === '/__artifact') {
      const src = url.searchParams.get('src') ?? './?view=world&test';
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(ARTIFACT_HOST(src.replace(/"/g, '&quot;')));
      return;
    }
    if (HIDDEN.has(path)) path = '/__hidden__';
    if (path.endsWith('/index.html')) return redirect(path.slice(0, -'index.html'.length));
    if (path.endsWith('.html') && path !== '/404.html') return redirect(path.slice(0, -5));

    const candidates = path.endsWith('/') ? [`${path}index.html`] : [path, `${path}.html`, `${path}/index.html`];
    for (const c of candidates) {
      const f = fileFor(c);
      if (f) {
        if (c === `${path}/index.html`) return redirect(`${path}/`);
        return send(200, f);
      }
    }
    // nearest 404.html up the tree, as Pages does
    const parts = path.split('/').filter(Boolean);
    for (let i = parts.length; i >= 0; i--) {
      const f = fileFor(`/${parts.slice(0, i).join('/')}/404.html`.replace('//', '/'));
      if (f) return send(404, f);
    }
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
  });

  await new Promise((ok, fail) => {
    server.once('error', fail);
    server.listen(port, host, ok);
  });
  const address = server.address();
  return {
    url: `http://${host}:${typeof address === 'object' && address ? address.port : port}/`,
    close: () => new Promise((ok) => server.close(() => ok())),
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const arg = (name, fallback) => {
    const i = process.argv.indexOf(`--${name}`);
    return i > 0 ? process.argv[i + 1] : fallback;
  };
  const s = await serve({
    root: arg('root', 'dist'),
    port: Number(arg('port', process.env.PORT ?? 4321)),
    host: arg('host', '127.0.0.1'),
    log: process.argv.includes('--log'),
    mode: process.argv.includes('--artifact') ? 'artifact' : 'pages',
  });
  console.log(`serving ${arg('root', 'dist')} at ${s.url} with _headers applied`);
}
