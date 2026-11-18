/**
 * Capability and device tier (PERF), decided in the entry chunk before anything 3D loads.
 *
 * The world needs WebGL 2, a hardware GPU and WebAssembly SIMD (Rapier's build). Software
 * GL (SwiftShader, WARP, llvmpipe) would render the world as a slideshow, so those visitors
 * get the classic view unless they ask for the tabletop explicitly (?view=world, which the
 * tests use under SwiftShader).
 */

export type Tier = 'low' | 'mid' | 'high';

export interface DeviceInfo {
  webgl2: boolean;
  renderer: string;
  software: boolean;
  /** the page's CSP lets WebAssembly compile (some embedding hosts do not) */
  coarse: boolean;
  dpr: number;
  cores: number;
  memory: number;
  screenPixels: number;
  saveData: boolean;
}

const SOFTWARE = /swiftshader|llvmpipe|softpipe|lavapipe|software|microsoft basic render|\bwarp\b/i;

export function probe(): DeviceInfo {
  let webgl2 = false;
  let renderer = '';
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2', { powerPreference: 'high-performance' });
    if (gl) {
      webgl2 = true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      renderer = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)) || '';
      // give the context back right away: browsers cap live contexts
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    }
  } catch {
    webgl2 = false;
  }
  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
  return {
    webgl2,
    renderer,
    software: SOFTWARE.test(renderer),
    coarse: matchMedia('(pointer: coarse)').matches,
    dpr: devicePixelRatio || 1,
    cores: nav.hardwareConcurrency || 4,
    memory: nav.deviceMemory ?? 4,
    screenPixels: screen.width * screen.height * (devicePixelRatio || 1) ** 2,
    saveData: nav.connection?.saveData === true,
  };
}

/** A starting tier from hints; the governor corrects it from measured frame times. */
export function tierFor(d: DeviceInfo): Tier {
  const apple = /apple/i.test(d.renderer);
  if (d.coarse) {
    // phones and tablets: Apple GPUs and big Android devices start mid, small ones low
    if (apple) return 'mid';
    return d.memory >= 6 && d.cores >= 8 ? 'mid' : 'low';
  }
  if (apple || /nvidia|geforce|rtx|radeon rx|arc\b/i.test(d.renderer)) return 'high';
  return d.cores >= 8 ? 'high' : 'mid';
}

export interface Budget {
  /** max drawing-buffer pixels */
  pixelBudget: number;
  /** MSAA samples for ART's scene target (fixed at boot) */
  msaa: number;
  /** post quality: 0 off, 1 low, 2 full */
  post: number;
  /** realtime shadow maps allowed (false only in the test budget) */
  shadows: boolean;
}

/**
 * The test budget (?quality=test, and automatically when software GL is forced with
 * ?view=world): a quarter megapixel, no MSAA, no post, no shadow maps. CI renders in
 * software on shared CPUs; this keeps the tabletop interactive there without changing what
 * the tests check (layout, input, physics, transports, fallbacks).
 */
export const TEST_BUDGET: Budget = { pixelBudget: 0.25e6, msaa: 0, post: 0, shadows: false };

export function budgetFor(tier: Tier, coarse: boolean): Budget {
  if (coarse) {
    if (tier === 'low') return { pixelBudget: 1.1e6, msaa: 2, post: 1, shadows: true };
    return { pixelBudget: 2.0e6, msaa: 4, post: 2, shadows: true };
  }
  if (tier === 'low') return { pixelBudget: 2.0e6, msaa: 2, post: 1, shadows: true };
  if (tier === 'mid') return { pixelBudget: 3.2e6, msaa: 4, post: 2, shadows: true };
  return { pixelBudget: 4.6e6, msaa: 4, post: 2, shadows: true };
}
