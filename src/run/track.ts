/**
 * The request's path: four rows joined by half-circle turns, front to back.
 * Row 1 runs left to right, row 2 right to left, and so on. Distances are in table units.
 */
import { BufferAttribute, BufferGeometry, Vector3 } from 'three';
import type { Batch } from './kit';

export const ROW_Z = [16.5, 5.5, -5.5, -16.5];
export const X0 = -32; // where rows 1 and 4 begin and end
export const XT = 24; // where the straights meet the turns
export const TURN_R = 5.5;
export const MARBLE_R = 0.5;
const TURN = Math.PI * TURN_R;
const L1 = XT - X0; // 56
const L2 = XT * 2; // 48
const START = [0, L1 + TURN, L1 + TURN + L2 + TURN, L1 + 2 * TURN + 2 * L2 + TURN];
export const TOTAL = START[3] + L1;
/** which row (0 to 3) a distance along the path belongs to; turns count with the row they leave */
export const rowAt = (s: number) => (s < START[1] ? 0 : s < START[2] ? 1 : s < START[3] ? 2 : 3);

/** distance along the path of the point at x on a row (1-based) */
export function S(row: 1 | 2 | 3 | 4, x: number): number {
  if (row === 1) return x - X0;
  if (row === 2) return START[1] + (XT - x);
  if (row === 3) return START[2] + (x + XT);
  return START[3] + (XT - x);
}

/** position (out) and unit direction (dir) at distance s */
export function at(s: number, out: Vector3, dir?: Vector3): Vector3 {
  s = Math.max(0, Math.min(TOTAL, s));
  const turn = (start: number, cx: number, cz: number, east: boolean) => {
    const a = ((s - start) / TURN) * Math.PI; // 0..pi
    const sx = east ? 1 : -1;
    out.set(cx + sx * Math.sin(a) * TURN_R, MARBLE_R, cz + Math.cos(a) * TURN_R);
    dir?.set(sx * Math.cos(a), 0, -Math.sin(a));
    return out;
  };
  if (s <= L1) {
    out.set(X0 + s, MARBLE_R, ROW_Z[0]);
    dir?.set(1, 0, 0);
  } else if (s < START[1]) return turn(L1, XT, (ROW_Z[0] + ROW_Z[1]) / 2, true);
  else if (s <= START[1] + L2) {
    out.set(XT - (s - START[1]), MARBLE_R, ROW_Z[1]);
    dir?.set(-1, 0, 0);
  } else if (s < START[2]) return turn(START[1] + L2, -XT, (ROW_Z[1] + ROW_Z[2]) / 2, false);
  else if (s <= START[2] + L2) {
    out.set(-XT + (s - START[2]), MARBLE_R, ROW_Z[2]);
    dir?.set(1, 0, 0);
  } else if (s < START[3]) return turn(START[2] + L2, XT, (ROW_Z[2] + ROW_Z[3]) / 2, true);
  else {
    out.set(XT - (s - START[3]), MARBLE_R, ROW_Z[3]);
    dir?.set(-1, 0, 0);
  }
  return out;
}

/** A strip between two offset curves of the path (offsets to the left of travel). */
export function ribbon(off0: number, y0: number, off1: number, y1: number, s0: number, s1: number): BufferGeometry {
  const p = new Vector3();
  const d = new Vector3();
  const n = Math.ceil((s1 - s0) / 0.35);
  const pos = new Float32Array((n + 1) * 6);
  for (let i = 0; i <= n; i++) {
    at(s0 + ((s1 - s0) * i) / n, p, d);
    const nx = d.z;
    const nz = -d.x; // left of travel
    pos.set([p.x + nx * off0, y0, p.z + nz * off0, p.x + nx * off1, y1, p.z + nz * off1], i * 6);
  }
  const idx: number[] = [];
  for (let i = 0; i < n; i++) {
    const a = i * 2;
    idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(pos, 3));
  g.setAttribute('uv', new BufferAttribute(new Float32Array((n + 1) * 4), 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

export const TRACK_W = 1.5;

/** The inlaid lane and its two balsa kerbs, from s0 to s1. */
export function buildTrack(batch: Batch, s0 = 0, s1 = TOTAL) {
  const w = TRACK_W / 2;
  batch.add('inlay', ribbon(-w, 0.022, w, 0.022, s0, s1));
  for (const side of [-1, 1]) {
    const a = side * w;
    const b = side * (w + 0.16);
    const h = 0.17;
    const [i, o] = side < 0 ? [b, a] : [a, b];
    batch.add('balsa', ribbon(i, h, o, h, s0, s1)); // top
    batch.add('balsa', ribbon(i, 0, i, h, s0, s1)); // one wall
    batch.add('balsa', ribbon(o, h, o, 0, s0, s1)); // the other
  }
}
