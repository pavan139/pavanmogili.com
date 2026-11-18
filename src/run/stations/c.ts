/**
 * 03 Agents and tools. capability-guard (a signed permission opens one door, once) and
 * resilient-agent-runtime (a credit survives a crash and is not applied twice).
 */
import { ConeGeometry, CylinderGeometry, TorusGeometry, Vector3 } from 'three';
import { boxGeo, clamp, floorText, lerp, part, ss, wallText } from '../kit';
import { ROW_Z, S } from '../track';
import type { Ctx, Station } from '../types';

const Z = ROW_Z[2];

export function agents(ctx: Ctx): Station[] {
  const { batch, mats, dyn } = ctx;
  const w = (s: number, xa: number, xb: number) => ss(S(3, xa), S(3, xb), s);

  // ---- capability-guard ----------------------------------------------------------------
  const arch = (x: number, z: number, h: number) => {
    batch.box('balsa', 0.3, h, 0.3, x, z - 1.2);
    batch.box('balsa', 0.3, h, 0.3, x, z + 1.2);
    batch.box('balsa', 0.8, 0.26, 3.0, x, z, h);
  };
  const issueX = -19.5;
  arch(issueX, Z, 2.3);
  dyn.add(floorText('ISSUER', issueX, Z + 1.75, { h: 0.3, weight: 700, track: 0.14, opacity: 0.6 }));
  const ringGeo = new TorusGeometry(0.62, 0.07, 10, 40);
  ringGeo.rotateX(Math.PI / 2);
  const ring = part(ringGeo, mats.accent, issueX, 1.9, Z);
  // the issuer signs: a stamp comes down on the capability as it is handed over
  const signer = part(boxGeo(0.5, 0.5, 0.5), mats.ink, issueX, 2.9, Z);
  dyn.add(ring, signer);

  const doorX = -9.5;
  const zB = Z - 2.9;
  arch(doorX, Z, 2.1);
  const doorBX = doorX - 3.2;
  arch(doorBX, zB, 2.1);
  batch.box('cardDim', 6.6, 0.022, 1.5, doorBX - 2.5, zB);
  batch.box('balsa', 6.6, 0.17, 0.16, doorBX - 2.5, zB - 0.83);
  batch.box('balsa', 6.6, 0.17, 0.16, doorBX - 2.5, zB + 0.83);
  dyn.add(wallText('GRANTED', doorX, 2.23, Z + 1.52, { h: 0.2, weight: 700, track: 0.12 }));
  dyn.add(wallText('NOT GRANTED', doorBX, 2.23, zB + 1.52, { h: 0.2, weight: 700, track: 0.12 }));
  const doorA = part(boxGeo(0.5, 1.7, 2.0), mats.ink, doorX, 0.87, Z);
  const doorB = part(boxGeo(0.5, 1.7, 2.0), mats.ink, doorBX, 0.87, zB);
  // the reader beside the granted door, where the capability is spent
  batch.cyl('balsa', 0.16, 1.0, doorX - 1.1, Z + 1.35, 0, 16);
  const ghost = part(ctx.sphere, mats.ghost, -17, 0.5, zB);
  const copy = part(ringGeo, mats.grey, -15, 1.25, zB);
  // a lamp on each door: lit only while a valid capability holds it open
  const lampA = part(boxGeo(0.34, 0.34, 0.34), mats.glow, doorX, 2.55, Z);
  const lampB = part(boxGeo(0.34, 0.34, 0.34), mats.grey, doorBX, 2.55, zB);
  lampA.castShadow = lampB.castShadow = false;
  dyn.add(doorA, doorB, ghost, copy, lampA, lampB);

  const tagR = new Vector3();
  ctx.tag('cap-issue', 'Signed capability: one resource, one use', tagR, 'up');
  ctx.tag('cap-door', 'Granted: opened once, now spent', new Vector3(doorX, 2.9, Z), 'down');
  ctx.tag('cap-door', 'Not granted: stays shut', new Vector3(doorBX, 2.9, zB), 'up');

  const capability: Station = {
    s0: S(3, -24) - 6,
    s1: S(3, -2),
    update(s, t, m) {
      const take = w(s, issueX - 0.7, issueX + 0.5);
      const spend = w(s, doorX - 2.6, doorX - 1.4);
      const rx = lerp(lerp(issueX, m.x, take), doorX - 1.1, spend);
      const ry = lerp(lerp(1.9, 1.22 + Math.sin(t * 2.2) * 0.03, take), 1.06, spend);
      const rz = lerp(Z, Z + 1.35, spend);
      ring.position.set(rx, ry, rz);
      ring.scale.setScalar(lerp(1, 0.6, spend));
      ring.material = spend > 0.98 ? mats.grey : mats.accent;
      signer.position.y = 2.9 - 0.75 * Math.sin(Math.PI * w(s, issueX - 1.6, issueX + 0.2));
      // the granted door lifts for this capability, then shuts behind the marble
      const open = w(s, doorX - 1.7, doorX - 0.9) * (1 - w(s, doorX + 0.9, doorX + 1.9));
      doorA.position.y = 0.87 + 1.75 * open;
      lampA.visible = open > 0.05;
      lampA.scale.setScalar(1 + 0.1 * Math.sin(t * 3));
      // another request tries the other door with a copy; it never opens
      const g = (t * 0.2) % 1;
      const gx = lerp(-17.6, doorBX - 0.9, ss(0.05, 0.5, g)) - 0.3 * Math.sin(Math.PI * clamp((g - 0.5) / 0.1));
      const vis = ss(0, 0.06, g) * (1 - ss(0.82, 0.94, g));
      ghost.position.x = gx;
      ghost.rotation.z = -gx * 2;
      ghost.scale.setScalar(vis);
      copy.position.x = gx;
      copy.scale.setScalar(vis * 0.8 + 1e-4);
      doorB.position.x = doorBX + 0.04 * Math.sin(t * 26) * ss(0.49, 0.52, g) * (1 - ss(0.56, 0.62, g));
      tagR.set(rx, ry + 0.2, rz);
    },
  };

  // ---- the agent loop: ask, check, run, return, and round again -------------------------
  const LX = -1.6;
  const LZ = Z - 4.3;
  const LR = 1.9;
  batch.add('balsa', new TorusGeometry(LR, 0.07, 8, 72).rotateX(Math.PI / 2).translate(LX, 0.16, LZ));
  const node = (k: number) => [LX + LR * Math.sin((k * Math.PI) / 2), LZ + LR * Math.cos((k * Math.PI) / 2)] as const;
  for (let k = 0; k < 4; k++) batch.cyl('card', 0.4, 0.42, node(k)[0], node(k)[1], 0, 28);
  dyn.add(floorText('MODEL ASKS', node(0)[0], node(0)[1] + 0.78, { h: 0.26, weight: 700, track: 0.12, opacity: 0.7 }));
  dyn.add(floorText('PERMISSION', node(1)[0] + 0.85, node(1)[1], { h: 0.26, weight: 700, track: 0.12, align: 'left', opacity: 0.7 }));
  dyn.add(floorText('TOOL RUNS', node(2)[0], node(2)[1] - 0.78, { h: 0.26, weight: 700, track: 0.12, opacity: 0.7 }));
  dyn.add(floorText('RESULT BACK', node(3)[0] - 0.85, node(3)[1], { h: 0.26, weight: 700, track: 0.12, align: 'right', opacity: 0.7 }));
  const turn = part(ctx.sphere, mats.marble, LX, 0.66, LZ);
  turn.scale.setScalar(0.5);
  const lit = part(new CylinderGeometry(0.4, 0.4, 0.035, 28), mats.glow, LX, 0.438, LZ);
  // arrowheads on the ring: which way round the loop goes
  for (let k = 0; k < 4; k++) {
    const th = ((k + 0.5) * Math.PI) / 2;
    batch.add('balsa', new ConeGeometry(0.15, 0.4, 12).rotateZ(-Math.PI / 2).rotateY(th).translate(LX + LR * Math.sin(th), 0.16, LZ + LR * Math.cos(th)));
  }
  lit.castShadow = false;
  dyn.add(turn, lit);
  ctx.tag('agent-loop', 'Round again until the task is done', new Vector3(LX, 1.4, LZ - LR - 1.3), 'up');
  const loop: Station = {
    s0: S(3, -9),
    s1: S(3, 6),
    update(_s, t) {
      // move for two thirds of each quarter, rest on the node for the last third
      const c = (t * 0.42) % 4;
      const k = Math.floor(c);
      const a = ((k + ss(0, 0.66, c - k)) * Math.PI) / 2;
      turn.position.set(LX + LR * Math.sin(a), 0.71, LZ + LR * Math.cos(a));
      turn.rotation.x = a * 3;
      const at = c - k > 0.66 ? (k + 1) % 4 : -1;
      lit.visible = at >= 0;
      if (at >= 0) lit.position.set(node(at)[0], 0.45, node(at)[1]);
    },
  };

  // ---- resilient-agent-runtime ----------------------------------------------------------
  const bz = Z - 3.4;
  const sx = 5.4;
  const rx0 = 12;
  const lx = 14.6;
  batch.box('balsa', rx0 - sx - 2.4, 0.12, 0.3, (sx + rx0) / 2, bz);
  batch.box('card', 2.4, 1.7, 1.9, rx0, bz);
  dyn.add(wallText('RECEIVER', rx0, 1.0, bz + 0.96, { h: 0.26, weight: 700, track: 0.1 }));
  batch.box('balsa', 1.6, 0.12, 1.6, lx, bz);
  dyn.add(floorText('LEDGER', lx, bz + 1.25, { h: 0.26, weight: 700, track: 0.14, opacity: 0.6 }));
  // the sender pivots on its bottom-left edge, so a crash tips it flat on the table
  const sender = part(boxGeo(2.4, 1.7, 1.9).translate(1.2, 0.85, 0), mats.card, sx - 1.2, 0, bz);
  sender.add(wallText('SENDER', 1.2, 1.0, 0.96, { h: 0.26, weight: 700, track: 0.1 }));
  const msg = part(boxGeo(0.62, 0.36, 0.44), mats.accent, sx, 0.4, bz);
  const ack = part(boxGeo(0.36, 0.22, 0.3), mats.grey, rx0, 0.3, bz + 0.5);
  const ackB = part(boxGeo(0.36, 0.22, 0.3), mats.grey, rx0, 0.3, bz + 0.5);
  const credit = part(boxGeo(1.15, 0.24, 1.15), mats.accent, lx, 2, bz);
  const dupe = part(boxGeo(1.15, 0.24, 1.15), mats.grey, lx, 2, bz);
  const seen = part(boxGeo(0.5, 0.1, 0.5), mats.accent, rx0, 1.75, bz);
  const done = part(boxGeo(0.5, 0.1, 0.5), mats.accent, 1.2, 1.75, 0);
  sender.add(done);
  dyn.add(sender, msg, ack, ackB, credit, dupe, seen);

  ctx.tag('crash-commit', 'Credit committed', new Vector3(lx, 1.0, bz), 'up');
  ctx.tag('crash-commit', 'Crashed before recording it', new Vector3(sx - 1.4, 1.6, bz), 'up');
  ctx.tag('crash-retry', 'Seen before: not applied again', new Vector3(rx0, 2.3, bz), 'up');
  ctx.tag('crash-retry', 'Ledger: still one credit', new Vector3(lx, 0.7, bz), 'down');

  const a = sx + 1.5;
  const b = rx0 - 1.5;
  const runtime: Station = {
    s0: S(3, -1),
    s1: S(3, 20),
    update(s, t) {
      const send1 = w(s, 1, 4);
      const commit = w(s, 4, 5);
      const ack1 = w(s, 5, 7);
      const crash = w(s, 6, 6.9) * (1 - w(s, 8.2, 9.4));
      const send2 = w(s, 9.4, 12);
      const check = w(s, 12, 13.5);
      const ack2 = w(s, 13.5, 15.5);
      // the message: out once, back in the outbox after the crash, out again
      const mx = send2 > 0 ? lerp(a, b, send2) : w(s, 8.6, 9.4) > 0 ? a : lerp(a, b, send1);
      const mHide = send2 > 0 ? ss(0.9, 1, send2) : ss(0.9, 1, send1) * (1 - w(s, 8.6, 9.4));
      msg.position.x = mx;
      msg.scale.setScalar(1 - mHide + 1e-4);
      credit.position.y = lerp(2.4, 0.24, commit);
      credit.scale.setScalar(commit + 1e-4);
      seen.scale.setScalar(commit * (1 + 0.5 * Math.sin(Math.PI * check)) + 1e-4);
      // it shudders, then goes down
      sender.rotation.z = crash * 1.5 + w(s, 5.4, 6) * (1 - w(s, 6, 6.3)) * 0.05 * Math.sin(t * 46);
      // the first acknowledgement never lands: the sender is down, it drops to the table
      const fall = ss(0.5, 0.75, ack1);
      // it stays where it fell; the second acknowledgement is a new one
      ack.position.set(lerp(b, a, Math.min(ack1, 0.5)), lerp(0.3, 0.12, fall), bz + 0.5 + fall * 0.9);
      ack.scale.setScalar(ss(0, 0.1, ack1) + 1e-4);
      ackB.position.x = lerp(b, a, ack2);
      ackB.scale.setScalar(Math.min(1, ack2 * 8) * (1 - ss(0.9, 1, ack2)) + 1e-4);
      done.scale.setScalar(ss(0.9, 1, ack2) + 1e-4);
      // a second credit shows up and is turned away
      const show = ss(0, 0.35, check);
      const off = ss(0.4, 1, check);
      dupe.position.set(lx + off * 2.2, 1.5 - off * 0.3, bz - off * 0.6);
      dupe.rotation.z = -off * 1.2;
      dupe.scale.setScalar(show * (1 - ss(0.75, 1, check)) + 1e-4);
    },
  };

  return [capability, loop, runtime];
}
