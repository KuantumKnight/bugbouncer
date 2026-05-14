/**
 * BugBouncer Causal Context
 *
 * Manages the current execution context (trace_id) across async boundaries.
 * In a more advanced version, this would use AsyncLocalStorage (Node)
 * or a similar browser-side polyfill. For now, it uses a global window-bound
 * state with a stack for nested contexts.
 */

export class CausalContext {
  private static instance: CausalContext;
  private context_stack: string[] = ["global-init"];

  private constructor() {}

  public static get_instance(): CausalContext {
    if (!CausalContext.instance) {
      CausalContext.instance = new CausalContext();
    }
    return CausalContext.instance;
  }

  /**
   * Returns the current active trace_id.
   */
  public get_trace_id(): string {
    return this.context_stack[this.context_stack.length - 1];
  }

  /**
   * Starts a new trace context (e.g., when a user clicks a button).
   */
  public push_context(trace_id: string): void {
    this.context_stack.push(trace_id);
    if (typeof window !== "undefined") {
      (window as any).__bugbouncer_trace_id = trace_id;
    }
  }

  /**
   * Ends the current context.
   */
  public pop_context(): void {
    if (this.context_stack.length > 1) {
      this.context_stack.pop();
      const current = this.get_trace_id();
      if (typeof window !== "undefined") {
        (window as any).__bugbouncer_trace_id = current;
      }
    }
  }

  /**
   * Utility to wrap an async function in a specific context.
   */
  public async run_in_context<T>(trace_id: string, fn: () => Promise<T>): Promise<T> {
    this.push_context(trace_id);
    try {
      return await fn();
    } finally {
      this.pop_context();
    }
  }
}

export const causal_context = CausalContext.get_instance();
