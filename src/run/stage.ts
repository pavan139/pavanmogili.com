/**
 * The stage: renderer, light, soft shadows that follow the view, the table, the marble,
 * a calm fixed-heading camera and one post pass (tilt-shift, vignette, grain, tone map).
 */
import {
  BoxGeometry,
  CanvasTexture,
  Color,
  DirectionalLight,
  Group,
  HalfFloatType,
  HemisphereLight,
  LinearSRGBColorSpace,
  Mesh,
  MeshStandardMaterial,
  OrthographicCamera,
  PCFShadowMap,
  PerspectiveCamera,
  PlaneGeometry,
  Quaternion,
  RepeatWrapping,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
  WebGLRenderTarget,
} from 'three';
import { PAL, clamp, lerp, ss, type Mats } from './kit';
import { MARBLE_R } from './track';

export interface Framing {
  /** look-at point */
  x: number;
  z: number;
  /** table width and depth that must fit in the free part of the screen */
  w: number;
  d: number;
  pitch?: number;
  yaw?: number;
}
export interface Insets {
  left: number;
  top: number;
  bottom: number;
}

const SUN = new Vector3(-0.46, 0.8, -0.4).normalize();
const FOV = 26;
const TAN = Math.tan((FOV * Math.PI) / 360);

export const TABLE = { w: 77, d: 58 };

const POST_FRAG = /* glsl */ `
precision highp float;
uniform sampler2D tScene;
uniform vec2 uRes;
uniform float uFocus;
uniform float uBlur;
uniform float uTime;
varying vec2 vUv;
vec3 neutral(vec3 c) {
  float x = min(c.r, min(c.g, c.b));
  float off = x < 0.08 ? x - 6.25 * x * x : 0.04;
  c -= off;
  float peak = max(c.r, max(c.g, c.b));
  if (peak < 0.76) return c;
  float d = 0.24;
  float np = 1.0 - d * d / (peak + d - 0.76);
  c *= np / peak;
  float g = 1.0 - 1.0 / (0.15 * (peak - np) + 1.0);
  return mix(c, vec3(np), g);
}
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main() {
  vec3 col = texture2D(tScene, vUv).rgb;
#ifdef BLUR
  float r = uBlur * smoothstep(0.2, 0.7, abs(vUv.y - uFocus));
  if (r > 0.3) {
    vec3 acc = col;
    float a = hash(gl_FragCoord.xy) * 6.2831;
    for (int i = 1; i <= TAPS; i++) {
      float fi = float(i);
      float rad = r * sqrt(fi / float(TAPS));
      a += 2.39996;
      acc += texture2D(tScene, vUv + vec2(cos(a), sin(a)) * rad / uRes).rgb;
    }
    col = acc / float(TAPS + 1);
  }
#endif
  vec2 q = vUv - 0.5;
  col *= 1.0 - 0.32 * smoothstep(0.35, 0.95, length(q * vec2(1.0, 0.85)) * 1.25);
  col = neutral(col * 1.13);
  col = mix(col * 12.92, 1.055 * pow(max(col, vec3(0.0)), vec3(1.0 / 2.4)) - 0.055, step(0.0031308, col));
  col += (hash(gl_FragCoord.xy) - 0.5) * 0.012;
  gl_FragColor = vec4(col, 1.0);
}`;

export class Stage {
  renderer: WebGLRenderer;
  scene = new Scene();
  camera = new PerspectiveCamera(FOV, 1, 2, 600);
  /** static world goes here once merged; moving parts are added by stations */
  world = new Group();
  marble: Mesh;
  width = 1;
  height = 1;
  pixelRatio = 1;
  insets: Insets = { left: 0, top: 0, bottom: 0 };
  private ins: Insets = { left: 0, top: 0, bottom: 0 };

  private sun = new DirectionalLight('#fff4e6', 1.6);
  private rt: WebGLRenderTarget;
  private post: ShaderMaterial;
  private postScene = new Scene();
  private postCam = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private cur = { x: 0, z: 0, dist: 150, pitch: 52, yaw: 0, ready: false };
  private lightR = new Vector3();
  private lightU = new Vector3();
  private shadowExt = 0;
  private tmp = new Vector3();
  private q = new Quaternion();
  private axis = new Vector3();
  private maxRatio: number;

