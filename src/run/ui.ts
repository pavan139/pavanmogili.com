/**
 * The readable layer: a panel that explains the current stop in plain HTML text, labels
 * pinned to parts of the model, and the controls (Back, Next, the district list).
 */
import type { Vector3 } from 'three';
import { person } from '../content';
import { DISTRICTS, type Beat } from './beats';
import type { Insets, Stage } from './stage';
import type { Tag } from './types';

interface TagRec {
  beat: string;
  el: HTMLElement;
  pos: Vector3;
  up: boolean;
  w: number;
  on: boolean;
  x: number;
  y: number;
  /** keep following its point until this time, while it fades out */
  until: number;
}

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
};

export class UI {
  panel = el('aside', 'run-panel');
  private kicker = el('p', 'run-kicker');
  private count = el('span', 'run-count');
  private title = el('h2', 'run-title');
  private body = el('p', 'run-body');
  private built = el('div', 'run-built');
  private endBox = el('div', 'run-end');
  private text = el('div', 'run-text');
  private back = el('button', 'run-btn run-back', 'Back');
  private next = el('button', 'run-btn run-next', 'Next');
  private bar = el('div', 'run-progress-fill');
  private chips: HTMLButtonElement[] = [];
  private groups: HTMLElement[] = [];
  private map = el('button', 'run-rail-map', 'Whole table');
  private tagLayer = el('div', 'run-tags');
  private tags: TagRec[] = [];
  private current = -1;
  private pt = { x: 0, y: 0 };

  constructor(
    private root: HTMLElement,
    private beats: Beat[],
    private act: { next(): void; back(): void; jump(i: number): void; classic(): void; overview(): void },
  ) {
    root.removeAttribute('aria-hidden');
    this.panel.setAttribute('aria-label', 'What this part of the model shows');
    const prog = el('div', 'run-progress');
    prog.append(this.bar);
    const head = el('div', 'run-head');
    head.append(this.kicker, this.count);
    this.text.setAttribute('aria-live', 'polite');
    this.text.append(head, this.title, this.body, this.built, this.endBox);
    const nav = el('div', 'run-nav');
    this.back.type = this.next.type = 'button';
    nav.append(this.back, this.next);
    const hint = el('p', 'run-hint', 'Arrow keys step. 1 to 5 jump to a part. Scroll or drag to move freely.');
    // wide screens: every stop on one rail under the model, grouped by part of the system
    const rail = el('nav', 'run-rail');
    rail.setAttribute('aria-label', 'All stops');
    let dots: HTMLElement | null = null;
    let last = -1;
    beats.forEach((b, i) => {
      if (b.district !== last) {
        last = b.district;
        const group = el('div', 'run-rail-group');
        dots = el('div', 'run-rail-dots');
        group.append(el('span', 'run-rail-name', DISTRICTS[b.district]), dots);
        rail.append(group);
        this.groups.push(group);
      }
      const d = el('button', 'run-rail-dot');
      d.type = 'button';
      d.dataset.tip = b.title;
      d.setAttribute('aria-label', `${DISTRICTS[b.district]}: ${b.title}`);
      d.addEventListener('click', () => act.jump(i));
      dots!.append(d);
      this.chips.push(d);
    });
    this.panel.append(prog, this.text, nav, hint);
    this.map.type = 'button';
    this.map.setAttribute('aria-pressed', 'false');
    this.map.addEventListener('click', () => act.overview());
    rail.append(this.map);
    root.append(rail);
    root.append(this.tagLayer, this.panel);
    this.back.addEventListener('click', () => act.back());
    this.next.addEventListener('click', () => act.next());
  }

  tag(beat: string, text: string, pos: Vector3, place: 'up' | 'down' = 'up'): Tag {
    const e = el('span', `run-tag run-tag-${place}`, text);
    this.tagLayer.append(e);
    const rec: TagRec = { beat, el: e, pos, up: place === 'up', w: 0, on: false, x: -1, y: -1, until: 0 };
    this.tags.push(rec);
    return {
      set: (t: string) => {
        if (e.textContent !== t) {
          e.textContent = t;
          rec.w = 0;
          rec.x = -1;
        }
      },
    };
  }

