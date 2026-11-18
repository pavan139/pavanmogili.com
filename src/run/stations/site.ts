/**
 * The site around the stations: a numbered pad at every stop, a gateway at each turn that
 * names the part of the system the request is entering, the model's base, cap and tunnel
 * portals, and a line of ink that follows the request, so the path it has taken stays drawn.
 */
import { Mesh, MeshBasicMaterial, Vector3 } from 'three';
import type { Beat } from '../beats';
import { floorText, wallText } from '../kit';
import { ROW_Z, TURN_R, XT, at, ribbon, TOTAL } from '../track';
import type { Ctx } from '../types';

export function site(ctx: Ctx, beats: Beat[]): { trail(s: number): void } {
  const { batch, mats, dyn } = ctx;
  const p = new Vector3();

  // a balsa ring where the marble rests, and the stop's number beside the lane
  beats.forEach((b, i) => {
    if (b.id === 'model') return;
    at(b.s, p);
    if (i > 0 && i < beats.length - 1 && b.id !== 'rag-ask') {
      batch.cyl('balsa', 0.66, 0.016, p.x, p.z, 0.022, 36);
      batch.cyl('cardDim', 0.56, 0.02, p.x, p.z, 0.022, 36);
    }
    dyn.add(floorText(String(i + 1).padStart(2, '0'), p.x, p.z + 1.22, { h: 0.24, weight: 700, track: 0.08, opacity: 0.5 }));
  });

  // gateways: each turn passes under the name of the part the request is entering
  const gateway = (x: number, z: number, name: string) => {
    batch.box('balsa', 0.36, 3.3, 0.36, x - 1.3, z);
    batch.box('balsa', 0.36, 3.3, 0.36, x + 1.3, z);
    batch.box('balsa', 5.0, 0.56, 0.5, x, z, 3.3);
    batch.box('accent', 5.0, 0.07, 0.5, x, z, 3.86);
    dyn.add(wallText(name, x, 3.58, z + 0.26, { h: 0.25, weight: 700, track: 0.14 }));
  };
  const apex = XT + TURN_R;
  gateway(apex, (ROW_Z[0] + ROW_Z[1]) / 2, 'INFERENCE');
  gateway(-apex, (ROW_Z[1] + ROW_Z[2]) / 2, 'AGENTS AND TOOLS');
  gateway(apex, (ROW_Z[2] + ROW_Z[3]) / 2, 'EVALUATION');

  // the model: a base course, a cap, and a balsa portal where the lane goes in and comes out
  const Z = ROW_Z[1];
  for (const side of [-1, 1]) {
    batch.box('ink', 8.5, 0.34, 3.3, 0, Z + side * 2.6);
    batch.box('balsa', 0.24, 1.75, 0.24, side * 4.06, Z - 1.05);
    batch.box('balsa', 0.24, 1.75, 0.24, side * 4.06, Z + 1.05);
    batch.box('balsa', 0.24, 0.24, 2.34, side * 4.06, Z, 1.6);
  }
  batch.box('ink', 8.5, 0.3, 8.5, 0, Z, 7);

  // the path taken so far, drawn in the accent colour from the start to the marble
  const geo = ribbon(-0.075, 0.062, 0.075, 0.062, 0, TOTAL);
  const segments = geo.index!.count / 6;
  // its own material, pulled towards the camera, so it can never fight the pads under it
  const line = new Mesh(geo, new MeshBasicMaterial({ color: mats.glow.color, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }));
  line.frustumCulled = false;
  line.renderOrder = 1;
  geo.setDrawRange(0, 0);
  dyn.add(line);
  let last = -1;
  return {
    trail(s) {
      const n = Math.floor((s / TOTAL) * segments);
      if (n !== last) geo.setDrawRange(0, (last = n) * 6);
    },
  };
}
