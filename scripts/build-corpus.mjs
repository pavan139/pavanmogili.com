#!/usr/bin/env node
/**
 * Builds src/generated/corpus.json for "Ask my work".
 *
 * Input: sources/readmes/<repo>.md, fetched from GitHub with
 *   gh api repos/pavan139/<repo>/readme --jq .content | base64 -d
 * Output: sentences with their repo and section, plus each README as plain text so the
 * browser can check every quote verbatim.
 *
 * Claims listed in the deep review's "README claims that did not reproduce" table are
 * dropped here, so the search can never quote them.
 */
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'sources', 'readmes');
const OUT = join(ROOT, 'src', 'generated', 'corpus.json');

/** The profile README is not a project README and carries a job title; leave it out. */
const SKIP = new Set(['pavan139']);

/** Sentences matching any of these are never indexed. */
const EXCLUDE = [
  /82\.9%/, // plandesk "first run" number, not committed (did not reproduce)
  /2024-edition page for a 2025 question/, // plandesk, only partly reproduced
  /9\.4288|13\.7142|batched run was slower/i, // servegate single-run timing, direction unstable
  /292\.9|204\.3|109\.8/, // speculative-decoding absolute timings, machine-specific
  /times faster/i,
  /bitwise-identical|bitwise-equivalent|has 40 tests|\*\*40\*\* tests/i, // tool-calling-lab, not CI-verified
  /exactly[- ]once/i, // never claim it, even negated
  /leaderboard_old\.pkl/, // count-lineages doc contradiction
  /--seed 300/, // agent-arena reproduce command
  /Recall@\d+ of 1\.0\b/, // hard-negative-retrieval: a saturated 1.0 recall must never read as a win (PERF truth gate)
];

function plain(md) {
  return md
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[!\[[^\]]*\]\([^)]*\)\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*\s][^*]*)\*/g, '$1')
    .replace(/<[^>]+>/g, ' ');
}

const ABBR = /\b(?:Pub|vs|e\.g|i\.e|etc|U\.S|No|Fig|approx|al)\.$/;

function sentences(par) {
  const out = [];
  let cur = '';
  const parts = par.split(/(?<=[.!?])\s+(?=["“(A-Z0-9])/);
  for (const p of parts) {
    cur = cur ? `${cur} ${p}` : p;
    if (ABBR.test(cur)) continue;
    out.push(cur.trim());
    cur = '';
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

function anchor(heading) {
  return heading
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .trim()
    .replace(/\s/g, '-');
}

const files = readdirSync(SRC).filter((f) => f.endsWith('.md'));
const passages = [];
const docs = {};
let dropped = 0;

for (const file of files.sort()) {
  const repo = file.replace(/\.md$/, '');
  if (SKIP.has(repo)) continue;
  const md = readFileSync(join(SRC, file), 'utf8');
  const text = plain(md);
  const lines = text.split('\n');
  let section = '';
  let title = repo;
  const paragraphs = [];
  let buf = [];
  const flush = () => {
    if (buf.length) paragraphs.push({ section, text: buf.join(' ').replace(/\s+/g, ' ').trim(), top: !section });
    buf = [];
  };
  for (const raw of lines) {
    const line = raw.trim();
    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) {
      flush();
      if (h[1].length === 1) title = h[2].trim();
      else section = h[2].trim();
      continue;
    }
    if (line.startsWith('|')) {
      flush();
      // at-a-glance rows: "| Problem | sentence |" -> keep the sentence cell
      const cells = line.split('|').map((c) => c.trim()).filter(Boolean);
      if (cells.length === 2 && /^(Problem|Result)$/.test(cells[0]) && /[a-z]/.test(cells[1])) {
        paragraphs.push({ section: cells[0], text: cells[1], top: true });
      }
      continue;
    }
    if (!line) {
      flush();
      continue;
    }
    if (/^[-*]\s+/.test(line)) {
      flush();
      buf.push(line.replace(/^[-*]\s+/, ''));
      flush();
      continue;
    }
    if (/^(sequenceDiagram|flowchart|participant|Note over)/.test(line)) continue;
    buf.push(line);
  }
  flush();

  // the plain text the browser verifies quotes against
  const doc = paragraphs.map((p) => p.text).join('\n');
  docs[repo] = { title, text: doc };

  for (const p of paragraphs) {
    for (const s of sentences(p.text)) {
      if (s.length < 28 || s.length > 420) continue;
      if (!/[a-z]{3}/.test(s)) continue;
      if (/^(python|pip|go|curl|make|uv|PYTHONPATH|RUN_ML_SMOKE)\b/.test(s)) continue;
      if (EXCLUDE.some((re) => re.test(s))) {
        dropped++;
        continue;
      }
      if (!doc.includes(s)) continue;
      passages.push({ repo, section: p.top ? title : p.section, anchor: p.top ? '' : anchor(p.section), text: s });
    }
  }
}

// docs only need to contain the kept sentences' paragraphs; drop excluded sentences from them
for (const repo of Object.keys(docs)) {
  let t = docs[repo].text;
  for (const re of EXCLUDE) {
    t = t
      .split('\n')
      .map((par) =>
        sentences(par)
          .filter((s) => !re.test(s))
          .join(' '),
      )
      .join('\n');
  }
  docs[repo].text = t;
}
const kept = passages.filter((p) => docs[p.repo].text.includes(p.text));

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify({ built: new Date().toISOString().slice(0, 10), passages: kept, docs }));
console.log(`corpus: ${kept.length} sentences from ${Object.keys(docs).length} READMEs (${dropped} excluded claims) -> ${OUT}`);
