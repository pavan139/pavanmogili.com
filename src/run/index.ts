/**
 * The request run. One marble (a request) follows a path through the system around a
 * language model. The visitor moves it stop by stop (Next, arrow keys) or scrubs it
 * (wheel, drag). Every mechanism is a function of where the marble is, so it plays
 * forwards and backwards, and nothing moves faster than the eye can follow.
 */
import './run.css';
import { CanvasTexture, Group, InstancedMesh, Mesh, MeshBasicMaterial, Object3D, PlaneGeometry, RingGeometry, SRGBColorSpace, SphereGeometry, Vector3 } from 'three';
import type { Bus } from '../lib/bus';
import type { Perf } from '../perf';
import { beats } from './beats';
import { Batch, clamp, floorText, lerp, makeMats, ss } from './kit';
import { Stage, TABLE, type Framing } from './stage';
import { agents } from './stations/c';
import { evaluation } from './stations/d';
import { inference } from './stations/b';
import { retrieval } from './stations/a';
import { site } from './stations/site';
import { ROW_Z, TOTAL, at, buildTrack } from './track';
import type { Ctx, Station } from './types';
import { UI } from './ui';

export interface RunHandle {
  engine: { setActive(on: boolean): void };
}

const MAX_SPEED = 11; // table units per second: brisk, never a blur
const SMOOTH = 0.42;

