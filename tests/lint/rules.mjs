/**
 * Copy rules for the built site (v3). tests/lint/content.mjs applies them to every text file
 * in dist/ (HTML, CSS, JS, JSON, the worker), so they cover the classic page, the world
 * chunk, placards, cards and the search corpus alike.
 *
 * The brief: professional. No story, scores, achievements, leaderboards (as a
 * game feature), timers, mascots, puns, emoji or hype words. Research terms stay legal:
 * "Open LLM Leaderboard", "scored 94.3%" and "race condition" are facts, not gimmicks, so the
 * patterns below target the gimmick phrasing only.
 *
 * To accept one specific match, add an ALLOW entry: the rule id, a substring of the reported
 * context, and the reason.
 */

/** Phrases that must never ship, anywhere in dist/ (HTML comments included). */
export const BANNED_COPY = [
  // carried over from v2
  { id: 'sudo-hire', re: /sudo\s+hire/i, why: 'gimmick copy' },
  { id: 'konami', re: /\bkonami\b/i, why: 'game easter egg' },
  { id: 'konami-sequence', re: /ArrowUp\W{1,6}ArrowUp\W{1,6}ArrowDown\W{1,6}ArrowDown/, why: 'the Konami code by another name' },
  { id: 'job-title-hype', re: /\b(?:ninjas?|wizard(?:s|ry)?|rock[\s-]?stars?|gurus?|unicorns?|jedi|superstar)\b|\b10x\s+(?:engineer|developer|dev|programmer)s?\b/i, why: 'hype job-title copy' },
  // game mechanics
  { id: 'score', re: /\b(?:high|best|final|top|your|my)[\s-]scores?\b|\bscore\s*:\s*\d|\bpoints?\s+earned\b|\bbeat\s+(?:my|the|your)\s+(?:score|time|record)\b/i, why: 'no scores' },
  { id: 'achievement', re: /\bachievements?\b|\btrophy\b|\btrophies\b|\bbadges?\s+(?:earned|unlocked)\b|\bunlocked\b|\bcollectibles?\b/i, why: 'no achievements' },
  { id: 'leaderboard-feature', re: /\b(?:global|weekly|daily|our|the\s+site'?s?)\s+leaderboard\b|\btop\s+of\s+the\s+leaderboard\b|\byour\s+rank(?:ing)?\b|\bhall\s+of\s+fame\b/i, why: 'no leaderboards as a feature' },
  { id: 'timer', re: /\bcountdown\b|\bstopwatch\b|\bbest\s+time\b|\blap\s+times?\b|\btime\s+trials?\b|\bspeedrun/i, why: 'no timers or races' },
  { id: 'game-copy', re: /\bgame\s+over\b|\byou\s+(?:win|won|lose|lost)\b|\blevel(?:l?ed|l?ing)?[\s-]up\b|\bplayer\s+(?:one|1)\b|\bpress\s+start\b|\bnew\s+record\b|\bquest\b|\bpower[\s-]?ups?\b/i, why: 'no game copy' },
  { id: 'story', re: /\bonce\s+upon\b|\bour\s+hero\b|\bchapter\s+(?:one|two|three|\d)\b|\bthe\s+adventure\s+begins\b|\bembark\b/i, why: 'no story' },
  { id: 'mascot', re: /\bmascot\b|\bsidekick\b/i, why: 'no mascots' },
  { id: 'bruno-features', re: /\bwhispers?\b|\bhonk\b|\bdrift(?:ing)?\s+the\s+car\b/i, why: 'not a copy of bruno-simon.com' },
  // marble and rolling puns
  {
    id: 'pun',
    re: /\bmarble[\s-]?ous\b|\bon\s+a\s+roll\b|\blet'?s\s+(?:get\s+)?roll(?:ing)?\b|\b(?:lose|lost)\s+(?:your|my|his)\s+marbles\b|\bhave\s+a\s+ball\b|\bball'?s\s+in\s+your\s+court\b|\brock\s+and\s+roll\b|\bkeep\s+(?:it\s+)?rolling\b|\bready\s+to\s+roll\b/i,
    why: 'no puns',
  },
  // hype words
  {
    id: 'hype',
    re: /\brevolutionar(?:y|ize)\b|\bcutting[\s-]edge\b|\bgame[\s-]?chang(?:ing|er)\b|\bblazing(?:ly)?[\s-]fast\b|\bworld[\s-]class\b|\bnext[\s-]gen(?:eration)?\b|\bmind[\s-]?blowing\b|\bsupercharg(?:e|ed|ing)\b|\bunleash(?:es|ed|ing)?\b|\bgroundbreaking\b|\bstate[\s-]of[\s-]the[\s-]art\b|\bawesome\b|\binsanely\b|\bepic\b|\bbest[\s-]in[\s-]class\b|\bdisrupt(?:ive|ing)?\b|\bsynerg(?:y|ies)\b|\bcrushing\s+it\b|\bpassionate\s+about\b|\bmagic(?:al)?\b/i,
    why: 'no hype words',
  },
];

/**
 * Truth rules from the brief. `re` fails anywhere. `anchor` + `near` fails when both occur
 * in the same sentence (or string literal), unless `unless` also occurs there.
 */
export const TRUTH_RULES = [
  { id: 'phone-link', re: /\btel:/i, why: 'no phone number, ever' },
  { id: 'phone-jsonld', re: /"telephone"\s*:/i, why: 'no phone number in structured data' },
  { id: 'exactly-once', re: /exactly[\s-]+once/i, why: 'never claim exactly-once, even negated' },
  {
    id: 'temporal-rag-generation',
    anchor: /temporal-rag/i,
    near: /\bgenerat(?:ion|es|ive|ed|or|ing)\b/i,
    unless: /\b(?:no|not|without|never)\b[^.]{0,30}generat/i,
    why: 'temporal-rag is retrieval; never call it generation',
  },
  {
    id: 'servegate-speed',
    anchor: /servegate/i,
    near: /\bfaster\b|\bspeed[\s-]?ups?\b|\blatency\b|\bthroughput\b|\bquicker\b|\bmilliseconds?\b|\b\d+(?:\.\d+)?\s?ms\b|\b\d+(?:\.\d+)?x\b|\btimes as fast\b/i,
    unless: /no speed claim|not a speed claim|call counts only/i,
    why: 'no speed claim for servegate',
  },
  {
    id: 'recall-one-as-win',
    anchor: /\brecall(?:@\d+)?\b/i,
    near: /\b1\.0{1,2}\b/,
    unless: /exhaustive|not a win|is it a win|a win\?/i,
    why: '1.00 recall is exhaustive search, never a win',
  },
  { id: 'commit-history', re: /\bcommit\s+history\b|\b\d[\d,]*\s+commits\b/i, why: 'no claims about commit history' },
  {
    id: 'time-spent',
    re: /\b(?:spent|took(?:\s+me)?|built\s+(?:it\s+)?in|in\s+just|over\s+the\s+(?:past|last))\s+(?:about\s+|nearly\s+|almost\s+|only\s+)?\d+\s+(?:hours|days|weeks|months|years)\b/i,
    why: 'no claims about how long anything took',
  },
  {
    id: 'invented-proof',
    re: /\btestimonials?\b|\baward[\s-]winning\b|\btrusted\s+by\b|\b\d[\d,.]*\s*[kKmM]?\+?\s+(?:happy\s+)?(?:users|customers|downloads|installs)\b|\b\d[\d,.]*\s*[kK]?\+?\s+(?:github\s+)?stars\b/i,
    why: 'no invented users, testimonials, awards or metrics',
  },
];

/** Matches that are fine, with the reason. `context` must be a substring of the reported context. */
export const ALLOW = [
  // { rule: 'hype', context: '...', why: '...' },
];

/**
 * Emoji in visible copy. Extended_Pictographic catches emoji that render as text by default
 * too (they turn into emoji on iOS); the three ordinary typographic marks are allowed unless
 * an emoji variation selector follows them.
 */
export const TYPOGRAPHIC_OK = new Set(['©', '®', '™']);
export const EMOJI = /\p{Extended_Pictographic}️?|️|⃣|[\u{1F1E6}-\u{1F1FF}]/gu;