  constructor(
    public root: HTMLElement,
    mats: Mats,
    opts: { pixelBudget: number; msaa: number; post: number; shadows: boolean },
  ) {
    const r = (this.renderer = new WebGLRenderer({ antialias: false, alpha: false, powerPreference: 'high-performance', stencil: false }));
    // the scene is drawn in linear light and converted once, in the post pass; keeping the
    // renderer linear too means every material compiles one program, not two
    r.outputColorSpace = LinearSRGBColorSpace;
    r.setClearColor(PAL.room);
    r.shadowMap.enabled = opts.shadows;
    r.shadowMap.type = PCFShadowMap;
    r.domElement.setAttribute('aria-hidden', 'true');
    root.prepend(r.domElement);
    this.maxRatio = Math.min(devicePixelRatio || 1, 2.5);
    this.budget = opts.pixelBudget;

    const s = this.scene;
    s.background = new Color(PAL.room);
    s.add(new HemisphereLight('#f2f4f8', '#ded8cd', 2.0));
    const sun = this.sun;
    sun.castShadow = opts.shadows;
    const mapSize = opts.msaa >= 4 ? 2048 : 1536;
    sun.shadow.mapSize.set(mapSize, mapSize);
    sun.shadow.bias = -0.0006;
    sun.shadow.normalBias = 0.03;
    sun.shadow.radius = 2.2;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 260;
    s.add(sun, sun.target);
    // light-space axes for texel snapping
    this.lightR.crossVectors(new Vector3(0, 1, 0), SUN).normalize();
    this.lightU.crossVectors(SUN, this.lightR).normalize();

    // the table: a printed sheet with a faint 4-unit grid, on a balsa slab
    const grid = document.createElement('canvas');
    grid.width = grid.height = 256;
    const g = grid.getContext('2d')!;
    g.fillStyle = PAL.table;
    g.fillRect(0, 0, 256, 256);
    g.strokeStyle = 'rgba(40, 36, 30, 0.085)';
    g.lineWidth = 2;
    g.strokeRect(0, 0, 256, 256);
    const tex = new CanvasTexture(grid);
    tex.colorSpace = SRGBColorSpace;
    tex.wrapS = tex.wrapT = RepeatWrapping;
    tex.repeat.set(TABLE.w / 4, TABLE.d / 4);
    tex.anisotropy = Math.min(8, r.capabilities.getMaxAnisotropy());
    // a thick sheet, so nothing lies in the same plane as the slab under it
    // cut into small faces: depth across one table-sized triangle is not exact enough to
    // keep the lane's inlay (a fiftieth of a unit above) reliably on top
    const sheet = new BoxGeometry(TABLE.w, 0.4, TABLE.d, 28, 1, 22);
    const top = new Mesh(sheet, new MeshStandardMaterial({ map: tex, roughness: 0.95 }));
    top.position.y = -0.2;
    top.receiveShadow = true;
    const floor = new Mesh(new PlaneGeometry(1400, 1400), new MeshStandardMaterial({ color: PAL.room, roughness: 1 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -3;
    floor.receiveShadow = true;
    s.add(top, floor, this.world);

    // the marble: the request
    this.marble = new Mesh(new SphereGeometry(MARBLE_R, 48, 32), mats.marble);
    this.marble.castShadow = true;
    s.add(this.marble);

    this.rt = new WebGLRenderTarget(4, 4, { samples: opts.msaa, type: HalfFloatType, depthBuffer: true });
    this.post = new ShaderMaterial({
      uniforms: { tScene: { value: this.rt.texture }, uRes: { value: [1, 1] }, uFocus: { value: 0.5 }, uBlur: { value: 0 }, uTime: { value: 0 } },
      defines: opts.post > 0 ? { BLUR: 1, TAPS: opts.post > 1 ? 12 : 6 } : {},
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: POST_FRAG,
      depthTest: false,
      depthWrite: false,
    });
    const quad = new Mesh(new PlaneGeometry(2, 2), this.post);
    quad.frustumCulled = false;
    this.postScene.add(quad);
  }

  budget: number;

  resize(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.applyRatio();
    this.cur.ready = false;
  }

  /** scale the drawing buffer (the governor calls this) */
  scale = 1;
  applyRatio() {
    const cap = Math.sqrt(this.budget / (this.width * this.height));
    const pr = Math.max(0.5, Math.min(this.maxRatio, cap) * this.scale);
    this.pixelRatio = pr;
    this.renderer.setPixelRatio(pr);
    this.renderer.setSize(this.width, this.height, false);
    const w = Math.round(this.width * pr);
    const h = Math.round(this.height * pr);
    this.rt.setSize(w, h);
    this.post.uniforms.uRes.value = [w, h];
    this.camera.aspect = this.width / this.height;
  }

  /** roll the marble to p (it has moved by `moved` along `dir`) */
  private last = new Vector3(NaN, 0, 0);
  setMarble(p: Vector3) {
    const m = this.marble;
    if (!Number.isNaN(this.last.x)) {
      this.tmp.subVectors(p, this.last);
      const dist = this.tmp.length();
      if (dist > 1e-5 && dist < 5) {
        this.axis.set(this.tmp.z, 0, -this.tmp.x).normalize();
        this.q.setFromAxisAngle(this.axis, dist / MARBLE_R);
        m.quaternion.premultiply(this.q);
      }
    }
    this.last.copy(p);
    m.position.copy(p);
  }

  /** the next frame() jumps straight to its framing (after a cut) */
  snap() {
    this.cur.ready = false;
  }

  /** ease the camera towards a framing; rate is 1/s (higher is snappier) */
  frame(f: Framing, dt: number, rate: number) {
    const { width: W, height: H } = this;
    // the panel's footprint eases too: when it changes, the view glides instead of jumping
    const insets = this.ins;
    const ki = this.cur.ready ? 1 - Math.exp(-3 * dt) : 1;
    insets.left = lerp(insets.left, this.insets.left, ki);
    insets.top = lerp(insets.top, this.insets.top, ki);
    insets.bottom = lerp(insets.bottom, this.insets.bottom, ki);
    const freeW = Math.max(120, W - insets.left);
    const freeH = Math.max(120, H - insets.top - insets.bottom);
    const pitch = f.pitch ?? 50;
    // wide screens have room to show each stop's surroundings
    // (the factor fades out for wide shots, so zooming between a stop and the whole table has no jump)
    const roomy = freeW / freeH > 1.15 ? lerp(1.4, 1, ss(18, 42, f.w)) : 1;
    const sinP = Math.sin((pitch * Math.PI) / 180);
    const dW = (((f.w * roomy) / 2) * H) / (freeW * TAN);
    const dH = (((f.d * sinP) / 2 + 1.2) * H) / (freeH * TAN);
    const dist = Math.max(dW, dH);
    const c = this.cur;
    const k = c.ready ? 1 - Math.exp(-rate * dt) : 1;
    c.ready = true;
    c.x = lerp(c.x, f.x, k);
    c.z = lerp(c.z, f.z, k);
    c.dist = lerp(c.dist, dist, k);
    c.pitch = lerp(c.pitch, pitch, k);
    c.yaw = lerp(c.yaw, f.yaw ?? 0, k);
    const p = (c.pitch * Math.PI) / 180;
    const y = (c.yaw * Math.PI) / 180;
    const cam = this.camera;
    cam.position.set(c.x + Math.sin(y) * Math.cos(p) * c.dist, Math.sin(p) * c.dist, c.z + Math.cos(y) * Math.cos(p) * c.dist);
    cam.lookAt(c.x, 0.4, c.z);
    // keep the subject in the part of the screen the panel leaves free
    const shiftX = insets.left / 2;
    const shiftY = (insets.bottom - insets.top) / 2;
    cam.setViewOffset(W, H, -shiftX, shiftY, W, H);
    // a tight depth range keeps thin inlays on the table from flickering against it
    cam.near = Math.max(2, c.dist * 0.45);
    cam.far = c.dist * 2.6 + 80;
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld();

    // the shadow frustum follows the view and snaps to whole texels, so edges do not crawl
    const want = clamp(c.dist * TAN * Math.max(W / H, 1 / sinP) * 1.12 + 3, 12, 64);
    const ext = want > this.shadowExt || want < this.shadowExt * 0.6 ? Math.ceil(want / 8) * 8 : this.shadowExt;
    const sc = this.sun.shadow.camera;
    if (ext !== this.shadowExt) {
      this.shadowExt = ext;
      sc.left = sc.bottom = -ext;
      sc.right = sc.top = ext;
      sc.updateProjectionMatrix();
    }
    const texel = (2 * ext) / this.sun.shadow.mapSize.x;
    const t = this.tmp.set(c.x, 0, c.z);
    const a = t.dot(this.lightR);
    const b = t.dot(this.lightU);
    t.addScaledVector(this.lightR, Math.round(a / texel) * texel - a).addScaledVector(this.lightU, Math.round(b / texel) * texel - b);
    this.sun.target.position.copy(t);
    this.sun.position.copy(t).addScaledVector(SUN, 120);
    this.sun.target.updateMatrixWorld();
  }

  /** world point to CSS pixels; returns false when behind the camera */
  project(p: Vector3, out: { x: number; y: number }): boolean {
    const v = this.tmp.copy(p).project(this.camera);
    out.x = (v.x * 0.5 + 0.5) * this.width;
    out.y = (-v.y * 0.5 + 0.5) * this.height;
    return v.z < 1;
  }

  render(t: number, focusY: number, blur: number) {
    const r = this.renderer;
    const u = this.post.uniforms;
    u.uFocus.value = focusY;
    u.uBlur.value = blur * this.pixelRatio;
    u.uTime.value = t;
    r.setRenderTarget(this.rt);
    r.render(this.scene, this.camera);
    r.setRenderTarget(null);
    r.render(this.postScene, this.postCam);
  }
}
