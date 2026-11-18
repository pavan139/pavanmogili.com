import type { Group, SphereGeometry, Vector3 } from 'three';
import type { Batch, Mats } from './kit';

export interface Tag {
  set(text: string): void;
}

/** What a station gets to build with. */
export interface Ctx {
  batch: Batch;
  mats: Mats;
  /** moving parts and printed text go here */
  dyn: Group;
  /** shared geometry for the grey marbles (other requests) */
  sphere: SphereGeometry;
  /** a short label pinned to a point in the model, shown at one stop */
  tag(beat: string, text: string, pos: Vector3, place?: 'up' | 'down'): Tag;
}

export interface Station {
  /** the stretch of the path where this station is animated */
  s0: number;
  s1: number;
  /** s: the marble's distance along the path; t: seconds; m: the marble's position */
  update(s: number, t: number, m: Vector3): void;
}
