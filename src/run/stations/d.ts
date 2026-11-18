/**
 * 04 Evaluation (agent-regression, Count Lineages), 05 Product (Turtledove) and the end
 * of the run, where the request becomes a response. This row runs right to left.
 */
import { Color, CylinderGeometry, Group, InstancedMesh, Matrix4, MeshStandardMaterial, Vector3 } from 'three';
import { PAL, back, boxGeo, clamp, floorText, inOut, lerp, part, pingpong, ss, wallText } from '../kit';
import { ROW_Z, S } from '../track';
import type { Ctx, Station } from '../types';

const Z = ROW_Z[3];

export function evaluation(ctx: Ctx): Station[] {
  const { batch, mats, dyn } = ctx;
  const w = (s: number, xa: number, xb: number) => ss(S(4, xa), S(4, xb), s);
  const inst = new MeshStandardMaterial({ color: '#ffffff', roughness: 0.7, envMapIntensity: 0.1 });
  const M = new Matrix4();
  const ink = new Color(PAL.ink);
  const accent = new Color(PAL.accent);
  const grey = new Color('#a8a49b');
  const arch = (x: number, h: number) => {
    batch.box('balsa', 0.3, h, 0.3, x, Z - 1.2);
    batch.box('balsa', 0.3, h, 0.3, x, Z + 1.2);
    batch.box('balsa', 0.8, 0.26, 3.0, x, Z, h);
  };

  // ---- agent-regression: 128 planted faults, a gate that opens only at 128 of 128 -------
  const COLS = 16;
  const ROWS = 8;
  const cx = (c: number) => 20.2 - c * 0.6;
  const rz = (r: number) => Z - 2.6 - r * 0.6;
  batch.box('card', 10.4, 0.1, 5.6, 15.7, Z - 4.7);
  for (const dz of [-2.87, 2.87]) batch.box('balsa', 10.7, 0.2, 0.14, 15.7, Z - 4.7 + dz);
  for (const dx of [-5.27, 5.27]) batch.box('balsa', 0.14, 0.2, 5.88, 15.7 + dx, Z - 4.7);
  dyn.add(floorText('128 PLANTED FAULTS, 8 TYPES', 15.7, Z - 1.75, { h: 0.28, weight: 700, track: 0.12, opacity: 0.6 }));
  const pins = new InstancedMesh(new CylinderGeometry(0.15, 0.15, 0.3, 14), inst, COLS * ROWS);
  pins.castShadow = pins.receiveShadow = true;
  dyn.add(pins);
  const bar = part(boxGeo(0.26, 0.16, 5.4), mats.ink, 21, 1.0, Z - 4.7);
  bar.add(part(boxGeo(0.14, 0.9, 0.14), mats.ink, 0, -0.5, -2.75), part(boxGeo(0.14, 0.9, 0.14), mats.ink, 0, -0.5, 2.75));
  dyn.add(bar);
  const gateX = 9.3;
  arch(gateX, 2.1);
  const boom = part(boxGeo(0.16, 0.2, 2.0), mats.ink, gateX, 0.75, Z);
  dyn.add(boom);
  dyn.add(floorText('RELEASE GATE', gateX, Z + 1.75, { h: 0.3, weight: 700, track: 0.14, opacity: 0.6 }));
  const tagBar = new Vector3();
  const count = ctx.tag('eval-plant', 'Caught: 0 of 128', tagBar, 'up');
  ctx.tag('eval-gate', '128 of 128 caught', new Vector3(gateX, 2.9, Z), 'up');
  let lastDone = -1;
  const regression: Station = {
    s0: S(4, 24) - 8,
    s1: S(4, 6),
    update(s, t, m) {
      const onRow = s >= S(4, 24);
      const bx = clamp(onRow ? m.x : 99, 10.6, 20.9);
      bar.position.x = bx;
      const done = Math.round(clamp((20.5 - bx) / 0.6, 0, COLS));
      // caught faults stand up in the accent colour, and a slow wave keeps running through them
      for (let c = 0; c < COLS; c++)
        for (let r = 0; r < ROWS; r++) {
          const i = c * ROWS + r;
          const hit = c < done;
          M.makeTranslation(cx(c), hit ? 0.3 + 0.07 * Math.max(0, Math.sin(t * 3 - c * 0.45 - r * 0.25)) ** 3 : 0.2, rz(r));
          pins.setMatrixAt(i, M);
          if (done !== lastDone) pins.setColorAt(i, hit ? accent : ink);
        }
      pins.instanceMatrix.needsUpdate = true;
      if (done !== lastDone) {
        lastDone = done;
        pins.instanceColor!.needsUpdate = true;
        count.set(`Caught: ${done * ROWS} of 128`);
      }
      boom.position.y = lerp(0.75, 1.95, back(w(s, 10.9, 10.3)));
      tagBar.set(bx, 1.4, Z - 3.2);
    },
  };

  // ---- Count Lineages: 1,151 models, 332 of them one family ------------------------------
  const TOTAL = 1151;
  const FAMILY = 332;
  const GC = 36;
  const gx = (i: number) => 4.9 - (i % GC) * 0.19;
  const gzz = (i: number) => Z - 2.5 - Math.floor(i / GC) * 0.19;
  const dishX = -5.4;
  const dishZ = Z - 5.2;
  batch.cyl('balsa', 2.35, 0.1, dishX, dishZ, 0, 48);
  batch.box('card', 7.1, 0.06, 6.3, 1.58, Z - 5.47);
  for (const dz of [-3.22, 3.22]) batch.box('balsa', 7.38, 0.16, 0.14, 1.58, Z - 5.47 + dz);
  for (const dx of [-3.62, 3.62]) batch.box('balsa', 0.14, 0.16, 6.58, 1.58 + dx, Z - 5.47);
  dyn.add(floorText('1,151 LEADERBOARD MODELS', 1.58, Z - 1.75, { h: 0.28, weight: 700, track: 0.12, opacity: 0.6 }));
  dyn.add(floorText('ONE FAMILY', dishX, dishZ + 2.75, { h: 0.28, weight: 700, track: 0.12, opacity: 0.6 }));
  const pegs = new InstancedMesh(new CylinderGeometry(0.07, 0.07, 0.24, 8), inst, TOTAL);
  pegs.castShadow = true;
  dyn.add(pegs);
  // which 332: scattered through the grid, so nothing about the grid gives them away
  const fam: number[] = [];
  const isFam = new Uint8Array(TOTAL);
  for (let i = 0, h = 7; fam.length < FAMILY; i++) {
    h = (h * 1103515245 + 12345) >>> 0;
    const k = h % TOTAL;
    if (!isFam[k]) {
      isFam[k] = 1;
      fam.push(k);
    }
  }
  for (let i = 0; i < TOTAL; i++) {
    M.makeTranslation(gx(i), 0.18, gzz(i));
    pegs.setMatrixAt(i, M);
    pegs.setColorAt(i, grey);
  }
  const col = new Color();
  ctx.tag('lineage', '1,151 models, counted as independent', new Vector3(1.58, 0.4, Z - 8.6), 'up');
  ctx.tag('lineage', 'One family, 332 (29%): it moves as one', new Vector3(dishX, 0, dishZ + 3.1), 'down');
  let lastMix = -1;
  const lineages: Station = {
    s0: S(4, 8),
    s1: S(4, -9),
    update(s, t) {
      const mix = w(s, 4.6, -1.6);
      // independent models drift each on their own; the family sways as one body
      const sway = Math.sin(t * 1.6);
      for (let i = 0; i < TOTAL; i++) {
        if (isFam[i]) continue;
        M.makeTranslation(gx(i), 0.18 + 0.045 * Math.sin(t * 2.2 + i * 2.399), gzz(i));
        pegs.setMatrixAt(i, M);
      }
      for (let n = 0; n < FAMILY; n++) {
        const i = fam[n];
        const q = clamp((mix - (n / FAMILY) * 0.6) / 0.4);
        const e = q * q * (3 - 2 * q);
        const r = 0.118 * Math.sqrt(n + 0.5);
        const a = n * 2.39996;
        M.makeTranslation(
          lerp(gx(i), dishX + Math.cos(a) * r + e * 0.16 * sway, e),
          0.18 + e * (0.1 + 0.07 * sway) + (1 - e) * 0.045 * Math.sin(t * 2.2 + i * 2.399) + Math.sin(Math.PI * q) * 0.9,
          lerp(gzz(i), dishZ + Math.sin(a) * r, e),
        );
        pegs.setMatrixAt(i, M);
        if (Math.abs(mix - lastMix) > 1e-4) pegs.setColorAt(i, col.copy(grey).lerp(accent, ss(0.1, 0.6, q)));
      }
      pegs.instanceMatrix.needsUpdate = true;
      if (Math.abs(mix - lastMix) > 1e-4) {
        lastMix = mix;
        pegs.instanceColor!.needsUpdate = true;
      }
    },
  };

  // ---- Turtledove: an assistant asks through MCP, the partner approves, both see the plan --
  const px = -15.7;
  const pz = Z - 4.6;
  const phone = new Group();
  phone.position.set(px, 0, pz);
  phone.rotation.x = -0.34;
  const body = part(boxGeo(3.0, 5.4, 0.3), mats.ink, 0, 2.7, 0);
  const screen = part(boxGeo(2.62, 5.0, 0.04), mats.card, 0, 2.7, 0.16);
  screen.castShadow = false;
  const house = (x: number) => {
    const h = part(boxGeo(0.74, 0.6, 0.06), mats.cardDim, x, 4.05, 0.2);
    const roof = part(boxGeo(0.56, 0.56, 0.06), mats.cardDim, x, 4.36, 0.2);
    roof.rotation.z = Math.PI / 4;
    h.castShadow = roof.castShadow = false;
    phone.add(h, roof);
  };
  house(-0.72);
  house(0.72);
  const line = part(boxGeo(1.9, 0.09, 0.06), mats.grey, 0, 3.35, 0.2);
  const planA = part(boxGeo(2.1, 0.42, 0.05), mats.cardDim, 0, 2.6, 0.2);
  const planB = part(boxGeo(2.1, 0.42, 0.05), mats.cardDim, 0, 2.02, 0.2);
  const planNew = part(boxGeo(2.1, 0.42, 0.07), mats.accent, 0, 1.44, 0.21);
  for (const m of [line, planA, planB, planNew]) m.castShadow = false;
  phone.add(body, screen, line, planA, planB, planNew);
  dyn.add(phone);
  batch.box('balsa', 3.6, 0.22, 2.0, px, pz + 0.1);
  dyn.add(floorText('TURTLEDOVE', px, pz + 1.9, { h: 0.3, weight: 700, track: 0.14, opacity: 0.6 }));

  const svX = -11.1;
  const svZ = Z - 4.3;
  batch.box('card', 2.0, 1.3, 1.6, svX, svZ);
  dyn.add(wallText('MCP SERVER', svX, 0.75, svZ + 0.81, { h: 0.2, weight: 700, track: 0.1 }));
  for (let i = 0; i < 32; i++) batch.cyl('ink', 0.07, 0.05, svX - 0.77 + (i % 8) * 0.22, svZ - 0.33 + Math.floor(i / 8) * 0.22, 1.3, 8);
  dyn.add(floorText('32 TOOLS', svX, svZ + 1.3, { h: 0.26, weight: 700, track: 0.14, opacity: 0.6 }));
  // the request comes off the lane into the server, then along the wire to the phone
  const wireZ = svZ - 0.2;
  batch.box('balsa', svX - px - 2.2, 0.08, 0.14, (svX + px) / 2, wireZ);
  const holdX = -13.1;
  batch.cyl('balsa', 0.16, 1.0, holdX, wireZ + 0.75, 0, 16);
  const lever = part(boxGeo(0.14, 0.9, 0.14).translate(0, 0.45, 0), mats.ink, holdX, 0.95, wireZ + 0.75);
  dyn.add(lever);
  dyn.add(floorText('APPROVE', holdX, wireZ + 1.5, { h: 0.24, weight: 700, track: 0.14, opacity: 0.6 }));
  const ask = part(boxGeo(0.5, 0.3, 0.36), mats.accent, svX, 0.3, wireZ);
  dyn.add(ask);
  // how MCP works: the assistant holds a client, the app runs a server, and they talk in
  // three steps: list the tools, call one, get the result back
  const hostX = -8.75;
  batch.box('card', 1.4, 1.6, 1.5, hostX, svZ);
  dyn.add(wallText('AI ASSISTANT', hostX, 1.05, svZ + 0.76, { h: 0.15, weight: 700, track: 0.08 }));
  dyn.add(wallText('MCP client', hostX, 0.6, svZ + 0.76, { h: 0.15, opacity: 0.7 }));
  batch.box('balsa', svX - hostX + 1.7, 0.08, 0.14, (svX + hostX) / 2, wireZ);
  dyn.add(floorText('MODEL SIDE', hostX, svZ + 1.3, { h: 0.24, weight: 700, track: 0.14, opacity: 0.6 }));
  const hop = (mat: typeof mats.accent, w2: number) => {
    const c = part(boxGeo(w2, 0.26, 0.34), mat, hostX, 0.3, wireZ);
    c.scale.setScalar(1e-3);
    dyn.add(c);
    return c;
  };
  const listAsk = hop(mats.accent, 0.4);
  const listBack = hop(mats.card, 0.7);
  const callOut = hop(mats.accent, 0.5);
  const result = hop(mats.accent, 0.5);
  const sweepBar = part(boxGeo(0.06, 0.05, 0.95), mats.glow, svX, 1.37, svZ);
  const chosen = part(new CylinderGeometry(0.09, 0.09, 0.09, 10), mats.glow, svX - 0.77 + 3 * 0.22, 1.38, svZ - 0.33 + 0.22);
  sweepBar.castShadow = chosen.castShadow = false;
  dyn.add(sweepBar, chosen);
  const hx = hostX - 0.75;
  const sx2 = svX + 1.05;
  ctx.tag('mcp', '1. What tools do you have?', new Vector3(hostX, 2.2, svZ), 'up');
  ctx.tag('mcp', '2. The server lists them: name, inputs', new Vector3(svX, 0, svZ + 1.9), 'down');
  ctx.tag('mcp', '3. The assistant calls one', new Vector3(svX, 2.9, svZ - 0.6), 'up');
  ctx.tag('product', 'Waits for a person to approve', new Vector3(holdX, 0, wireZ + 2.0), 'down');
  ctx.tag('product', 'The plan, shared with both', new Vector3(px, 4.2, pz - 1.2), 'up');
  ctx.tag('product', 'The result goes back to the model', new Vector3(svX, 2.4, svZ), 'up');
  const turtledove: Station = {
    s0: S(4, -6),
    s1: S(4, -21),
    update(s, t) {
      // 1. list the tools: a question out, a list back, and the server's tools light in turn
      const q = w(s, -7.4, -8.3);
      const a = w(s, -8.4, -9.3);
      listAsk.position.x = lerp(hx, sx2, q);
      listAsk.scale.setScalar(inOut(q) + 1e-3);
      listBack.position.x = lerp(sx2, hx, a);
      listBack.scale.setScalar(inOut(a) + 1e-3);
      const listing = a > 0 && a < 1;
      sweepBar.visible = listing;
      sweepBar.position.x = svX - 0.85 + 1.7 * ss(0, 1, pingpong(t * 1.3));
      // 2. call one tool: out to the server, along the wire, and it waits for approval
      const c = w(s, -9.4, -10.2);
      callOut.position.x = lerp(hx, sx2, c);
      callOut.scale.setScalar(inOut(c) + 1e-3);
      chosen.visible = c >= 1;
      chosen.scale.setScalar(1 + 0.15 * Math.sin(t * 3));
      const out = w(s, -10.3, -11.9);
      const approve = w(s, -12.3, -13.3);
      const go = w(s, -13.3, -14.7);
      const land = w(s, -14.7, -15.5);
      ask.position.x = lerp(lerp(svX - 1.0, holdX + 0.45, out), px + 1.55, go);
      ask.scale.setScalar(out * (1 - ss(0.85, 1, go)) * (1 + (approve < 0.5 ? 0.1 * Math.sin(t * 4) : 0)) + 1e-4);
      lever.rotation.z = lerp(-0.7, 0.7, approve);
      planNew.scale.set(back(land) + 1e-4, back(land) + 1e-4, 1);
      line.material = land > 0.5 ? mats.accent : mats.grey;
      // 3. the result goes all the way back to the model's side
      const r = w(s, -15.4, -16.3);
      result.position.x = lerp(px + 1.55, hx, r);
      result.scale.setScalar(inOut(r) + 1e-3);
    },
  };

  // ---- the end: the response, and the path that led here ---------------------------------
  batch.cyl('accent', 0.66, 0.02, -30, Z, 0.022, 40);
  batch.cyl('cardDim', 0.5, 0.024, -30, Z, 0.022, 40);
  dyn.add(floorText('RESPONSE', -30, Z + 1.75, { h: 0.3, weight: 700, track: 0.14, opacity: 0.6 }));
  const steps: [string, string, number][] = [
    ['2019', 'COGNIZANT', 0.8],
    ['2021', 'NORTHEASTERN', 1.3],
    ['2022', 'AFFINIA', 1.8],
    ['2023', 'FIDELITY', 2.4],
  ];
  steps.forEach(([year, org, h], i) => {
    const x = -22.6 - i * 2.9;
    const z = Z - 4.4;
    batch.box('card', 2.3, h, 2.3, x, z);
    if (i === 3) batch.box('accent', 2.3, 0.1, 2.3, x, z, h);
    dyn.add(wallText(year, x, h - 0.38, z + 1.16, { h: 0.34, weight: 700 }));
    dyn.add(floorText(org, x, z + 1.75, { h: 0.24, weight: 700, track: 0.1, opacity: 0.7 }));
  });

  return [regression, lineages, turtledove];
}
