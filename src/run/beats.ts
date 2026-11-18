/**
 * The stops along the request's path: what the panel says at each one, and how the camera
 * frames it. Every figure and caveat comes from src/content.ts (the exhibits list).
 */
import { exhibits, path, person, turtledove } from '../content';
import { ROW_Z, S, rowAt } from './track';

export interface Built {
  name: string;
  line: string;
  figure: string;
  figureText: string;
  caveat: string;
  links: { label: string; href: string }[];
}
export interface Beat {
  id: string;
  /** distance along the path where the marble stops */
  s: number;
  district: number;
  kicker: string;
  title: string;
  body: string;
  built?: Built;
  /** look-at point, and the width and depth of table that must fit on screen */
  cam: { x: number; z: number; w: number; d: number; pitch?: number };
  end?: boolean;
}

export const DISTRICTS = ['Request', 'Retrieval', 'Inference', 'Agents and tools', 'Evaluation', 'Product', 'Response'];

const ex = (id: string, line?: string): Built => {
  const e = exhibits.find((x) => x.id === id)!;
  return { name: e.name, line: line ?? e.line, figure: e.figure, figureText: e.figureText, caveat: e.caveat, links: e.links };
};

const fidelity = path.find((p) => p.org.startsWith('Fidelity'))!;

export const beats: Beat[] = [
  {
    id: 'start',
    s: S(1, -30.5),
    district: 0,
    kicker: 'The request',
    title: 'One request, start to finish',
    body: 'This table is the system around a language model. The blue marble is one request. Each stop is one part of that system, at work.',
    cam: { x: -27.5, z: 20.2, w: 12, d: 8 },
  },
  {
    id: 'rag-ask',
    s: S(1, -23),
    district: 1,
    kicker: '01 Retrieval (RAG)',
    title: 'Look it up before answering',
    body: 'A model on its own answers from memory. Retrieval-augmented generation makes it look the answer up first. This request is a question about a 2024 retirement-plan rule, so it may go on. The grey one asks about 2030. No edition covers that, so it is refused before anything is retrieved.',
    cam: { x: -25.2, z: 19.6, w: 11, d: 7 },
  },
  {
    id: 'rag-find',
    s: S(1, -13.6),
    district: 1,
    kicker: '01 Retrieval (RAG)',
    title: 'Find the pages',
    body: 'Search runs over six volumes: three IRS publications, 2024 and 2025 editions. The few pages most likely to hold the answer leave the shelf and travel with the question. That is its context: the only text the answer may come from.',
    cam: { x: -15, z: 18.2, w: 13.5, d: 8 },
  },
  {
    id: 'rag-cite',
    s: S(1, -5.2),
    district: 1,
    kicker: '01 Retrieval (RAG)',
    title: 'Cite it, or refuse',
    body: 'At the gate the answer has to point at a page. These pages check out, so the request passes with its citations. Had the publications not said, the answer would be a refusal.',
    built: ex('plandesk'),
    cam: { x: -7.6, z: 19.6, w: 10.5, d: 7.5 },
  },
  {
    id: 'time-then',
    s: S(1, 10),
    district: 1,
    kicker: '01 Retrieval (RAG)',
    title: 'Facts change',
    body: 'Retrieval also has to know when. The rail is a calendar, and where the marble stands is when the question is asked. Who owned Atlas on February 15? Asked that day, the record on file says Ben.',
    cam: { x: 10.2, z: 18.6, w: 16.5, d: 7.5 },
  },
  {
    id: 'time-now',
    s: S(1, 15),
    district: 1,
    kicker: '01 Retrieval (RAG)',
    title: 'Same question, asked later',
    body: 'In March a correction is recorded: it was Cora. Ask the same question now and the answer is Cora. Ben’s record stays on file, so you can still see what was known that day.',
    built: ex('temporal-rag'),
    cam: { x: 10.2, z: 18.6, w: 16.5, d: 7.5 },
  },
  {
    id: 'batch-wait',
    s: S(2, 17.55),
    district: 2,
    kicker: '02 Inference',
    title: 'Requests arrive one at a time',
    body: 'Running the model once per request wastes it. So a gateway holds each request for a moment while others arrive. This one takes the eighth place in the queue.',
    cam: { x: 13.6, z: 6.0, w: 13.5, d: 9 },
  },
  {
    id: 'batch-go',
    s: S(2, 8.3),
    district: 2,
    kicker: '02 Inference',
    title: 'Eight requests, one call',
    body: 'The gate opens and all eight go in together: one run of the model where there would have been eight. Behind the gate, the same eight requests are served both ways on a loop. Count how often each press comes down.',
    built: ex('servegate'),
    cam: { x: 10.4, z: 3.6, w: 15, d: 10.5 },
  },
  {
    id: 'model',
    s: S(2, 0),
    district: 2,
    kicker: '02 Inference',
    title: 'The model',
    body: `Sealed, on purpose. ${person.thesis.join(' ')} What it gets to read, how it is served, what it is allowed to touch and how its work is checked: that is the rest of this table.`,
    cam: { x: 0, z: 0.5, w: 46, d: 34, pitch: 44 },
  },
  {
    id: 'spec-draft',
    s: S(2, -6.5),
    district: 2,
    kicker: '02 Inference',
    title: 'Guess ahead',
    body: 'The answer comes out one token at a time, and every token costs a run of the big model. So a small draft model runs ahead and guesses the next four.',
    cam: { x: -9.6, z: 5.3, w: 11, d: 6.5 },
  },
  {
    id: 'spec-verify',
    s: S(2, -12.4),
    district: 2,
    kicker: '02 Inference',
    title: 'Verify in order',
    body: 'The big model checks the guesses in order. It keeps the ones it agrees with, and replaces the first one it rejects with its own token. Three guesses kept here, the fourth replaced.',
    cam: { x: -10.6, z: 5.3, w: 11.5, d: 6.5 },
  },
  {
    id: 'spec-bonus',
    s: S(2, -19.6),
    district: 2,
    kicker: '02 Inference',
    title: 'Same answer, fewer big steps',
    body: 'When all four guesses are kept, the big model adds one more token of its own. The output follows exactly the big model’s distribution: the draft only saves it steps.',
    built: ex('speculative-decoding'),
    cam: { x: -16.6, z: 5.3, w: 11, d: 6.5 },
  },
  {
    id: 'cap-issue',
    s: S(3, -18.2),
    district: 3,
    kicker: '03 Agents and tools',
    title: 'The model can ask. It cannot decide.',
    body: 'An agent acts by calling tools, and text can be talked into anything. So permission never comes from the text. The issuer hands this request a signed capability: one resource, one use.',
    cam: { x: -18.4, z: -8, w: 10, d: 7.5 },
  },
  {
    id: 'cap-door',
    s: S(3, -7.4),
    district: 3,
    kicker: '03 Agents and tools',
    title: 'One door, once',
    body: 'The capability opens the door it was issued for, and is spent: the door has shut again. The grey request tries the other door with a copy, and that door never opens.',
    built: ex('capability-guard'),
    cam: { x: -11, z: -8.4, w: 12, d: 8.5 },
  },
  {
    id: 'agent-loop',
    s: S(3, -1.6),
    district: 3,
    kicker: '03 Agents and tools',
    title: 'An agent is a loop',
    body: 'The model asks for a tool. The request is checked. The tool runs. The result goes back to the model, which decides what to do next, and round it goes until the task is done. The stops on either side guard this loop: who may call what, and what happens when a call fails halfway.',
    cam: { x: -1.6, z: -10.6, w: 11.5, d: 8 },
  },
  {
    id: 'crash-commit',
    s: S(3, 7.4),
    district: 3,
    kicker: '03 Agents and tools',
    title: 'A tool call that moves money',
    body: 'The sender posts a credit. The receiver commits it: one tile on the ledger. Then the sender crashes, before it has recorded that the credit landed.',
    cam: { x: 9.4, z: -10.2, w: 15, d: 7.5 },
  },
  {
    id: 'crash-retry',
    s: S(3, 16),
    district: 3,
    kicker: '03 Agents and tools',
    title: 'Crash, retry, no double',
    body: 'Back up, the sender does the safe thing and sends the message again. The receiver has seen it before, so the credit is not applied a second time. The ledger still holds one.',
    built: ex('resilient-agent-runtime'),
    cam: { x: 9.6, z: -10.2, w: 15, d: 7.5 },
  },
  {
    id: 'eval-plant',
    s: S(4, 17),
    district: 4,
    kicker: '04 Evaluation',
    title: 'Break it on purpose',
    body: 'A release gate decides whether a change to an agent may ship. To test the gate itself, plant faults on purpose and see whether it notices. The board holds 128 planted faults of eight types, and the bar is the gate’s checks sweeping across them.',
    cam: { x: 15.7, z: -24, w: 12.5, d: 8.5 },
  },
  {
    id: 'eval-gate',
    s: S(4, 8.3),
    district: 4,
    kicker: '04 Evaluation',
    title: 'A gate you can trust',
    body: 'All 128 are caught, so the gate has earned its place in front of a release. A gate that misses planted faults will miss real ones.',
    built: {
      name: 'agent-regression',
      line: 'A release gate for agents that grades outputs and execution traces against independent oracles.',
      figure: '128/128',
      figureText: 'injected faults caught across 8 fault types, on a deterministic fixture agent.',
      caveat: 'A deterministic fixture agent: this measures the gate, not the quality of a model.',
      links: [{ label: 'Repository', href: 'https://github.com/pavan139/agent-regression' }],
    },
    cam: { x: 12.4, z: -24, w: 13.5, d: 8.5 },
  },
  {
    id: 'lineage',
    s: S(4, -3),
    district: 4,
    kicker: '04 Evaluation',
    title: 'Count lineages, not checkpoints',
    body: 'Benchmark analyses treat every leaderboard model as an independent test-taker. Most are built on a base model shared with many others. Pull one family out of these 1,151 and it takes 332 with it. The evidence is thinner than the head count suggests.',
    built: ex('count-lineages', 'Research: item-level analyses of LLM benchmarks treat every leaderboard model as independent. Most share a base model with many others.'),
    cam: { x: -0.4, z: -24.6, w: 14.5, d: 8.5 },
  },
  {
    id: 'mcp',
    s: S(4, -10.25),
    district: 5,
    kicker: '05 Product',
    title: 'How a model reaches an app: MCP',
    body: 'The Model Context Protocol is a standard plug between AI assistants and other software. The app runs a server. The assistant’s client first asks what tools the server has, and gets a list: each tool has a name and the inputs it takes. Then it calls one. The model never reaches into the app itself.',
    cam: { x: -10.2, z: -24.1, w: 9.5, d: 8 },
  },
  {
    id: 'product',
    s: S(4, -16.4),
    district: 5,
    kicker: '05 Product',
    title: 'In someone’s hands',
    body: 'Turtledove is a planner for two, in closed beta on iOS. Its MCP server offers 32 tools. Here an assistant has called one to add a plan. Nothing happens until the partner approves. Then both see the plan, and the result goes back to the model.',
    built: {
      name: turtledove.name,
      line: `${turtledove.summary} ${turtledove.points[0]}`,
      figure: '32',
      figureText: 'tools on an OAuth MCP server that lets AI assistants act for one partner, with their approval.',
      caveat: turtledove.status,
      links: [{ label: turtledove.hrefLabel, href: turtledove.href }],
    },
    cam: { x: -13.4, z: -24.2, w: 12.5, d: 9 },
  },
  {
    id: 'end',
    s: S(4, -30),
    district: 6,
    kicker: 'Response',
    title: person.name,
    body: `${person.role}. The system around the model: retrieval, serving, permissions, crash recovery and evals. ${(fidelity.what ?? '').replace(/\.$/, '')} at Fidelity Investments since 2023; the blocks behind the marble are the path here. ${person.openTo}`,
    cam: { x: -27.4, z: -23.2, w: 13.5, d: 8 },
    end: true,
  },
];

// camera look-at points above were drawn on rows 14 apart; move them with the rows
const DRAWN = [21, 7, -7, -21];
for (const b of beats) {
  const r = rowAt(b.s);
  if (b.id !== 'model') b.cam.z += ROW_Z[r] - DRAWN[r];
}
