/**
 * "Ask my work": BM25 over sentences from Pavan's READMEs. No model and no server. It only
 * returns sentences that exist verbatim in a README, checks that before showing them, and
 * refuses when nothing scores high enough. PlanDesk's rule, applied to this page.
 */
import corpus from '../../generated/corpus.json';

export interface Passage {
  repo: string;
  section: string;
  anchor: string;
  text: string;
}

export interface Hit extends Passage {
  score: number;
  terms: string[];
  verified: boolean;
  url: string;
}

export interface Answer {
  query: string;
  hits: Hit[];
  refused: boolean;
  searched: number;
  readmes: number;
}

const STOP = new Set(
  'a an and are as at be but by can do does did for from had has have how i if in into is it its me my of on or so that the their them then there these they this to was we were what when where which who why will with you your about after again all also am any because been before being both each few further here just more most no nor not now only other our out over own same should some such than too under until up very would could pavan pavans his he work works'.split(
    ' ',
  ),
);

/** Folds word forms together so "refuses", "refused" and "refusal" meet. */
const FOLD: Record<string, string> = {
  refus: 'refus',
  refusal: 'refus',
  abstain: 'abstain',
  abstention: 'abstain',
  abstains: 'abstain',
  duplicat: 'duplic',
  duplicate: 'duplic',
  dedup: 'duplic',
  deduplication: 'duplic',
  retriev: 'retriev',
  retrieval: 'retriev',
  evaluat: 'eval',
  evaluation: 'eval',
  evals: 'eval',
  crash: 'crash',
  crashes: 'crash',
  batching: 'batch',
  batched: 'batch',
  microbatching: 'batch',
};

/** Words a visitor might use that the READMEs say differently. */
const EXPAND: Record<string, string[]> = {
  rag: ['retriev'],
  hallucinat: ['quot', 'verifi', 'refus'],
  injection: ['scope', 'instruction', 'capabil'],
  prompt: ['instruction', 'text'],
  partition: ['minority', 'leader', 'heal'],
  raft: ['leader', 'commit', 'partition'],
  exact: ['verbatim'],
  quote: ['verbatim', 'citation'],
  citation: ['quot', 'cite'],
  speed: ['timing', 'latency'],
  fast: ['timing', 'latency'],
  win: ['correct', 'exhaust'],
  crash: ['exit', 'restart', 'recover'],
  retry: ['redeliver', 'duplic'],
  stale: ['knowledge', 'correction', 'time'],
  leak: ['future', 'observ'],
  drift: ['shift', 'alert'],
  family: ['lineage', 'famili'],
  benchmark: ['leaderboard', 'item'],
};

function stem(w: string): string {
  if (FOLD[w]) return FOLD[w];
  let s = w;
  if (s.length > 5) s = s.replace(/(ations?|ingly|edly|ments?|ings?|ness)$/, '');
  if (s.length > 4) s = s.replace(/(ies)$/, 'y').replace(/(es|ed|ly|s)$/, '');
  return FOLD[s] ?? s;
}

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[’']/g, '')
    .split(/[^a-z0-9.%/@-]+/)
    .flatMap((t) => (/^[0-9.%/]+$/.test(t) ? [t.replace(/\.$/, '')] : t.split(/[.@/-]+/)))
    .filter((t) => t && !STOP.has(t) && (t.length > 1 || /\d/.test(t)))
    .map(stem);
}

const passages = (corpus as { passages: Passage[] }).passages;
const docs = (corpus as { docs: Record<string, { title: string; text: string }> }).docs;

// index
const docTokens = passages.map((p) => tokenize(`${p.text} ${p.text}`).concat(tokenize(`${p.repo} ${p.section}`)));
const df = new Map<string, number>();
for (const toks of docTokens) for (const t of new Set(toks)) df.set(t, (df.get(t) ?? 0) + 1);
const N = passages.length;
const avgLen = docTokens.reduce((a, t) => a + t.length, 0) / N;
const idf = (t: string) => Math.log(1 + (N - (df.get(t) ?? 0) + 0.5) / ((df.get(t) ?? 0) + 0.5));

export function search(query: string, limit = 3): Answer {
  const q = tokenize(query);
  const weights = new Map<string, number>();
  for (const t of q) weights.set(t, Math.max(weights.get(t) ?? 0, 1));
  for (const t of q) for (const [k, extra] of Object.entries(EXPAND)) if (t.startsWith(k)) for (const e of extra) if (!weights.has(e)) weights.set(e, 0.45);

  const k1 = 1.2;
  const b = 0.75;
  const scored: { i: number; score: number; terms: string[]; core: number }[] = [];
  docTokens.forEach((toks, i) => {
    const tf = new Map<string, number>();
    for (const t of toks) tf.set(t, (tf.get(t) ?? 0) + 1);
    let score = 0;
    let core = 0;
    const terms: string[] = [];
    for (const [t, w] of weights) {
      // allow prefix matches for longer words ("verif" finds "verified")
      let f = tf.get(t) ?? 0;
      if (!f && t.length >= 5) for (const [k, v] of tf) if (k.startsWith(t) || t.startsWith(k)) f += k.length >= 5 ? v : 0;
      if (!f) continue;
      const s = idf(t) * ((f * (k1 + 1)) / (f + k1 * (1 - b + (b * toks.length) / avgLen)));
      score += s * w;
      if (w === 1) core += idf(t);
      terms.push(t);
    }
    if (score > 0) scored.push({ i, score, terms, core });
  });
  scored.sort((a, b2) => b2.score - a.score);

  const qIdf = [...weights].filter(([, w]) => w === 1).reduce((a, [t]) => a + idf(t), 0);
  const best = scored[0];
  // refuse unless the best sentence carries a real share of what was asked
  const refused = !best || best.score < 3.2 || (qIdf > 0 && best.core / qIdf < 0.34);

  const hits: Hit[] = [];
  const perRepo = new Map<string, number>();
  if (!refused) {
    for (const s of scored) {
      if (s.score < best.score * 0.42) break;
      const p = passages[s.i];
      if ((perRepo.get(p.repo) ?? 0) >= 2) continue;
      perRepo.set(p.repo, (perRepo.get(p.repo) ?? 0) + 1);
      const verified = docs[p.repo]?.text.includes(p.text) ?? false;
      if (!verified) continue;
      hits.push({
        ...p,
        score: s.score,
        terms: s.terms,
        verified,
        url: `https://github.com/pavan139/${p.repo}${p.anchor ? `#${p.anchor}` : ''}`,
      });
      if (hits.length >= limit) break;
    }
  }
  return { query, hits, refused: refused || !hits.length, searched: N, readmes: Object.keys(docs).length };
}

/** Wraps the words that matched in <mark>. Input is escaped first. */
export function highlight(text: string, terms: string[]): string {
  const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return escaped.replace(/[A-Za-z0-9][A-Za-z0-9.%-]*/g, (word) => {
    const w = stem(word.toLowerCase().replace(/[.%-]+$/, ''));
    const hit = terms.some((t) => w === t || (t.length >= 5 && (w.startsWith(t) || t.startsWith(w)) && w.length >= 5));
    return hit ? `<mark>${word}</mark>` : word;
  });
}
