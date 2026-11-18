/**
 * Shared kit for the request run: palette, materials, a static-geometry batcher, canvas
 * text and small math helpers. Everything static is merged into one mesh per material.
 */
import {
  BoxGeometry,
  BufferGeometry,
  CanvasTexture,
  Color,
  CylinderGeometry,
  DoubleSide,
  Group,
  LinearFilter,
  LinearMipmapLinearFilter,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshMatcapMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  SRGBColorSpace,
  type Material,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const PAL = {
  card: '#f4f2ec',
  cardDim: '#e2ded3',
  balsa: '#e2cba0',
  table: '#efede7',
  room: '#dcd8cf',
  accent: '#2443d6',
  ink: '#25221f',
};

export const clamp = (x: number, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** smoothstep window: 0 before a, 1 after b */
export const ss = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
/** ease out with a small overshoot, so parts settle like physical things */
export const back = (x: number) => {
  const t = clamp(x) - 1;
  return 1 + 2.2 * t * t * t + 1.2 * t * t;
};
/** 0 to 1 and back again: for loops that must never jump at the wrap */
export const pingpong = (x: number) => {
  const f = x % 2;
  return f < 1 ? f : 2 - f;
};
/** grows in at the start of a 0..1 journey and shrinks away at its end */
export const inOut = (x: number) => (x <= 0 || x >= 1 ? 0 : Math.min(1, Math.sin(Math.PI * x) * 3.2));
/** rises a→b, falls c→d */
export const bump = (a: number, b: number, c: number, d: number, x: number) => ss(a, b, x) * (1 - ss(c, d, x));

/** 'inlay' is cardDim printed flat on the table: it receives shadows and casts none */
export type MatKey = 'card' | 'cardDim' | 'balsa' | 'accent' | 'ink' | 'grey' | 'inlay';

export interface Mats {
  card: MeshStandardMaterial;
  cardDim: MeshStandardMaterial;
  balsa: MeshStandardMaterial;
  accent: MeshStandardMaterial;
  ink: MeshStandardMaterial;
  grey: MeshStandardMaterial;
  /** the request, and the other requests: polished spheres */
  marble: MeshMatcapMaterial;
  ghost: MeshMatcapMaterial;
  glow: MeshBasicMaterial;
}

/** A polished-sphere lookup drawn once on a small canvas: no environment map to build. */
function matcap(light: string, base: string, dark: string): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  g.fillStyle = dark;
  g.fillRect(0, 0, 128, 128);
  const shade = g.createRadialGradient(50, 44, 6, 64, 64, 66);
  shade.addColorStop(0, light);
  shade.addColorStop(0.5, base);
  shade.addColorStop(1, dark);
  g.fillStyle = shade;
  g.fillRect(0, 0, 128, 128);
  const hi = g.createRadialGradient(44, 36, 0, 44, 36, 20);
  hi.addColorStop(0, 'rgba(255,255,255,0.95)');
  hi.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = hi;
  g.fillRect(0, 0, 128, 128);
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  return tex;
}

/** The marble's skin: a darker band and two dots, so its rolling is readable. */
function band(stripe: string | null): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = stripe ? 256 : 4;
  c.height = stripe ? 128 : 4;
  const g = c.getContext('2d')!;
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, c.width, c.height);
  if (stripe) {
    g.fillStyle = stripe;
    g.fillRect(0, 54, 256, 20);
    g.beginPath();
    g.arc(64, 26, 9, 0, 7);
    g.arc(192, 102, 9, 0, 7);
    g.fill();
  }
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  return tex;
}

export function makeMats(): Mats {
  const std = (color: string, roughness: number) => new MeshStandardMaterial({ color, roughness, metalness: 0 });
  return {
    card: std(PAL.card, 0.94),
    cardDim: std(PAL.cardDim, 0.96),
    balsa: std(PAL.balsa, 0.86),
    accent: std(PAL.accent, 0.5),
    ink: std(PAL.ink, 0.6),
    grey: std('#b4b1a9', 0.7),
    marble: new MeshMatcapMaterial({ matcap: matcap('#9fb0ff', PAL.accent, '#101c6e'), map: band('#c9d2ff') }),
    ghost: new MeshMatcapMaterial({ matcap: matcap('#fbfaf7', '#c4c1ba', '#7d7a73'), map: band(null) }),
    glow: new MeshBasicMaterial({ color: new Color(PAL.accent).multiplyScalar(1.6) }),
  };
}

const M = new Matrix4();
const unitBox = new BoxGeometry(1, 1, 1);

