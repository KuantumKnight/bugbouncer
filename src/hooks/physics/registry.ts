export class PhysicsRegistry {
  private static instance: PhysicsRegistry;
  private switches = new Map<string, boolean>();
  private locks = new Map<string, boolean>();
  private listeners = new Set<() => void>();

  private constructor() {}

  static get_instance(): PhysicsRegistry {
    if (!PhysicsRegistry.instance) {
      PhysicsRegistry.instance = new PhysicsRegistry();
    }
    return PhysicsRegistry.instance;
  }

  is_killed(name: string): boolean {
    return this.switches.get(name) || false;
  }

  trip_kill(name: string): void {
    this.switches.set(name, true);
    this.notify();
  }

  reset_kill(name: string): void {
    this.switches.set(name, false);
    this.notify();
  }

  is_locked(name: string): boolean {
    return this.locks.get(name) || false;
  }

  set_lock(name: string, locked: boolean): void {
    this.locks.set(name, locked);
    this.notify();
  }

  reset_all(): void {
    this.switches.clear();
    this.locks.clear();
    this.notify();
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    this.listeners.forEach((listener) => {
      try {
        listener();
      } catch (e) {
        console.error("[physics-registry] Error in listener:", e);
      }
    });
  }
}