  /** how much of the screen the panel takes, so the camera can keep the model clear of it */
  insets(intro = false): Insets {
    const box = intro ? document.querySelector<HTMLElement>('.intro-card') : this.panel;
    const r = (box ?? this.panel).getBoundingClientRect();
    const side = matchMedia('(min-width: 900px) and (min-aspect-ratio: 5/4)').matches;
    const top = 56;
    return side ? { left: r.right + 8, top: intro ? top : top + 58, bottom: 0 } : { left: 0, top, bottom: Math.max(0, innerHeight - r.top) };
  }

  /** returns true when the stop changed (the panel may have a new size) */
  setBeat(i: number): boolean {
    if (i === this.current) return false;
    this.current = i;
    const b = this.beats[i];
    this.kicker.textContent = b.kicker;
    this.count.textContent = `${i + 1} / ${this.beats.length}`;
    this.title.textContent = b.title;
    this.body.textContent = b.body;
    this.built.replaceChildren();
    this.built.hidden = !b.built;
    if (b.built) {
      const k = b.built;
      const name = el('p', 'run-built-name');
      name.append(el('span', 'run-built-label', 'Project'), el('strong', '', k.name));
      const fig = el('p', 'run-figure');
      fig.append(el('strong', '', k.figure), document.createTextNode(` ${k.figureText}`));
      const links = el('p', 'run-links');
      for (const l of k.links) {
        const a = el('a', '', l.label);
        a.href = l.href;
        a.target = '_blank';
        a.rel = 'noopener';
        links.append(a);
      }
      this.built.append(name, el('p', 'run-line', k.line), fig, el('p', 'run-caveat', k.caveat), links);
    }
    this.endBox.replaceChildren();
    this.endBox.hidden = !b.end;
    if (b.end) {
      const mk = (label: string, href: string, primary = false) => {
        const a = el('a', primary ? 'run-btn run-next' : 'run-btn', label);
        a.href = href;
        if (!href.startsWith('mailto:')) {
          a.target = '_blank';
          a.rel = 'noopener';
        }
        return a;
      };
      const all = el('button', 'run-btn', 'Everything on one page');
      all.type = 'button';
      all.addEventListener('click', () => this.act.classic());
      this.endBox.append(mk('Email', `mailto:${person.email}`, true), mk('GitHub', person.links.github), mk('LinkedIn', person.links.linkedin), all);
    }
    this.back.disabled = i === 0;
    this.next.textContent = b.end ? 'Start over' : i === 0 ? 'Roll the request' : 'Next';
    this.bar.style.transform = `scaleX(${i / (this.beats.length - 1)})`;
    this.chips.forEach((c, k) => {
      c.classList.toggle('is-on', k === i);
      c.classList.toggle('is-done', k < i);
    });
    this.groups.forEach((g, k) => g.classList.toggle('is-on', k === b.district));
    this.text.classList.remove('is-in');
    void this.text.offsetWidth;
    this.text.classList.add('is-in');
    this.text.scrollTop = 0;
    for (const t of this.tags) {
      const on = t.beat === b.id;
      if (on !== t.on) {
        t.on = on;
        if (!on) t.until = performance.now() + 450;
        t.el.classList.toggle('is-on', on);
      }
    }
    return true;
  }

  setOverview(on: boolean) {
    this.map.setAttribute('aria-pressed', String(on));
    this.map.textContent = on ? 'Back to the stop' : 'Whole table';
  }

  /** pin the current stop's labels to their points in the model */
  place(stage: Stage) {
    const W = stage.width;
    const now = performance.now();
    for (const t of this.tags) {
      // a label that is fading out keeps following its point, so it never hangs in mid-air
      if (!t.on && now > t.until) continue;
      if (!t.w) t.w = t.el.offsetWidth;
      const ok = stage.project(t.pos, this.pt);
      const half = t.w / 2 + 6;
      // half-pixel steps: labels glide with the camera instead of ticking a pixel at a time
      const x = Math.round((Math.min(W - half, Math.max(stage.insets.left + half, this.pt.x)) - t.w / 2) * 2) / 2;
      const y = ok ? Math.round(this.pt.y * 2) / 2 : -999;
      if (x === t.x && y === t.y) continue; // nothing moved: no style write
      t.x = x;
      t.y = y;
      t.el.style.transform = `translate3d(${x}px, ${y}px, 0) translateY(${t.up ? '-100%' : '0'})`;
      t.el.style.visibility = ok ? 'visible' : 'hidden';
    }
  }
}
