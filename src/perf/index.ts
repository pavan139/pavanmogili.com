/**
 * Decides, before anything 3D loads, whether this device gets the tabletop and at what
 * quality. The tabletop needs WebGL 2 on a real GPU; everything else gets the classic page.
 */
import { TEST_BUDGET, budgetFor, probe, tierFor, type Budget, type DeviceInfo, type Tier } from './device';

export type PerfSettings = Budget;

export interface Perf {
  tier: Tier;
  settings: PerfSettings;
  /** false means: give the classic view (no WebGL 2, or a software renderer) */
  world: boolean;
  reason: string;
  device: DeviceInfo;
  /** the tier was pinned with ?quality= (resolution scaling off) */
  pinned: boolean;
  /** the test budget is in force (?quality=test, or software GL forced with ?view=world) */
  testBudget: boolean;
}

let perf: Perf | null = null;

export function boot(): Perf {
  if (perf) return perf;
  const q = new URLSearchParams(location.search);
  const device = probe();
  const pinnedTier = q.get('quality');
  // an explicit ?view=world accepts software GL (the tests run on SwiftShader)
  const forced = q.get('view') === 'world';
  const testBudget = pinnedTier === 'test' || (device.software && forced && !pinnedTier);
  const pinned = testBudget || pinnedTier === 'low' || pinnedTier === 'mid' || pinnedTier === 'high';
  const tier: Tier = testBudget ? 'low' : pinned ? (pinnedTier as Tier) : tierFor(device);
  let world = true;
  let reason = '';
  if (!device.webgl2) {
    world = false;
    reason = 'no-webgl2';
  } else if (device.software && !forced) {
    world = false;
    reason = 'software-gl';
  }
  const settings = testBudget ? { ...TEST_BUDGET } : budgetFor(tier, device.coarse);
  perf = { tier, settings, world, reason, device, pinned, testBudget };
  if (q.has('perf') || q.has('test')) (window as unknown as { __perf: Perf }).__perf = perf;
  return perf;
}
