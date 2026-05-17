/**
 * BugBouncer Causal Context
 *
 * Manages the current execution context (trace_id) across async boundaries.
 * In a more advanced version, this would use AsyncLocalStorage (Node)
 * or a similar browser-side polyfill. For now, it uses a global window-bound
 * state with a stack for nested contexts.
 */

interface CausalContextStore {
  context_stack: string[];
  current_user_id: string | null;
}

interface AsyncLocalStorageLike {
  getStore(): unknown;
  run<R>(store: unknown, callback: () => R): R;
}

let storage: AsyncLocalStorageLike | null = null;

function get_storage(): AsyncLocalStorageLike | null {
  if (typeof window !== "undefined") {
    return null;
  }
  if (!storage) {
    try {
      // Use eval("require") to bypass webpack client-side bundling analysis of node:async_hooks
      const req = typeof require !== "undefined" ? require : eval("require");
      const { AsyncLocalStorage } = req("node:async_hooks");
      storage = new AsyncLocalStorage() as AsyncLocalStorageLike;
    } catch {
      // Fallback if not available
    }
  }
  return storage;
}

export class CausalContext {
  private static instance: CausalContext;
  
  // Client-side / Fallback state
  private context_stack: string[] = ["global-init"];
  private current_user_id: string | null = null;

  private constructor() {}

  public static get_instance(): CausalContext {
    if (!CausalContext.instance) {
      CausalContext.instance = new CausalContext();
    }
    return CausalContext.instance;
  }

  private get_store(): CausalContextStore | null {
    const s = get_storage();
    if (s) {
      const store = s.getStore() as CausalContextStore | undefined;
      return store || null;
    }
    return null;
  }

  public set_user_id(user_id: string | null): void {
    const store = this.get_store();
    if (store) {
      store.current_user_id = user_id;
    } else {
      this.current_user_id = user_id;
    }
  }

  public get_user_id(): string | null {
    const store = this.get_store();
    if (store) {
      return store.current_user_id;
    }
    return this.current_user_id;
  }

  /**
   * Returns the current active trace_id.
   */
  public get_trace_id(): string {
    const store = this.get_store();
    if (store) {
      return store.context_stack[store.context_stack.length - 1];
    }
    return this.context_stack[this.context_stack.length - 1];
  }

  /**
   * Starts a new trace context (e.g., when a user clicks a button).
   */
  public push_context(trace_id: string): void {
    const store = this.get_store();
    if (store) {
      store.context_stack.push(trace_id);
    } else {
      this.context_stack.push(trace_id);
    }
    if (typeof window !== "undefined") {
      (window as unknown as { __bugbouncer_trace_id: string }).__bugbouncer_trace_id = trace_id;
    }
  }

  /**
   * Ends the current context.
   */
  public pop_context(): void {
    const store = this.get_store();
    if (store) {
      if (store.context_stack.length > 1) {
        store.context_stack.pop();
      }
    } else {
      if (this.context_stack.length > 1) {
        this.context_stack.pop();
      }
    }
    const current = this.get_trace_id();
    if (typeof window !== "undefined") {
      (window as unknown as { __bugbouncer_trace_id: string }).__bugbouncer_trace_id = current;
    }
  }

  /**
   * Utility to wrap an async function in a specific context.
   */
  public async run_in_context<T>(trace_id: string, fn: () => Promise<T>): Promise<T> {
    const s = get_storage();
    if (s) {
      const parent_store = s.getStore() as CausalContextStore | undefined;
      const current_user_id = parent_store ? parent_store.current_user_id : this.current_user_id;
      const parent_stack = parent_store ? parent_store.context_stack : ["global-init"];
      
      const new_store: CausalContextStore = {
        context_stack: [...parent_stack, trace_id],
        current_user_id: current_user_id,
      };
      
      return s.run(new_store, fn);
    } else {
      this.push_context(trace_id);
      try {
        return await fn();
      } finally {
        this.pop_context();
      }
    }
  }
}

export const causal_context = CausalContext.get_instance();