export async function bootRun(opts: { perf: Perf; bus: Bus; root: HTMLElement; onProgress(p: number, label: string): void }): Promise<RunHandle> {
  const { perf, bus, root } = opts;
  const params = new URLSearchParams(location.search);
  const shots = params.has('shots');
  // reduced motion: no rolling, no camera moves, no idle loops. Each stop is a still.
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const snap = shots || calm;
  const timing: Record<string, number> = { start: performance.now() };
  opts.onProgress(0.15, 'Loading');
  await Promise.all([document.fonts.load("700 96px 'Instrument Sans'"), document.fonts.load("600 96px 'Instrument Sans'")]).catch(() => {});
  timing.fonts = performance.now();
  opts.onProgress(0.35, 'Building the table');

  const mats = makeMats();
  const settings = shots ? { pixelBudget: 4e6, msaa: 4, post: 2, shadows: true } : perf.settings;
  const stage = new Stage(root, mats, settings);
  const batch = new Batch();
  const dyn = new Group();

  let s = beats[0].s;
  let target = s;
  let vel = 0;
  let nav: number | null = 0;
  let entered = false;
  let enteredAt = 0;
  let active = true;
  let snapAll = true;

  const stopIndex = (dir: 1 | -1) => {
    if (dir > 0) {
      const i = beats.findIndex((b) => b.s > target + 0.05);
      return i < 0 ? beats.length - 1 : i;
    }
    for (let i = beats.length - 1; i >= 0; i--) if (beats[i].s < target - 0.05) return i;
    return 0;
  };
  let wide = false;
  const setWide = (on: boolean) => {
    if (wide !== on) ui.setOverview((wide = on));
  };
  const go = (i: number) => {
    setWide(false);
    nav = i;
    target = beats[i].s;
    // a long way off: cut there (a short fade), arriving from just before the stop so its
    // mechanism still plays, instead of racing the camera across the table
    if (Math.abs(target - s) > 34) {
      const from = clamp(target - 7 * Math.sign(target - s), 0, TOTAL);
      const cut = () => {
        s = from;
        vel = 0;
        snapAll = true;
        stage.snap();
        root.classList.remove('is-cut');
      };
      target = s;
      if (snap) cut();
      else {
        root.classList.add('is-cut');
        setTimeout(() => {
          cut();
          target = beats[i].s;
        }, 240);
      }
      if (snap) target = beats[i].s;
    }
  };
  const ui = new UI(root, beats, {
    next: () => (target >= beats[beats.length - 1].s - 0.05 ? go(0) : go(stopIndex(1))),
    back: () => go(stopIndex(-1)),
    jump: (i) => go(i),
    classic: () => document.querySelector<HTMLButtonElement>('[data-view-toggle]')?.click(),
    overview: () => setWide(!wide),
  });

  const ctx: Ctx = { batch, mats, dyn, sphere: new SphereGeometry(0.5, 32, 20), tag: (b, t, p, place) => ui.tag(b, t, p, place) };
  const stations: Station[] = [...retrieval(ctx), ...inference(ctx), ...agents(ctx), ...evaluation(ctx)];
  const wasOn = stations.map(() => false);
  buildTrack(batch);
  const around = site(ctx, beats);

  // the slab under the printed top, and the drawing's title block
  batch.box('balsa', TABLE.w + 0.8, 2.6, TABLE.d + 0.8, 0, 0, -3.0);
  const R = ROW_Z;
  batch.cyl('accent', 0.66, 0.02, -30.5, R[0], 0.022, 40);
  batch.cyl('cardDim', 0.5, 0.024, -30.5, R[0], 0.022, 40);
  const L = (str: string, x: number, z: number, h: number, align: 'left' | 'right' | 'center', opacity = 0.8, track = 0.16) =>
    dyn.add(floorText(str, x, z, { h, weight: 700, align, track, opacity }));
  L('REQUEST', -30.5, R[0] + 1.75, 0.3, 'center', 0.6, 0.14);
  // the drawing's title block, in the front left corner
  L('PAVAN REDDY MOGILI', -36.6, R[0] + 8.6, 1.5, 'left', 0.92, 0.02);
  L('APPLIED AI ENGINEER', -36.5, R[0] + 10.35, 0.56, 'left', 0.7, 0.2);
  L('THE SYSTEM AROUND A LANGUAGE MODEL', -36.5, R[0] + 11.35, 0.42, 'left', 0.55, 0.2);
  // big numerals mark the five parts of the system, like plots on a site plan
  const plot = (n: string, name: string, x: number, row: number, align: 'left' | 'right') => {
    L(n, x, R[row] + 4.0, 2.6, align, 0.16, 0);
    L(name, x + (align === 'left' ? 4.4 : -4.4), R[row] + 4.0, 0.78, align);
  };
  plot('01', 'RETRIEVAL', -26.4, 0, 'left');
  plot('02', 'INFERENCE', 24.4, 1, 'right');
  plot('03', 'AGENTS AND TOOLS', -24.4, 2, 'left');
  plot('04', 'EVALUATION', 24.4, 3, 'right');
  plot('05', 'PRODUCT', -7.4, 3, 'right');

  // small chevrons printed on the lane show which way a request travels
  {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d')!;
    g.strokeStyle = 'rgba(37, 34, 31, 0.34)';
    g.lineWidth = 7;
    g.lineCap = g.lineJoin = 'round';
    g.beginPath();
    g.moveTo(24, 16);
    g.lineTo(42, 32);
    g.lineTo(24, 48);
    g.stroke();
    const tex = new CanvasTexture(c);
    tex.colorSpace = SRGBColorSpace;
    const geo = new PlaneGeometry(0.62, 0.62).rotateX(-Math.PI / 2);
    const n = Math.floor(TOTAL / 3);
    const arrows = new InstancedMesh(geo, new MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), n);
    const o = new Object3D();
    const p = new Vector3();
    const d = new Vector3();
    for (let i = 0; i < n; i++) {
      at(1.5 + i * 3, p, d);
      o.position.set(p.x, 0.034, p.z);
      o.rotation.y = Math.atan2(-d.z, d.x);
      o.updateMatrix();
      arrows.setMatrixAt(i, o.matrix);
    }
    arrows.renderOrder = 1;
    dyn.add(arrows);
  }
  stage.world.add(batch.build(mats), dyn);
  timing.built = performance.now();
  opts.onProgress(0.7, 'Warming up');

  // ---- input: stops for clarity, scrubbing for play ----------------------------------------
  const canvas = stage.renderer.domElement;
  const scrub = (d: number) => {
    if (!entered) return;
    setWide(false);
    nav = null;
    target = clamp(target + d, beats[0].s, beats[beats.length - 1].s);
  };
  root.addEventListener(
    'wheel',
    (e) => {
      if ((e.target as HTMLElement).closest('.run-text')) return;
      e.preventDefault();
      scrub(clamp(e.deltaY * (e.deltaMode === 1 ? 16 : 1), -90, 90) * 0.03);
    },
    { passive: false },
  );
  let drag: { id: number; x: number; y: number } | null = null;
  canvas.addEventListener('pointerdown', (e) => {
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY };
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    drag.x = e.clientX;
    drag.y = e.clientY;
    // drag left or up to go on, right or down to go back
    scrub(-(Math.abs(dx) > Math.abs(dy) ? dx : dy) * 0.035);
  });
  const endDrag = () => (drag = null);
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  addEventListener('keydown', (e) => {
    if (!active || !entered || e.metaKey || e.ctrlKey || e.altKey) return;
    const el = e.target as HTMLElement;
    if (el.closest('input, textarea, select, a, [contenteditable]')) return;
    const onButton = !!el.closest('button');
    const k = e.key;
    if (k === 'ArrowRight' || k === 'ArrowDown' || k === 'PageDown' || (!onButton && (k === ' ' || k === 'Enter'))) go(stopIndex(1));
    else if (k === 'ArrowLeft' || k === 'ArrowUp' || k === 'PageUp') go(stopIndex(-1));
    else if (k === 'Home') go(0);
    else if (k >= '1' && k <= '5') go(beats.findIndex((b) => b.district === Number(k)));
    else if (k === 'End') go(beats.length - 1);
    else return;
    e.preventDefault();
  });
  bus.on('enter', () => {
    entered = true;
    enteredAt = performance.now();
    // only the panel's footprint changes here; the camera flies from the overview to the start
    requestAnimationFrame(() => (stage.insets = ui.insets(false)));
    const want = linked ? Number(linked[1]) - 1 : 0;
    if (want > 0 && want < beats.length) go(want);
  });

  // ---- frame ----------------------------------------------------------------------------------
  const m = new Vector3();
  const p0 = new Vector3();
  const p1 = new Vector3();
  const pt = { x: 0, y: 0 };
  const frameAt = (out: Framing) => {
    let i = 0;
    while (i < beats.length - 2 && s > beats[i + 1].s) i++;
    const a = beats[i];
    const b = beats[i + 1];
    const u = clamp((s - a.s) / (b.s - a.s));
    const e = u * u * (3 - 2 * u);
    at(a.s, p0);
    at(b.s, p1);
    out.x = m.x + lerp(a.cam.x - p0.x, b.cam.x - p1.x, e);
    out.z = m.z + lerp(a.cam.z - p0.z, b.cam.z - p1.z, e);
    out.w = lerp(a.cam.w, b.cam.w, e);
    out.d = lerp(a.cam.d, b.cam.d, e);
    out.pitch = lerp(a.cam.pitch ?? 50, b.cam.pitch ?? 50, e);
    out.yaw = 0;
  };
  const nearest = () => {
    let best = 0;
    let bd = Infinity;
    for (let i = 0; i < beats.length; i++) {
      const d = beats[i].s - s;
      const cost = d >= 0 ? d * 0.6 : -d; // lean towards the stop ahead
      if (cost < bd) {
        bd = cost;
        best = i;
      }
    }
    return best;
  };
  const f: Framing = { x: 0, z: 0, w: 10, d: 10 };
  const resize = () => {
    stage.resize(root.clientWidth || innerWidth, root.clientHeight || innerHeight);
    stage.insets = ui.insets(!entered);
  };
  addEventListener('resize', resize);
  resize();

  // a ring spreads on the table where the marble comes to rest at a stop
  const ping = new Mesh(new RingGeometry(0.62, 0.7, 48).rotateX(-Math.PI / 2), new MeshBasicMaterial({ color: mats.glow.color, transparent: true, opacity: 0, depthWrite: false }));
  ping.position.y = 0.058;
  ping.renderOrder = 1;
  ping.visible = false;
  dyn.add(ping);
  let pingAt = -10;
  let rolling = false;

  let measure = 0;
  // the address remembers the stop (#s12), so a reload or a shared link comes back to it
  const remember = (i: number) => {
    try {
      history.replaceState(null, '', `#s${i + 1}`);
    } catch {
      /* sandboxed frames may refuse */
    }
  };
  const linked = /^#s(\d+)$/.exec(location.hash);

  let last = performance.now();
  let slow = 0;
  let fast = 0;
  let ups = 0;
  let acc = 0;
  let n = 0;
  let raf = 0;
  const tick = (now: number) => {
    raf = active ? requestAnimationFrame(tick) : 0;
    const raw = (now - last) / 1000;
    last = now;
    const dt = Math.min(raw, 0.05);
    const t = calm ? 0 : now / 1000;

    // critically damped approach to the target, with a speed limit
    const omega = 2 / SMOOTH;
    const x = omega * dt;
    const k = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
    const change = clamp(s - target, -MAX_SPEED * SMOOTH, MAX_SPEED * SMOOTH);
    const temp = (vel + omega * change) * dt;
    vel = (vel - omega * temp) * k;
    s = s - change + (change + temp) * k;
    if (calm || (Math.abs(target - s) < 0.002 && Math.abs(vel) < 0.01)) {
      s = target;
      vel = 0;
    }

    at(s, m);
    stage.setMarble(m);
    around.trail(s);
    if (s !== target) rolling = true;
    else if (rolling) {
      rolling = false;
      if (!calm && nav != null) {
        pingAt = t;
        ping.position.set(m.x, 0.058, m.z);
      }
    }
    const ph = (t - pingAt) / 0.9;
    ping.visible = ph >= 0 && ph < 1;
    if (ping.visible) {
      ping.scale.setScalar(1 + ph * 2.6);
      (ping.material as MeshBasicMaterial).opacity = (1 - ph) * 0.8;
    }
    for (let i = 0; i < stations.length; i++) {
      const st = stations[i];
      const on = s >= st.s0 - 3 && s <= st.s1 + 3;
      if (on || wasOn[i] || snapAll) st.update(s, t, m);
      wasOn[i] = on;
    }
    snapAll = false;
    if (ui.setBeat(nav ?? nearest())) {
      measure = 2;
      if (entered) remember(nav ?? nearest());
    }
    if (measure && !--measure) stage.insets = ui.insets(!entered);

    if (entered) {
      frameAt(f);
      if (wide) {
        // the whole table, from wherever the request is
        f.x = 0;
        f.z = 0.5;
        f.w = 46;
        f.d = 34;
        f.pitch = 44;
      }
      const since = (now - enteredAt) / 1000;
      // the fly-in from the overview eases in as well as out
      stage.frame(f, dt, snap ? 1e3 : 0.25 + 2.4 * ss(0, 1, since) + 1.9 * ss(1.2, 3.4, since));
    } else {
      const portrait = stage.width < stage.height;
      // a slow three-quarter view of the whole table, the model in the middle
      f.x = portrait ? 0 : 1;
      f.z = portrait ? 5 : 1;
      f.w = portrait ? 36 : 66;
      f.d = portrait ? 40 : 46;
      f.pitch = portrait ? 40 : 35;
      f.yaw = -17 + Math.sin(t * 0.1) * 3;
      stage.frame(f, dt, snap ? 1e3 : 2);
    }
    ui.place(stage);
    stage.project(m, pt);
    const mid = 1 - (stage.insets.top + (stage.height - stage.insets.top - stage.insets.bottom) / 2) / stage.height;
    stage.render(t, entered ? lerp(1 - pt.y / stage.height, mid, 0.6) : 0.5, entered ? 3 : 5);

    // keep it smooth: trade resolution for frame time, and give it back when there is room
    if (!shots && !perf.pinned) {
      acc += raw;
      if (++n === 45) {
        const avg = acc / n;
        acc = n = 0;
        if (avg > 0.023) {
          fast = 0;
          if (++slow >= 2 && stage.scale > 0.6) {
            stage.scale *= 0.85;
            stage.applyRatio();
            slow = 0;
          }
        } else if (avg < 0.0125) {
          slow = 0;
          // give resolution back rarely and at most twice, so it never flips back and forth
          if (++fast >= 18 && stage.scale < 1 && ups < 2) {
            ups++;
            stage.scale = Math.min(1, stage.scale * 1.1);
            stage.applyRatio();
            fast = 0;
          }
        } else slow = fast = 0;
      }
    }
  };

  const setActive = (on: boolean) => {
    active = on && !document.hidden;
    if (active && !raf) {
      last = performance.now();
      raf = requestAnimationFrame(tick);
    }
  };
  let wanted = true;
  document.addEventListener('visibilitychange', () => setActive(wanted));
  canvas.addEventListener('webglcontextlost', (e) => e.preventDefault());

  // compile every program and upload every texture before the reveal
  stage.frame({ x: 0, z: 2, w: 90, d: 76 }, 0.016, 1e3);
  await stage.renderer.compileAsync(stage.scene, stage.camera).catch(() => {});
  timing.compiled = performance.now();
  tick(performance.now());
  timing.ready = performance.now();
  opts.onProgress(1, 'Ready');

  const jump = params.get('at');
  const api = {
    goto(i: number) {
      entered = true;
      enteredAt = -1e6;
      document.documentElement.classList.add('is-entered');
      resize();
      s = target = beats[i].s;
      vel = 0;
      nav = i;
      snapAll = true;
    },
    seek(v: number) {
      s = target = v;
      nav = null;
      snapAll = true;
    },
    get s() {
      return s;
    },
    beats,
    stage,
    timing,
  };
  (window as unknown as { __run: typeof api }).__run = api;
  if (jump != null) api.goto(clamp(Number(jump) || 0, 0, beats.length - 1));

  return {
    engine: {
      setActive(on: boolean) {
        wanted = on;
        setActive(on);
      },
    },
  };
}
