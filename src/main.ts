/**
 * Entry (small; everything 3D is imported on demand).
 *
 * 1. perf.boot(): capability and device tier, before anything 3D.
 * 2. Decide the view: the classic page (always complete in the HTML) or the tabletop.
 * 3. Wire the always-present view toggle, the intro's Enter button, and the classic search.
 *
 * Markers for tests: html.world (tabletop chosen), html.world-ready (revealed),
 * html.classic (classic view on), [data-view-toggle], #main (classic root).
 */
import './classic/classic.css';
import { Bus } from './lib/bus';
import { boot as perfBoot } from './perf';
import type { WorldHandle } from './app';

const html = document.documentElement;
html.classList.add('js');
const perf = perfBoot();
const bus = new Bus();
const params = new URLSearchParams(location.search);

type View = 'world' | 'classic';
const KEY = 'pavanmogili:view';
const stored = (() => {
  try {
    return localStorage.getItem(KEY) as View | null;
  } catch {
    return null;
  }
})();
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true;
// crawlers and audits read the classic page, which is the SEO surface
const bot = /bot|crawl|spider|slurp|bingpreview|lighthouse|facebookexternalhit|embedly|quora link preview/i.test(navigator.userAgent);
const asked = params.get('view');

let view: View =
  asked === 'classic' || asked === 'world'
    ? asked
    : stored ?? (bot || reduceMotion || saveData ? 'classic' : 'world');
if (!perf.world) view = 'classic';
// a link to a classic section (#work, #contact, ...) opens the classic view
if (location.hash && location.hash.length > 1 && document.querySelector(`#main ${CSS.escape(location.hash)}`)) view = 'classic';

const toggle = document.querySelector<HTMLButtonElement>('[data-view-toggle]');
const enterBtn = document.querySelector<HTMLButtonElement>('[data-enter]');
const enterLabel = document.querySelector<HTMLElement>('[data-enter-label]');
const progress = document.querySelector<HTMLProgressElement>('[data-progress]');
const live = document.querySelector<HTMLElement>('[data-live]');
const main = document.querySelector<HTMLElement>('#main');
if (toggle && perf.world) toggle.hidden = false;

let world: Promise<WorldHandle> | null = null;
let ready = false;

function setProgress(p: number, label: string) {
  if (!progress) return;
  progress.value = Math.round(p * 100);
  progress.setAttribute('aria-valuetext', label);
}

function startWorld(): Promise<WorldHandle> {
  if (!world) {
    world = import('./app')
      .then((m) =>
        m.bootWorld({
          perf,
          bus,
          root: document.querySelector<HTMLElement>('[data-world]')!,
          onProgress: setProgress,
        }),
      )
      .then((w) => {
        ready = true;
        html.classList.add('world-ready');
        if (enterBtn && enterLabel) {
          enterBtn.disabled = false;
          enterLabel.textContent = 'Start';
        }
        return w;
      })
      .catch((err) => {
        // a stale tab after a deploy, a failed WASM compile, a lost context: stay classic
        console.warn('[site] the tabletop could not start; showing the classic view', err);
        setView('classic', false);
        if (toggle) toggle.hidden = true;
        throw err;
      });
  }
  return world;
}

function setView(next: View, persist = true) {
  view = next;
  html.classList.toggle('world', next === 'world');
  html.classList.toggle('classic', next === 'classic');
  toggle?.setAttribute('aria-pressed', String(next === 'classic'));
  if (persist) {
    try {
      localStorage.setItem(KEY, next);
    } catch {
      /* private mode */
    }
  }
  if (main) {
    main.inert = next === 'world';
    if (next === 'world') main.setAttribute('aria-hidden', 'true');
    else main.removeAttribute('aria-hidden');
  }
  if (next === 'world') {
    void startWorld()
      .then((w) => w.engine.setActive(true))
      .catch(() => {});
  } else if (world) {
    void world.then((w) => w.engine.setActive(false)).catch(() => {});
  }
  bus.emit('view', { view: next });
  if (live) live.textContent = next === 'classic' ? 'Classic view.' : 'Tabletop view.';
}

setView(view, false);

toggle?.addEventListener('click', () => {
  const next = view === 'world' ? 'classic' : 'world';
  setView(next);
  if (next === 'classic') {
    window.scrollTo(0, 0);
    main?.focus({ preventScroll: true });
  }
});
document.addEventListener('click', (e) => {
  const link = (e.target as HTMLElement).closest<HTMLAnchorElement>('[data-view-link="classic"]');
  if (!link || view === 'classic') return;
  e.preventDefault();
  setView('classic');
  main?.focus({ preventScroll: true });
});

// Enter: the tap that grants motion sensors (FEEL listens to 'enter') and unlocks audio
function enter() {
  if (!ready || html.classList.contains('is-entered')) return;
  html.classList.add('is-entered');
  bus.emit('enter');
  document.querySelector<HTMLCanvasElement>('[data-world] canvas')?.focus?.();
}
enterBtn?.addEventListener('click', enter);
addEventListener('keydown', (e) => {
  if (view !== 'world' || !ready) return;
  if (/^(Arrow|Enter$| $)/.test(e.key) && !(e.target as HTMLElement).closest('input, textarea, button, a')) enter();
});

// Classic search loads on first use
const askInput = document.querySelector<HTMLInputElement>('#ask-input');
const askForm = document.querySelector<HTMLFormElement>('[data-ask-form]');
if (askInput && askForm) {
  askInput.disabled = false;
  askForm.querySelector('button')!.disabled = false;
  let search: Promise<typeof import('./classic/search/ui')> | null = null;
  const load = () => (search ??= import('./classic/search/ui'));
  askInput.addEventListener('focus', () => void load(), { once: true });
  askForm.addEventListener('submit', (e) => {
    e.preventDefault();
    void load().then((m) => m.run(askInput.value));
  });
  document.addEventListener('click', (e) => {
    const chip = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-ask]');
    if (!chip) return;
    askInput.value = chip.dataset.ask ?? '';
    void load().then((m) => m.run(askInput.value));
  });
}
