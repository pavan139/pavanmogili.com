/**
 * Boots the tabletop: the request run (src/run). Loaded only when the tabletop view is
 * chosen, so the classic page never pays for three.js.
 */
import type { Bus } from './lib/bus';
import type { Perf } from './perf';
import { bootRun, type RunHandle } from './run';

export type WorldHandle = RunHandle;

export function bootWorld(opts: { perf: Perf; bus: Bus; root: HTMLElement; onProgress(p: number, label: string): void }): Promise<WorldHandle> {
  return bootRun(opts);
}
