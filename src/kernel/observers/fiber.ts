/**
 * BugBouncer Fiber Observer — React DevTools Hook Integration
 *
 * This module hooks into the React DevTools global hook to intercept
 * component commits and state updates. It operates in a non-blocking
 * manner by offloading tree traversal to an idle callback.
 */

import { TraceMetadata } from "@/types/trace";
import { LedgerClient } from "@/kernel/bridge/ledger-client";
import { DagMapper } from "@/kernel/mapper/dag";
import { causal_context } from "@/kernel/context";
import { config_engine } from "@/kernel/config/engine";

// ──────────────────────────────────────────────
// React Fiber Types (Internal)
// ──────────────────────────────────────────────

interface FiberNode {
  type: any;
  key: string | null;
  stateNode: any;
  child: FiberNode | null;
  sibling: FiberNode | null;
  return: FiberNode | null;
  memoizedProps: any;
  memoizedState: any;
  actualDuration?: number;
  actualStartTime?: number;
  alternate: FiberNode | null;
  tag: number;
}

interface ReactDevToolsHook {
  onCommitFiberRoot: (rendererID: number, root: any, priorityLevel: number) => void;
  getFiberRoots: (rendererID: number) => Set<any>;
  inject: (renderer: any) => number;
}

declare global {
  interface Window {
    __REACT_DEVTOOLS_GLOBAL_HOOK__?: ReactDevToolsHook;
  }
}

// ──────────────────────────────────────────────
// Fiber Observer Implementation
// ──────────────────────────────────────────────

export class FiberObserver {
  private ledger_client: LedgerClient;
  private dag_mapper: DagMapper;
  private renderer_id: number | null = null;
  private is_active = false;

  constructor(ledger_client: LedgerClient) {
    this.ledger_client = ledger_client;
    this.dag_mapper = new DagMapper();
  }

  /**
   * Initializes the observer by hooking into React DevTools.
   * MUST be called on the client-side.
   */
  public activate(): void {
    if (typeof window === "undefined" || this.is_active) return;

    const hook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__;
    if (!hook) {
      console.warn("[fiber-observer] React DevTools hook not found. Ensure BugBouncer runs in a dev environment or has hook injection enabled.");
      return;
    }

    // Intercept commits
    const original_on_commit = hook.onCommitFiberRoot;
    hook.onCommitFiberRoot = (rendererID, root, priorityLevel) => {
      if (original_on_commit) original_on_commit(rendererID, root, priorityLevel);
      this.handle_commit(root);
    };

    this.is_active = true;
    console.log("[fiber-observer] Activated and listening for commits.");
  }

  /**
   * Handles a React commit by queueing an asynchronous tree traversal.
   */
  private handle_commit(root: any): void {
    // We use requestIdleCallback to keep the commit phase fast (< 1ms overhead)
    const scheduler = (window as any).requestIdleCallback || ((cb: any) => setTimeout(cb, 1));
    
    scheduler(() => {
      this.traverse_root(root.current);
    });
  }

  /**
   * Traverses the Fiber tree and generates traces for updated components.
   */
  private traverse_root(current_fiber: FiberNode): void {
    const traces: TraceMetadata[] = [];
    const timestamp = performance.now() * 1_000_000; // Nanos approx

    const walk = (node: FiberNode | null, parent_span_id?: string) => {
      if (!node) return;

      const span_id = this.generate_span_id(node);
      const component_name = this.get_component_name(node);

      // Check if we should observe this component
      if (!config_engine.should_observe_component(component_name)) {
        walk(node.child, parent_span_id);
        walk(node.sibling, parent_span_id);
        return;
      }
      
      // Determine if this node updated
      const has_updated = node.alternate === null || node.alternate.memoizedProps !== node.memoizedProps || node.alternate.memoizedState !== node.memoizedState;

      if (has_updated) {
        const raw_payload = {
          component_name: this.get_component_name(node),
          props: this.sanitize_props(node.memoizedProps),
          duration_ms: node.actualDuration || 0,
          fiber_tag: node.tag
        };

        const trace_id = causal_context.get_trace_id();
        const trace: TraceMetadata = {
          trace_id,
          span_id,
          parent_span_id,
          timestamp_nanos: Math.floor(timestamp),
          event_type: "fiber_update",
          payload: this.dag_mapper.normalize_payload(raw_payload) as any,
          stability_score: 1.0,
          is_panic_event: false
        };

        traces.push(trace);
        this.dag_mapper.register_span(span_id, trace_id);
      }

      // Recurse
      walk(node.child, span_id);
      walk(node.sibling, parent_span_id);
    };

    walk(current_fiber);

    // Batch send to ledger
    traces.forEach(t => this.ledger_client.insert_trace(t));
  }

  private generate_span_id(node: FiberNode): string {
    // Stable identity for a fiber node across commits where possible
    // In production React, this is harder, but we'll use a combination of type and key
    return `fiber-${this.get_component_name(node)}-${node.key || "no-key"}`;
  }

  private get_component_name(node: FiberNode): string {
    if (typeof node.type === "string") return node.type;
    if (typeof node.type === "function") return node.type.displayName || node.type.name || "Anonymous";
    if (node.type && node.type.render) return node.type.render.name || "ForwardRef";
    return "UnknownComponent";
  }

  private sanitize_props(props: any): Record<string, any> {
    if (!props) return {};
    const result: Record<string, any> = {};
    // Only capture shallow primitives to avoid massive payloads
    for (const key in props) {
      if (typeof props[key] !== "object" && typeof props[key] !== "function") {
        result[key] = props[key];
      }
    }
    return result;
  }


}
