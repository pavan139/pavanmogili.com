/** A tiny typed event bus between the page shell (src/main.ts) and the tabletop (src/run). */
export interface BusEvents {
  /** the visitor pressed Start on the intro card */
  enter: undefined;
  /** the view switched between the tabletop and the classic page */
  view: { view: 'world' | 'classic' };
}

type Handler<T> = (payload: T) => void;

export class Bus {
  private handlers = new Map<keyof BusEvents, Set<Handler<never>>>();

  on<K extends keyof BusEvents>(event: K, fn: Handler<BusEvents[K]>): () => void {
    let set = this.handlers.get(event);
    if (!set) this.handlers.set(event, (set = new Set()));
    set.add(fn as Handler<never>);
    return () => set!.delete(fn as Handler<never>);
  }

  emit<K extends keyof BusEvents>(event: K, ...payload: BusEvents[K] extends undefined ? [] : [BusEvents[K]]): void {
    const set = this.handlers.get(event);
    if (!set) return;
    for (const fn of set) (fn as Handler<BusEvents[K] | undefined>)(payload[0]);
  }
}
