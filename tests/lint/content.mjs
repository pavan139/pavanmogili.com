#!/usr/bin/env node
/**
 * Content lint for dist/: banned copy and emoji, the truth rules, JSON-LD, head and Open
 * Graph, in-page anchors, CSP hazards in the HTML, and files that must not ship.
 *
 *   node tests/lint/content.mjs [--dist dist] [--strict]
 *   import { lintContent } from './content.mjs'; const { errors, warnings } = await lintContent();
 *
 * Errors always fail. Warnings fail only with --strict (npm run check is strict; the
 * postbuild step after `npm run build` is not, so a missing OG image does not block a
 * local build).
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { ALLOW, BANNED_COPY, EMOJI, TRUTH_RULES, TYPOGRAPHIC_OK } from './rules.mjs';

const TEXT = new Set(['.html', '.js', '.mjs', '.css', '.json', '.webmanifest', '.txt', '.xml', '.svg']);

function walk(dir, out = []) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

const clip = (s, i, len, pad = 50) =>
  s
    .slice(Math.max(0, i - pad), Math.min(s.length, i + len + pad))
    .replace(/\s+/g, ' ')
    .trim();

/** Sentences and string literals: the unit within which "anchor near term" is judged. */
const segments = (text) => text.split(/(?<=[.!?])\s+|["'`{};<>]|\\n|\\"/);

export function imageSize(file) {
  const b = readFileSync(file);
  if (b.length > 24 && b.readUInt32BE(0) === 0x89504e47) return { type: 'png', width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
  if (b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i < b.length) {
      if (b[i] !== 0xff) return null;
      const m = b[i + 1];
      const len = b.readUInt16BE(i + 2);
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return { type: 'jpeg', height: b.readUInt16BE(i + 5), width: b.readUInt16BE(i + 7) };
      i += 2 + len;
    }
  }
  if (b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') {
    const kind = b.toString('ascii', 12, 16);
    if (kind === 'VP8X') return { type: 'webp', width: 1 + b.readUIntLE(24, 3), height: 1 + b.readUIntLE(27, 3) };
    if (kind === 'VP8 ') return { type: 'webp', width: b.readUInt16LE(26) & 0x3fff, height: b.readUInt16LE(28) & 0x3fff };
    if (kind === 'VP8L') {
      const n = b.readUInt32LE(21);
      return { type: 'webp', width: (n & 0x3fff) + 1, height: ((n >> 14) & 0x3fff) + 1 };
    }
  }
  return null;
}

export async function lintContent({ dist = 'dist', strict = false, root = '.' } = {}) {
  const DIST = resolve(root, dist);
  const errors = [];
  const warnings = [];
  const err = (rule, msg) => errors.push(`[${rule}] ${msg}`);
  const warn = (rule, msg) => warnings.push(`[${rule}] ${msg}`);
  const allowed = (rule, context) => ALLOW.some((a) => a.rule === rule && context.includes(a.context));

  if (!existsSync(join(DIST, 'index.html'))) {
    err('dist', `${DIST}/index.html not found; build first`);
    return { errors, warnings };
  }

  let content = null;
  try {
    content = await import(pathToFileURL(resolve(root, 'src/content.ts')).href);
  } catch (e) {
    warn('content', `could not import src/content.ts (${e.message.split('\n')[0]}); skipping the checks against it`);
  }

  const files = walk(DIST);

  // ------------------------------------------------------------------------------------
  // Files that must not ship
  // ------------------------------------------------------------------------------------
  for (const f of files) {
    const rel = relative(DIST, f);
    if (/\.map$/.test(rel) || rel.startsWith('.vite') || /(^|\/)\.(env|DS_Store)/.test(rel)) err('ship', `${rel} must not be in dist/`);
  }

  // ------------------------------------------------------------------------------------
  // Banned copy, emoji and truth rules, over every text file
  // ------------------------------------------------------------------------------------
  const seen = new Set();
  const report = (rule, rel, ctx, why) => {
    if (allowed(rule, ctx)) return;
    const key = `${rule}|${ctx}`;
    if (seen.has(key)) return;
    seen.add(key);
    err(rule, `${rel}: "${ctx}"${why ? ` (${why})` : ''}`);
  };

  for (const f of files) {
    const ext = extname(f).toLowerCase();
    if (!TEXT.has(ext)) continue;
    const rel = relative(DIST, f);
    const raw = readFileSync(f, 'utf8');

    for (const rule of BANNED_COPY) {
      const re = new RegExp(rule.re.source, rule.re.flags.includes('g') ? rule.re.flags : rule.re.flags + 'g');
      for (const m of raw.matchAll(re)) report(rule.id, rel, clip(raw, m.index, m[0].length), rule.why);
    }

    // emoji: visible copy only, so HTML comments are skipped (they are covered above)
    const visible = ext === '.html' ? raw.replace(/<!--[\s\S]*?-->/g, ' ') : raw;
    for (const m of visible.matchAll(EMOJI)) {
      const ch = m[0];
      if (TYPOGRAPHIC_OK.has(ch)) continue;
      const cp = [...ch].map((c) => `U+${c.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')}`).join(' ');
      report('emoji', rel, clip(visible, m.index, ch.length, 30), `emoji ${ch} (${cp}) in visible copy; use an SVG icon or plain text`);
    }

    for (const rule of TRUTH_RULES) {
      if (rule.re) {
        const re = new RegExp(rule.re.source, rule.re.flags.includes('g') ? rule.re.flags : rule.re.flags + 'g');
        for (const m of raw.matchAll(re)) report(rule.id, rel, clip(raw, m.index, m[0].length), rule.why);
      } else {
        if (!rule.anchor.test(raw)) continue;
        for (const s of segments(raw)) {
          if (rule.anchor.test(s) && rule.near.test(s) && !(rule.unless && rule.unless.test(s))) report(rule.id, rel, s.replace(/\s+/g, ' ').trim().slice(0, 220), rule.why);
        }
      }
    }

    if (content && content.toggles && !content.toggles.showDoctorate && /Cumberlands|doctoral/i.test(raw)) {
      const m = raw.match(/Cumberlands|doctoral/i);
      report('doctorate', rel, clip(raw, m.index, m[0].length), 'toggles.showDoctorate is off');
    }
  }

  // ------------------------------------------------------------------------------------
  // The HTML pages
  // ------------------------------------------------------------------------------------
  const html = readFileSync(join(DIST, 'index.html'), 'utf8');
  const noComments = html.replace(/<!--[\s\S]*?-->/g, '');
  const attr = (tag, name) => {
    const m = tag.match(new RegExp(`\\s${name}\\s*=\\s*"([^"]*)"`, 'i'));
    return m ? m[1] : null;
  };
  const meta = (key) => {
    for (const m of noComments.matchAll(/<meta\b[^>]*>/gi)) {
      if (attr(m[0], 'name') === key || attr(m[0], 'property') === key) return attr(m[0], 'content');
    }
    return null;
  };
  const link = (rel) => {
    for (const m of noComments.matchAll(/<link\b[^>]*>/gi)) if ((attr(m[0], 'rel') ?? '').split(/\s+/).includes(rel)) return attr(m[0], 'href');
    return null;
  };

  // CSP hazards: inline handlers, inline styles, inline executable scripts
  for (const page of files.filter((f) => f.endsWith('.html'))) {
    const rel = relative(DIST, page);
    const src = readFileSync(page, 'utf8').replace(/<!--[\s\S]*?-->/g, '');
    for (const m of src.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
      const type = attr(`<x ${m[1]}>`, 'type');
      if (!/\bsrc\s*=/.test(m[1]) && type !== 'application/ld+json' && m[2].trim()) err('csp', `${rel}: inline <script> would be blocked by script-src 'self'`);
    }
    for (const m of src.matchAll(/<[a-z][^>]*\sstyle\s*=\s*"[^"]*"[^>]*>/gi)) err('csp', `${rel}: inline style attribute would be blocked by style-src 'self': ${m[0].slice(0, 90)}`);
    for (const m of src.matchAll(/<[a-z][^>]*\son[a-z]+\s*=\s*"[^"]*"/gi)) err('csp', `${rel}: inline event handler: ${m[0].slice(0, 90)}`);
    if (/<style\b/i.test(src)) err('csp', `${rel}: <style> element would be blocked by style-src 'self'`);
  }

  // In-page anchors
  const ids = new Set([...noComments.matchAll(/\sid\s*=\s*"([^"]+)"/g)].map((m) => m[1]));
  for (const m of noComments.matchAll(/\shref\s*=\s*"#([^"]*)"/g)) {
    const id = decodeURIComponent(m[1]);
    if (id && !ids.has(id)) err('anchor', `href="#${id}" has no element with id="${id}" (no-JS visitors and crawlers land nowhere)`);
  }

  // Document basics
  if (!/<html\b[^>]*\slang="en"/i.test(html)) err('head', '<html lang="en"> missing');
  const h1s = noComments.match(/<h1\b/gi) ?? [];
  if (h1s.length !== 1) err('head', `expected exactly one <h1>, found ${h1s.length}`);
  const viewport = meta('viewport') ?? '';
  if (!viewport) err('head', 'meta viewport missing');
  if (/user-scalable\s*=\s*(no|0)|maximum-scale\s*=\s*(1(\.0)?|[0-4](\.\d+)?)\b/i.test(viewport)) err('head', `meta viewport blocks zoom: "${viewport}" (WCAG 1.4.4)`);
  const title = (noComments.match(/<title>([^<]*)<\/title>/i) ?? [])[1] ?? '';
  if (!title) err('head', '<title> missing');
  else if (title.length > 65) warn('head', `title is ${title.length} characters; search results cut at about 60: "${title}"`);
  const description = meta('description') ?? '';
  if (!description) err('head', 'meta description missing');
  else if (description.length < 70 || description.length > 160) warn('head', `meta description is ${description.length} characters (70 to 160 reads best)`);

  // Canonical, OG and Twitter agree with each other and with content.ts
  const canonical = link('canonical');
  const ogUrl = meta('og:url');
  const siteUrl = content?.site?.url ?? canonical;
  if (!canonical) err('head', 'link rel=canonical missing');
  if (canonical !== siteUrl) err('head', `canonical ${canonical} differs from content.ts site.url ${siteUrl}`);
  if (ogUrl !== siteUrl) err('head', `og:url ${ogUrl} differs from ${siteUrl}`);
  for (const k of ['og:title', 'og:description', 'og:image', 'og:image:alt', 'twitter:card']) if (!meta(k)) err('head', `${k} missing`);
  if (meta('twitter:card') && meta('twitter:card') !== 'summary_large_image') warn('head', `twitter:card is ${meta('twitter:card')}`);
  const ogImage = meta('og:image');
  if (ogImage) {
    if (!/^https:\/\//.test(ogImage)) err('head', `og:image must be an absolute https URL: ${ogImage}`);
    const path = ogImage.startsWith(siteUrl) ? ogImage.slice(siteUrl.length) : null;
    const file = path ? join(DIST, path) : null;
    if (!file || !existsSync(file)) (strict ? err : warn)('og-image', `og:image ${ogImage} is not in dist/ (expected ${path ? `dist/${path}` : 'a URL under ' + siteUrl})`);
    else {
      const size = imageSize(file);
      const w = Number(meta('og:image:width'));
      const h = Number(meta('og:image:height'));
      if (!size) err('og-image', `${path}: unreadable image`);
      else if ((w && size.width !== w) || (h && size.height !== h)) err('og-image', `${path} is ${size.width}x${size.height}, meta says ${w}x${h}`);
      else if (size.width < 1200 || size.height < 630) warn('og-image', `${path} is ${size.width}x${size.height}; 1200x630 is the safe size`);
      if (statSync(file).size > 1024 * 1024) warn('og-image', `${path} is ${(statSync(file).size / 1024).toFixed(0)} KB; keep it under 1 MB`);
    }
  }

  // JSON-LD
  const blocks = [...noComments.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]);
  if (!blocks.length) err('jsonld', 'no JSON-LD block');
  const nodes = [];
  for (const [i, b] of blocks.entries()) {
    let data;
    try {
      data = JSON.parse(b);
    } catch (e) {
      err('jsonld', `block ${i + 1} is not valid JSON: ${e.message}`);
      continue;
    }
    if (data['@context'] !== 'https://schema.org') err('jsonld', `block ${i + 1}: @context should be "https://schema.org"`);
    nodes.push(...(Array.isArray(data['@graph']) ? data['@graph'] : [data]));
  }
  const byId = new Map(nodes.filter((n) => n['@id']).map((n) => [n['@id'], n]));
  const refs = [];
  (function collect(v) {
    if (Array.isArray(v)) v.forEach(collect);
    else if (v && typeof v === 'object') {
      if (Object.keys(v).length === 1 && v['@id']) refs.push(v['@id']);
      Object.values(v).forEach(collect);
    }
  })(nodes);
  for (const r of refs) if (!byId.has(r)) err('jsonld', `@id reference ${r} does not resolve inside the graph`);
  const person = nodes.find((n) => n['@type'] === 'Person');
  const profile = nodes.find((n) => n['@type'] === 'ProfilePage');
  const website = nodes.find((n) => n['@type'] === 'WebSite');
  if (!person) err('jsonld', 'no Person node');
  if (!profile) err('jsonld', 'no ProfilePage node');
  if (profile && person && profile.mainEntity?.['@id'] !== person['@id']) err('jsonld', 'ProfilePage.mainEntity must point at the Person');
  if (profile && !/^\d{4}-\d{2}-\d{2}/.test(profile.dateModified ?? '')) err('jsonld', 'ProfilePage.dateModified should be an ISO date');
  if (website && website.url !== siteUrl) err('jsonld', `WebSite.url ${website.url} differs from ${siteUrl}`);
  if (person) {
    if ('telephone' in person) err('jsonld', 'Person.telephone must not exist');
    if (person.worksFor?.name !== 'Fidelity Investments') err('jsonld', 'Person.worksFor should be Fidelity Investments');
    if (person.url !== siteUrl) err('jsonld', `Person.url ${person.url} differs from ${siteUrl}`);
    if (content?.person) {
      const p = content.person;
      if (person.name !== p.name) err('jsonld', `Person.name "${person.name}" differs from content.ts "${p.name}"`);
      if (person.jobTitle !== p.jobTitle) err('jsonld', `Person.jobTitle "${person.jobTitle}" differs from content.ts jobTitle "${p.jobTitle}"`);
      if (person.email && person.email !== `mailto:${p.email}`) err('jsonld', `Person.email ${person.email} differs from mailto:${p.email}`);
      for (const u of Object.values(p.links ?? {})) if (!(person.sameAs ?? []).includes(u)) err('jsonld', `Person.sameAs is missing ${u}`);
    }
    for (const u of person.sameAs ?? []) if (!/^https:\/\//.test(u)) err('jsonld', `sameAs must be https URLs: ${u}`);
    if (person.image) {
      const path = String(person.image).startsWith(siteUrl) ? String(person.image).slice(siteUrl.length) : null;
      if (!path || !existsSync(join(DIST, path))) err('jsonld', `Person.image ${person.image} is not in dist/`);
      else {
        const s = imageSize(join(DIST, path));
        if (!s || s.width < 112 || s.height < 112) err('jsonld', `Person.image ${path} must be at least 112x112`);
      }
    }
  }

  // Phone-number-like strings in the visible text of the page
  const visibleText = noComments
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ');
  for (const m of visibleText.matchAll(/(?:\+?\d{1,2}[\s.-]?)?\(?\b\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}\b/g)) report('phone', 'index.html', clip(visibleText, m.index, m[0].length), 'looks like a phone number');

  return { errors, warnings };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const i = process.argv.indexOf('--dist');
  const strict = process.argv.includes('--strict');
  const { errors, warnings } = await lintContent({ dist: i > 0 ? process.argv[i + 1] : 'dist', strict });
  for (const w of warnings) console.log(`  warn  ${w}`);
  for (const e of errors) console.log(`  FAIL  ${e}`);
  const fail = errors.length || (strict && warnings.length);
  console.log(fail ? `content: ${errors.length} errors, ${warnings.length} warnings` : `content: OK (${warnings.length} warnings)`);
  process.exit(fail ? 1 : 0);
}