/** Collects static geometry per material and merges it once. */
export class Batch {
  private parts = new Map<MatKey, BufferGeometry[]>();
  add(mat: MatKey, g: BufferGeometry) {
    let list = this.parts.get(mat);
    if (!list) this.parts.set(mat, (list = []));
    list.push(g.index ? g.toNonIndexed() : g);
  }
  /** box by centre x/z, sitting on y0 */
  box(mat: MatKey, w: number, h: number, d: number, x: number, z: number, y0 = 0, ry = 0) {
    const g = unitBox.clone();
    M.makeRotationY(ry);
    g.scale(w, h, d).applyMatrix4(M).translate(x, y0 + h / 2, z);
    this.add(mat, g);
  }
  cyl(mat: MatKey, r: number, h: number, x: number, z: number, y0 = 0, seg = 24) {
    const g = new CylinderGeometry(r, r, h, seg);
    g.translate(x, y0 + h / 2, z);
    this.add(mat, g);
  }
  build(mats: Mats): Group {
    const group = new Group();
    for (const [key, list] of this.parts) {
      const merged = mergeGeometries(list, false);
      if (!merged) continue;
      const mesh = new Mesh(merged, key === 'inlay' ? mats.cardDim : mats[key]);
      mesh.receiveShadow = true;
      mesh.castShadow = key !== 'inlay';
      mesh.matrixAutoUpdate = false;
      group.add(mesh);
      for (const g of list) g.dispose();
    }
    this.parts.clear();
    return group;
  }
}

/** A moving part: its own mesh, casting and receiving shadows. */
export function part(geo: BufferGeometry, mat: Material, x = 0, y = 0, z = 0): Mesh {
  const m = new Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = m.receiveShadow = true;
  return m;
}
export const boxGeo = (w: number, h: number, d: number) => new BoxGeometry(w, h, d);

export interface TextOpts {
  /** world height of a line of text */
  h: number;
  color?: string;
  weight?: number;
  font?: string;
  align?: 'left' | 'center' | 'right';
  /** letter spacing in em */
  track?: number;
  opacity?: number;
}

const ATLAS = 2048;
let atlas: { canvas: HTMLCanvasElement; g: CanvasRenderingContext2D; tex: CanvasTexture; mat: MeshBasicMaterial; x: number; y: number; row: number } | null = null;
function getAtlas() {
  if (atlas) return atlas;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = ATLAS;
  const g = canvas.getContext('2d')!;
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = 8;
  tex.minFilter = LinearMipmapLinearFilter;
  tex.magFilter = LinearFilter;
  const mat = new MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, side: DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  return (atlas = { canvas, g, tex, mat, x: 0, y: 0, row: 0 });
}

/**
 * Ink printed on a plane. Every label is drawn into one shared 2048 px atlas (one texture
 * upload, one material), at a resolution that matches its size on the table.
 */
export function text(str: string, o: TextOpts): Mesh {
  const A = getAtlas();
  const g = A.g;
  const px = Math.min(96, Math.max(30, Math.round(o.h * 120)));
  const font = `${o.weight ?? 600} ${px}px ${o.font ?? "'Instrument Sans', system-ui, sans-serif"}`;
  g.font = font;
  (g as unknown as { letterSpacing: string }).letterSpacing = `${(o.track ?? 0) * px}px`;
  const lines = str.split('\n');
  const lineH = Math.round(px * 1.18);
  const pad = 6;
  const w = Math.min(ATLAS, Math.ceil(Math.max(...lines.map((l) => g.measureText(l).width))) + 12);
  const h = lineH * lines.length + 8;
  if (A.x + w + pad > ATLAS) {
    A.x = 0;
    A.y += A.row + pad;
    A.row = 0;
  }
  const x0 = A.x;
  const y0 = A.y;
  A.x += w + pad;
  A.row = Math.max(A.row, h);
  g.globalAlpha = o.opacity ?? 1;
  g.fillStyle = o.color ?? PAL.ink;
  g.textBaseline = 'alphabetic';
  g.textAlign = 'center';
  lines.forEach((l, i) => g.fillText(l, x0 + w / 2, y0 + lineH * i + px * 0.92));
  A.tex.needsUpdate = true;
  const k = o.h / px;
  const geo = new PlaneGeometry(w * k, h * k);
  if (o.align === 'left') geo.translate((w * k) / 2, 0, 0);
  if (o.align === 'right') geo.translate((-w * k) / 2, 0, 0);
  const u0 = x0 / ATLAS;
  const u1 = (x0 + w) / ATLAS;
  const v1 = 1 - y0 / ATLAS;
  const v0 = 1 - (y0 + h) / ATLAS;
  geo.attributes.uv.array.set([u0, v1, u1, v1, u0, v0, u1, v0]);
  const m = new Mesh(geo, A.mat);
  m.renderOrder = 2;
  return m;
}

/** A thin straight link between two points (a citation, a wire), drawn as a stretched box. */
export function link(mat: Material): Mesh {
  const m = new Mesh(new BoxGeometry(1, 1, 1).translate(0, 0, 0.5), mat);
  m.visible = false;
  return m;
}
export function setLink(m: Mesh, ax: number, ay: number, az: number, bx: number, by: number, bz: number, thick: number) {
  m.visible = thick > 0.002;
  if (!m.visible) return;
  m.position.set(ax, ay, az);
  m.lookAt(bx, by, bz);
  m.scale.set(thick, thick, Math.hypot(bx - ax, by - ay, bz - az));
}

/** Text lying on the table at (x, z), read from the front. */
export function floorText(str: string, x: number, z: number, o: TextOpts): Mesh {
  const m = text(str, o);
  m.rotation.x = -Math.PI / 2;
  m.position.set(x, 0.02, z);
  return m;
}

/** Text standing up, facing the front (+z), centred at (x, y, z). */
export function wallText(str: string, x: number, y: number, z: number, o: TextOpts): Mesh {
  const m = text(str, o);
  m.position.set(x, y, z);
  return m;
}
