/**
 * BugBouncer DAG Mapper
 *
 * The DagMapper is responsible for establishing causal links between
 * disparate events (e.g., a fetch request causing a component re-render).
 * It maintains a sliding window of recent span IDs to find parents
 * for orphaned events.
 */

import { config_engine } from "@/kernel/config/engine";
import { DependencyInfo } from "@/kernel/ast/types";

export class DagMapper {
  private span_history: Map<string, string> = new Map(); // span_id -> trace_id
  private last_active_span_id: string | null = null;
  private dependency_graph: Map<string, DependencyInfo> = new Map(); // component_path -> info

  /**
   * Registers a span and its trace context.
   */
  public register_span(span_id: string, trace_id: string): void {
    this.span_history.set(span_id, trace_id);
    this.last_active_span_id = span_id;

    // TODO: Implement TTL / cleanup for span_history to prevent memory leaks
  }

  /**
   * Registers component dependency information.
   * This is used to build a static dependency graph that enriches
   * the runtime causal tracing.
   */
  public register_dependencies(info: DependencyInfo): void {
    this.dependency_graph.set(info.source_file, info);
  }

  /**
   * Injects a fuzzer anomaly into the trace context.
   */
  public inject_anomaly(anomaly: import("@/kernel/fuzzer/types").FuzzerAnomaly): void {
    // This provides a hook for the ledger to pick up fuzzer anomalies
    // and correctly normalize them to snake_case.
    const anomaly_payload = {
      event_type: "fuzzer_anomaly",
      payload: {
        anomaly_data: anomaly
      },
      stability_score: 0.0,
      is_panic_event: false
    };
    this.normalize_payload(anomaly_payload);
    // TODO: Forward to Ledger
  }

  /**
   * Attempts to find the most likely parent for an event if one isn't provided.
   * This uses "temporal proximity" and the current execution context.
   */
  public resolve_parent(): string | undefined {
    // For now, simple link to last active span.
    // In the future, this will use a more sophisticated stack-based approach
    // or Zone.js-like context tracking.
    return this.last_active_span_id || undefined;
  }

  /**
   * Enforces snake_case on all payload keys before they reach the ledger.
   */
  public normalize_payload<T>(payload: T): T {
    if (!payload || typeof payload !== "object") return {} as unknown as T;
    
    // 1. Mask sensitive data
    const masked_payload = config_engine.mask_payload(payload);
    
    // 2. Normalize keys to snake_case deeply
    return this.deep_snake_case(masked_payload) as unknown as T;
  }

  private deep_snake_case(obj: unknown): unknown {
    if (obj === null || typeof obj !== "object") return obj;
    if (Array.isArray(obj)) return obj.map(item => this.deep_snake_case(item));

    const normalized: Record<string, unknown> = {};
    const record = obj as Record<string, unknown>;
    for (const key in record) {
      const snake_key = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
      normalized[snake_key] = this.deep_snake_case(record[key]);
    }
    return normalized;
  }
}
