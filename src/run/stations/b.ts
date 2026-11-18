/**
 * 02 Inference. servegate (eight requests, one call), the model (sealed), and
 * speculative decoding (a draft guesses ahead, the big model verifies in order).
 * This row runs right to left.
 */
import { Mesh, MeshBasicMaterial, RingGeometry, Vector3 } from 'three';
import { back, boxGeo, clamp, floorText, lerp, part, ss, wallText } from '../kit';
import { ROW_Z, S } from '../track';
import type { Ctx, Station } from '../types';

const Z = ROW_Z[1];

export function inference(ctx: Ctx): Station[] {
  const { batch, mats, dyn } = ctx;
  const w = (s: number, xa: number, xb: number) => ss(S(2, xa), S(2, xb), s);

  // ---- servegate -------------------------------------------------------------------------
  const WAIT = 17.55; // where the marble takes the eighth place
  const GAP = 1.05;
  const gateX = 9.3;
  const slot = (j: number) => WAIT - GAP * (j + 1);
  const ghosts: Mesh[] = [];
  for (let j = 0; j < 7; j++) {
    // a short feeder lane per waiting request, from the back
    batch.box('cardDim', 0.9, 0.022, 3.3, slot(j), Z - 2.4);
    const g = part(ctx.sphere, mats.ghost, slot(j), 0.5, Z - 4);
    ghosts.push(g);
    dyn.add(g);
  }
  // the feeders hang from one intake beam
  batch.box('balsa', 7.6, 0.26, 0.26, (slot(0) + slot(6)) / 2, Z - 4.1, 1.0);
  batch.box('balsa', 0.2, 1.0, 0.2, slot(0) + 0.7, Z - 4.1);
  batch.box('balsa', 0.2, 1.0, 0.2, slot(6) - 0.7, Z - 4.1);
  batch.box('balsa', 0.3, 2.3, 0.3, gateX, Z - 1.2);
  batch.box('balsa', 0.3, 2.3, 0.3, gateX, Z + 1.2);
  batch.box('balsa', 0.8, 0.26, 3.0, gateX, Z, 2.3);
  const boom = part(boxGeo(0.16, 0.2, 2.0), mats.ink, gateX, 0.75, Z);
  const stamp = part(boxGeo(0.62, 0.9, 0.62), mats.ink, gateX, 1.85, Z);
  dyn.add(boom, stamp);
  // the same eight requests served two ways, side by side on a loop:
  // one at a time (the press comes down eight times) and as one batch (it comes down once)
  const tz = Z - 5.9;
  const qx = (k: number) => 15.3 + 0.52 * k;
  const RUN = 5.7;
  dyn.add(floorText('ONE AT A TIME', 19.8, tz, { h: 0.3, weight: 700, track: 0.1, align: 'left', opacity: 0.6 }));
  dyn.add(floorText('AS ONE BATCH', 19.8, tz + 1.1, { h: 0.3, weight: 700, track: 0.1, align: 'left', opacity: 0.6 }));
  batch.box('balsa', 10, 0.06, 0.5, 14.4, tz);
  batch.box('balsa', 10, 0.06, 0.5, 14.4, tz + 1.1);
  const beadsA: Mesh[] = [];
  const beadsB: Mesh[] = [];
  for (let k = 0; k < 8; k++) {
    for (const [list, z] of [
      [beadsA, tz],
      [beadsB, tz + 1.1],
    ] as const) {
      const bead = part(ctx.sphere, mats.ghost, qx(k), 0.28, z);
      bead.scale.setScalar(0.44);
      list.push(bead);
      dyn.add(bead);
    }
  }
  const pressA = part(boxGeo(0.5, 0.5, 0.5), mats.ink, 14.6, 1.0, tz);
  const pressB = part(boxGeo(4.3, 0.5, 0.5), mats.ink, 12.5, 1.0, tz + 1.1);
  dyn.add(pressA, pressB);
  const callsA = ctx.tag('batch-go', 'One at a time: 0 calls', new Vector3(14.6, 1.5, tz), 'up');
  ctx.tag('batch-go', 'As one batch: 1 call', new Vector3(17.6, 0, tz + 1.7), 'down');
  let lastCalls = -1;

  const tagM = new Vector3();
  ctx.tag('batch-wait', '7 other requests, waiting', new Vector3(slot(3), 1.3, Z), 'up');
  const tagM2 = new Vector3();
  ctx.tag('batch-wait', 'This request: the 8th', tagM2, 'down');
  ctx.tag('batch-go', '8 requests, 1 model call', new Vector3(gateX, 3.1, Z), 'up');

  const servegate: Station = {
    s0: S(2, 24) - 12,
    s1: S(2, 2),
    update(s, t, m) {
      const onRow = s >= S(2, 24) && s <= S(2, -24);
      const mx = onRow ? m.x : s < S(2, 24) ? 99 : -99;
      for (let j = 0; j < 7; j++) {
        const g = ghosts[j];
        // they roll in from the back while the marble comes round the turn
        const arrive = ss(S(2, 24) - 9 + j * 1.1, S(2, 24) - 4 + j * 1.1, s);
        const x = Math.min(slot(j), mx - GAP * (j + 1));
        g.position.set(x, 0.5, lerp(Z - 4, Z, arrive));
        g.rotation.z = -x * 2;
        g.rotation.x = arrive * 8;
        g.scale.setScalar(clamp((x - 3.4) / 0.8)); // inside the model they are out of sight
      }
      boom.position.y = lerp(0.75, 2.05, back(w(s, WAIT - 0.02, WAIT - 0.32)));
      stamp.position.y = 1.85 - 0.55 * w(s, 10.2, 9.3) * (1 - w(s, 6.6, 5.6));
      // the comparison loop: 4 s of serving, then a beat of rest
      // 4 s of serving, a pause, then everything rolls back to the start: no jump at the wrap
      const u = t % 6.4;
      const c = Math.min(u / 4, 1);
      const home = 1 - ss(5.2, 6.4, u);
      const served = home < 0.5 ? 0 : Math.min(8, Math.floor(c * 8));
      for (let k = 0; k < 8; k++) {
        const a = ss(0, 1, clamp(c * 8 - k)) * home;
        beadsA[k].position.x = qx(k) - RUN * a;
        beadsA[k].rotation.z = a * 9;
        const b = ss(0, 1, clamp(c * 8)) * home;
        beadsB[k].position.x = qx(k) - RUN * b;
        beadsB[k].rotation.z = b * 9;
      }
      pressA.position.y = 1.0 - 0.42 * (c < 1 ? Math.sin(Math.PI * ((c * 8) % 1)) ** 6 : 0);
      pressB.position.y = 1.0 - 0.42 * Math.sin(Math.PI * clamp((c - 0.03) / 0.1)) ** 2;
      if (served !== lastCalls) {
        lastCalls = served;
        callsA.set(`One at a time: ${served} call${served === 1 ? '' : 's'}`);
      }
      tagM.set(m.x, 1.25, m.z);
      tagM2.set(m.x, 0, m.z + 0.9);
    },
  };

  // ---- the model ---------------------------------------------------------------------------
  const H = 7;
  batch.box('ink', 8, H, 3.1, 0, Z - 2.45);
  batch.box('ink', 8, H, 3.1, 0, Z + 2.45);
  batch.box('ink', 8, H - 1.5, 1.8, 0, Z, 1.5);
  dyn.add(wallText('THE MODEL', 0, 5.4, Z + 4.02, { h: 0.62, weight: 700, track: 0.22, color: '#f4f2ec' }));
  dyn.add(floorText('THE MODEL', 0, Z + 5.1, { h: 0.6, weight: 700, track: 0.22, opacity: 0.6 }));
  const seam = part(boxGeo(8.05, 0.07, 8.05), mats.glow, 0, 4.3, Z);
  seam.castShadow = seam.receiveShadow = false;
  dyn.add(seam);
  // rings spreading over the table from the model: the system around it
  const ringGeo = new RingGeometry(5.9, 6.02, 4, 1, Math.PI / 4).rotateX(-Math.PI / 2);
  const rings = [0, 1, 2].map(() => {
    const r = new Mesh(ringGeo, new MeshBasicMaterial({ color: mats.glow.color, transparent: true, opacity: 0, depthWrite: false }));
    r.position.set(0, 0.03, Z);
    r.renderOrder = 1;
    dyn.add(r);
    return r;
  });
  const model: Station = {
    s0: S(2, 8),
    s1: S(2, -8),
    update(s, t) {
      const inside = w(s, 4.6, 3.2) * (1 - w(s, -3.2, -4.6));
      seam.visible = inside > 0.02;
      seam.scale.set(1, 0.3 + inside * (1 + 0.3 * Math.sin(t * 2.2)), 1);
      for (let i = 0; i < 3; i++) {
        const ph = (t * 0.28 + i / 3) % 1;
        rings[i].scale.setScalar(1 + ph * 2.4);
        (rings[i].material as MeshBasicMaterial).opacity = inside * Math.sin(Math.PI * ph) ** 1.5 * 0.7;
        rings[i].visible = inside > 0.02;
      }
    },
  };

  // ---- speculative decoding ----------------------------------------------------------------
  const N = 9; // two blocks of four and one bonus token
  const tx = (k: number) => -7.2 - 1.45 * k;
  const rowZ = Z - 2.1;
  const railZ = Z - 3.7;
  batch.box('balsa', 15.4, 0.1, 0.24, -13.2, railZ);
  // the answer is laid out on a bed beside the lane, token by token
  batch.box('cardDim', 13.6, 0.03, 1.5, (tx(0) + tx(8)) / 2, rowZ);
  batch.box('balsa', 0.16, 0.5, 0.5, -5.6, railZ);
  batch.box('balsa', 0.16, 0.5, 0.5, -20.8, railZ);
  dyn.add(floorText('DRAFT MODEL: SMALL, FAST', -6.1, railZ - 0.75, { h: 0.28, weight: 700, track: 0.1, align: 'right', opacity: 0.6 }));
  const drafter = part(boxGeo(0.7, 0.55, 0.7), mats.card, -6.2, 0.4, railZ);
  dyn.add(drafter);
  const drafts: (Mesh | null)[] = [];
  const finals: Mesh[] = [];
  for (let k = 0; k < N; k++) {
    const own = k === 3 || k === 8; // the big model's own token
    const d = k === 8 ? null : part(boxGeo(1.05, 0.07, 1.05), mats.balsa, tx(k), 0.05, rowZ);
    const f = part(boxGeo(1.05, 0.36, 1.05), own ? mats.ink : mats.accent, tx(k), 0.19, rowZ);
    if (own) f.add(part(boxGeo(0.6, 0.05, 0.6), mats.accent, 0, 0.2, 0));
    drafts.push(d);
    finals.push(f);
    if (d) dyn.add(d);
    dyn.add(f);
  }
  // the checker: a dark gantry over the token row, level with the marble
  const gantry = part(boxGeo(0.5, 0.2, 2.1), mats.ink, 0, 1.45, rowZ);
  gantry.add(part(boxGeo(0.14, 1.4, 0.14), mats.ink, 0, -0.75, -0.98), part(boxGeo(0.14, 1.4, 0.14), mats.ink, 0, -0.75, 0.98));
  const head = part(boxGeo(0.5, 0.34, 0.5), mats.ink, 0, -0.3, 0);
  gantry.add(head);
  dyn.add(gantry);

  const tagD = new Vector3();
  ctx.tag('spec-draft', 'Draft: 4 guesses', tagD, 'up');
  ctx.tag('spec-verify', 'Kept', new Vector3(tx(1), 0.9, rowZ), 'up');
  ctx.tag('spec-verify', 'Rejected, replaced', new Vector3(tx(3), 2.1, rowZ), 'up');
  ctx.tag('spec-bonus', 'All 4 kept: +1 bonus token', new Vector3(tx(8), 0.9, rowZ), 'up');
  ctx.tag('spec-bonus', '9 tokens from 2 big-model passes, not 9', new Vector3(tx(4), 0, rowZ + 3.1), 'down');

  const spec: Station = {
    s0: S(2, -2),
    s1: S(2, -24) + 4,
    update(s, t, m) {
      const onRow = s >= S(2, 24) && s <= S(2, -24);
      const mx = onRow ? m.x : s < S(2, 24) ? 99 : -99;
      const d1 = w(s, -4.3, -6.3);
      const d2 = w(s, -11.9, -13.6);
      const dx = lerp(lerp(-6.2, tx(3), d1), tx(7), d2);
      drafter.position.x = dx;
      gantry.position.x = clamp(mx, tx(8) - 0.6, -5.4);
      let dip = 0;
      for (let k = 0; k < N; k++) {
        const x = tx(k);
        const laid = clamp((x + 0.55 - dx) / 0.5);
        const v = w(s, x + 0.95, x + 0.15);
        dip = Math.max(dip, Math.sin(Math.PI * v));
        const d = drafts[k];
        const f = finals[k];
        if (k === 3 && d) {
          // rejected: the guess is flipped off the row and the big model sets its own
          const out = ss(0, 0.55, v);
          d.scale.setScalar(laid * (1 - ss(0.5, 0.9, v)) + 1e-4);
          d.position.set(x, 0.05 + Math.sin(Math.PI * out) * 0.9, rowZ - out * 1.7);
          d.rotation.x = -out * 2.6;
          const drop = ss(0.45, 1, v);
          f.position.y = lerp(1.6, 0.19, drop);
          f.scale.setScalar(drop + 1e-4);
        } else if (d) {
          d.scale.setScalar(laid * (1 - ss(0.3, 0.6, v)) + 1e-4);
          f.scale.set(1, lerp(0.02, 1, back(v)), 1);
          f.position.y = 0.19 * lerp(0.15, 1, v) + (v >= 1 ? 0.05 * Math.max(0, Math.sin(t * 2.4 + k * 0.7)) ** 4 : 0);
          f.visible = v > 0.02;
        } else {
          f.position.y = lerp(1.6, 0.19, v);
          f.scale.setScalar(v + 1e-4);
        }
      }
      head.position.y = -0.3 - dip * 0.45;
      tagD.set(dx, 1.15 + Math.sin(t * 2) * 0.02, railZ);
    },
  };

  return [servegate, model, spec];
}
