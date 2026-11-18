/**
 * 01 Retrieval. PlanDesk (look it up, cite it or refuse) and temporal-rag (facts change).
 * Everything the request touches turns the accent colour.
 */
import { Vector3 } from 'three';
import { back, boxGeo, clamp, floorText, lerp, link, part, pingpong, setLink, ss, wallText } from '../kit';
import { ROW_Z, S } from '../track';
import type { Ctx, Station } from '../types';

const Z = ROW_Z[0];

export function retrieval(ctx: Ctx): Station[] {
  const { batch, mats, dyn } = ctx;
  const w = (s: number, xa: number, xb: number) => ss(S(1, xa), S(1, xb), s);

  // ---- PlanDesk ------------------------------------------------------------------------
  // the scope check: the marble's lane is open, the 2030 lane ends at a block
  batch.cyl('accent', 0.66, 0.02, -23, Z, 0.022, 40);
  batch.cyl('cardDim', 0.5, 0.024, -23, Z, 0.022, 40);
  const gz = Z - 2.1;
  batch.box('cardDim', 6.2, 0.022, 1.3, -26.2, gz);
  batch.box('balsa', 6.2, 0.17, 0.16, -26.2, gz - 0.73);
  batch.box('balsa', 6.2, 0.17, 0.16, -26.2, gz + 0.73);
  batch.box('ink', 0.3, 1.0, 1.62, -22.95, gz);
  const ghost = part(ctx.sphere, mats.ghost, -29, 0.5, gz);
  dyn.add(ghost);

  // six volumes: three publications, 2024 and 2025 editions
  const shelfZ = Z - 4.6;
  batch.box('balsa', 12.6, 0.35, 2.3, -15, shelfZ);
  // a bookcase round the volumes: back board and two ends
  batch.box('balsa', 12.6, 3.0, 0.16, -15, shelfZ - 1.07, 0.35);
  batch.box('balsa', 0.18, 3.0, 2.3, -21.39, shelfZ, 0.35);
  batch.box('balsa', 0.18, 3.0, 2.3, -8.61, shelfZ, 0.35);
  const names = ['590-A', '590-A', '590-B', '590-B', '560', '560'];
  const volX = (i: number) => -20 + i * 2;
  for (let i = 0; i < 6; i++) {
    batch.box('card', 1.5, 2.7, 1.7, volX(i), shelfZ, 0.35);
    batch.box('cardDim', 1.5, 0.08, 1.7, volX(i), shelfZ, 3.05);
    dyn.add(wallText(`${names[i]}\n${i % 2 ? 2025 : 2024}`, volX(i), 2.0, shelfZ + 0.86, { h: 0.33, weight: 700 }));
  }
  dyn.add(floorText('IRS PUBLICATIONS', -15, shelfZ + 1.75, { h: 0.34, weight: 700, track: 0.14, opacity: 0.55 }));
  const scan = part(boxGeo(0.07, 2.7, 0.07), mats.glow, 0, 1.7, shelfZ + 0.9);
  scan.castShadow = scan.receiveShadow = false;
  dyn.add(scan);
  // how well each volume matches the question: a bar that rises as the search passes it
  const score = [0.95, 0.22, 0.72, 0.18, 0.3, 0.1];
  const bars = score.map((_, i) => {
    const b = part(boxGeo(1.1, 1.3, 0.2).translate(0, 0.65, 0), mats.accent, volX(i), 3.14, shelfZ + 0.6);
    b.castShadow = false;
    dyn.add(b);
    return b;
  });
  // the search itself: a line from the question to the shelf while it looks
  const beam = link(mats.glow);
  // citations: each page on the gate stays tied to the answer as it leaves
  const cites = [0, 1, 2].map(() => link(mats.glow));
  dyn.add(beam, ...cites);

  // three retrieved pages: out of the 2024 volumes, along with the marble, onto the gate
  const from = [0, 0, 2];
  const pages = from.map((v, i) => {
    const m = part(boxGeo(1.0, 0.05, 1.3), mats.accent, volX(v) + (i === 1 ? 0.3 : -0.15), 1.7, shelfZ);
    m.rotation.x = Math.PI / 2;
    dyn.add(m);
    return m;
  });

  // the context window: a tray that travels with the question. Only so much fits on it.
  const tray = part(boxGeo(2.3, 0.07, 1.55), mats.balsa, 0, 1.1, Z);
  tray.add(part(boxGeo(2.3, 0.16, 0.07), mats.balsa, 0, 0.1, -0.74), part(boxGeo(2.3, 0.16, 0.07), mats.balsa, 0, 0.1, 0.74));
  dyn.add(tray);

  // the source check: a boom that lifts once the pages are on the reader
  const gx = -7;
  batch.box('balsa', 0.3, 2.1, 0.3, gx, Z - 1.2);
  batch.box('balsa', 0.3, 2.1, 0.3, gx, Z + 1.2);
  batch.box('balsa', 0.7, 0.26, 3.0, gx, Z, 2.1);
  const boom = part(boxGeo(0.16, 0.2, 2.0), mats.ink, gx, 0.75, Z);
  dyn.add(boom);
  dyn.add(floorText('SOURCE CHECK', gx, Z + 1.7, { h: 0.3, weight: 700, track: 0.14, opacity: 0.55 }));

  const tagQ = new Vector3();
  ctx.tag('rag-ask', 'A 2024 question', tagQ, 'up');
  ctx.tag('rag-ask', 'A 2030 question: refused', new Vector3(-23, 1.3, gz), 'up');
  ctx.tag('rag-find', 'Context window: only the top pages fit', tagQ, 'up');
  ctx.tag('rag-find', 'Scored against the question: top pages taken', new Vector3(-15, 4.7, shelfZ), 'up');
  ctx.tag('rag-cite', 'The answer stays tied to its pages', new Vector3(gx, 2.9, Z), 'up');

  const plandesk: Station = {
    s0: S(1, -32),
    s1: S(1, 0),
    update(s, t, m) {
      // the 2030 question rolls up to the block, stops, and is cleared away
      const g = (t * 0.22) % 1;
      ghost.position.x = lerp(-29, -23.6, ss(0, 0.45, g)) - 0.25 * Math.sin(Math.PI * clamp((g - 0.45) / 0.12));
      ghost.rotation.z = -ghost.position.x * 2;
      ghost.scale.setScalar(ss(0, 0.06, g) * (1 - ss(0.82, 0.95, g)));

      const sweep = w(s, -22.2, -17.2);
      const searching = sweep > 0.001 && sweep < 0.999;
      // while the marble rests after the search, the scan keeps passing so the idea stays visible
      const idle = sweep >= 0.999 && s < S(1, -9.5) ? ss(0, 1, pingpong(t * 0.3)) : -1;
      const sx = lerp(-21, -9, idle >= 0 ? idle : sweep);
      scan.position.x = sx;
      scan.visible = searching || idle >= 0;
      for (let i = 0; i < 6; i++) {
        const seen = sweep >= 0.999 ? 1 : ss(volX(i) - 0.7, volX(i) + 0.5, sx);
        const near = idle >= 0 ? Math.max(0, 1 - Math.abs(sx - volX(i)) / 1.2) : 0;
        bars[i].scale.y = Math.max(1e-3, back(seen) * score[i] * (1 + 0.18 * near));
      }
      setLink(beam, m.x, 0.9, m.z - 0.4, sx, 1.9, shelfZ + 0.9, searching ? 0.035 : 0);

      const dock = w(s, -10.6, -8.6);
      tray.position.set(m.x - 1.55, 1.12, Z);
      tray.scale.setScalar(Math.max(1e-3, w(s, -18.2, -17.2) * (1 - dock)));
      for (let i = 0; i < 3; i++) {
        const p = pages[i];
        const a = w(s, -18.6 + i * 0.7, -15.4 + i * 0.7);
        const out = ss(0, 0.45, a);
        const fly = ss(0.35, 1, a);
        const vx = volX(from[i]) + (i === 1 ? 0.3 : -0.15);
        const fx = m.x - 1.05 - i * 0.5;
        const fy = 1.35 + i * 0.17 + Math.sin(t * 1.7 + i) * 0.04;
        const fz = Z - 0.25 * i + 0.2;
        let x = lerp(vx, fx, fly);
        let y = lerp(1.7, fy, fly);
        let z = lerp(lerp(shelfZ, shelfZ + 1.9, out), fz, fly);
        x = lerp(x, gx, dock);
        y = lerp(y, 2.42, dock);
        z = lerp(z, Z + (i - 1) * 0.86, dock);
        p.position.set(x, y, z);
        p.rotation.x = (1 - fly) * (Math.PI / 2);
        p.rotation.y = (1 - dock) * fly * 0.12 * (i - 1);
        p.scale.setScalar(lerp(1, 0.56, dock));
      }
      boom.position.y = lerp(0.75, 1.95, back(w(s, -8.9, -8.0)));
      const tie = w(s, gx + 0.5, gx + 1.3) * (1 - w(s, gx + 5.5, gx + 8));
      for (let i = 0; i < 3; i++) setLink(cites[i], gx, 2.46, Z + (i - 1) * 0.86, m.x, 0.95, m.z, tie * (0.028 + 0.008 * Math.sin(t * 5 + i * 2)));
      const lift = w(s, -18.4, -17.2) * (1 - w(s, -10.2, -9));
      tagQ.set(m.x - 1.2 * lift, 1.25 + 0.75 * lift, m.z);
    },
  };

  // ---- temporal-rag ----------------------------------------------------------------------
  // the rail is a calendar: where the marble stands is when the question is asked
  const railZ = Z - 2.1;
  batch.box('balsa', 15.4, 0.14, 0.42, 10, railZ);
  // week marks between the months
  for (let k = 1; k < 16; k++) if (k % 4) batch.box('ink', 0.035, 0.2, 0.42, 2 + k, railZ);
  ['JAN', 'FEB', 'MAR', 'APR'].forEach((mth, i) => {
    const x = 4 + i * 4;
    batch.box('ink', 0.07, 0.3, 0.8, x, railZ);
    dyn.add(floorText(mth, x + 0.25, railZ + 0.85, { h: 0.4, weight: 700, track: 0.1, align: 'left', opacity: 0.7 }));
  });
  const pointer = part(boxGeo(0.2, 0.9, 0.2), mats.accent, 3, 0.6, railZ);
  // "now": everything recorded to the left of this line is known when the question is asked
  const now = part(boxGeo(0.05, 0.02, 3.6), mats.glow, 3, 0.03, railZ - 1.7);
  now.castShadow = now.receiveShadow = false;
  dyn.add(pointer, now);

  const fileZ = Z - 4.5;
  batch.box('balsa', 9.4, 0.55, 1.5, 11, fileZ);
  const ben = part(boxGeo(3.0, 1.9, 0.14), mats.card, 8.4, 1.5, fileZ);
  const cora = part(boxGeo(3.0, 1.9, 0.14), mats.card, 13.6, -1.2, fileZ);
  ben.add(wallText('Atlas owner: Ben', 0, 0.3, 0.08, { h: 0.3, weight: 700 }), wallText('as known on February 15', 0, -0.3, 0.08, { h: 0.2, opacity: 0.7 }));
  cora.add(wallText('Atlas owner: Cora', 0, 0.3, 0.08, { h: 0.3, weight: 700 }), wallText('correction, recorded in March', 0, -0.3, 0.08, { h: 0.2, opacity: 0.7 }));
  const answer = part(boxGeo(3.2, 0.16, 0.5), mats.accent, 8.4, 0.63, fileZ + 0.55);
  dyn.add(ben, cora, answer);

  const tagP = new Vector3();
  ctx.tag('time-then', 'Asked on February 15', tagP, 'down');
  ctx.tag('time-then', 'Answer then: Ben', new Vector3(8.4, 3.3, fileZ), 'up');
  ctx.tag('time-now', 'Asked after the correction', tagP, 'down');
  ctx.tag('time-now', 'Answer now: Cora', new Vector3(13.6, 3.3, fileZ), 'up');

  const temporal: Station = {
    s0: S(1, 0),
    s1: S(1, 22),
    update(s, _t, m) {
      const px = clamp(m.z > Z - 0.1 ? m.x : s < S(1, 0) ? 2.6 : 17.4, 2.6, 17.4);
      pointer.position.x = px;
      pointer.position.y = 0.6 + 0.05 * Math.sin(_t * 3);
      now.position.x = px;
      const rec = w(s, 12.2, 13.4); // the correction is recorded in March
      cora.position.y = lerp(-1.2, 1.5, back(rec));
      const sw = w(s, 13.0, 14.2);
      answer.position.x = lerp(8.4, 13.6, sw);
      tagP.set(m.z > Z - 0.1 ? m.x : px, 0, Z + 0.9);
    },
  };

  return [plandesk, temporal];
}
