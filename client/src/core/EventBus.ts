export type Handler = (payload: unknown) => void;

export class EventBus {
  private handlers: Map<string, Set<Handler>> = new Map();

  on(type: string, handler: Handler): () => void {
    let set = this.handlers.get(type);
    if (!set) {
      set = new Set();
      this.handlers.set(type, set);
    }
    set.add(handler);
    return () => this.off(type, handler);
  }

  off(type: string, handler: Handler): void {
    this.handlers.get(type)?.delete(handler);
  }

  emit(type: string, payload?: unknown): void {
    const set = this.handlers.get(type);
    if (!set) return;
    for (const handler of [...set]) handler(payload);
  }

  clear(): void {
    this.handlers.clear();
  }
}
