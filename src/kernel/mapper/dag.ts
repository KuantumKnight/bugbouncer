/**
 * BugBouncer DAG Mapper
 *
 * The DagMapper is responsible for establishing causal links between
 * disparate events (e.g., a fetch request causing a component re-render).
 * It maintains a sliding window of recent span IDs to find parents
 * for orphaned events.
 */

import { TraceMetadata } from "@/types/trace";
import { config_engine } from "@/kernel/config/engine";

export class DagMapper {
  private span_history: Map<string, string> = new Map(); // span_id -> trace_id
  private last_active_span_id: string | null = null;

  /**
   * Registers a span and its trace context.
   */
  public register_span(span_id: string, trace_id: string): void {
    this.span_history.set(span_id, trace_id);
    this.last_active_span_id = span_id;

    // TODO: Implement TTL / cleanup for span_history to prevent memory leaks
  }

  /**
   * Attempts to find the most likely parent for an event if one isn't provided.
   * This uses "temporal proximity" and the current execution context.
   */
  public resolve_parent(event_type: TraceMetadata["event_type"]): string | undefined {
    // For now, simple link to last active span.
    // In the future, this will use a more sophisticated stack-based approach
    // or Zone.js-like context tracking.
    return this.last_active_span_id || undefined;
  }

  /**
   * Enforces snake_case on all payload keys before they reach the ledger.
   */
  public normalize_payload(payload: any): Record<string, any> {
    if (!payload || typeof payload !== "object") return {};
    
    // 1. Mask sensitive data
    const masked_payload = config_engine.mask_payload(payload);
    
    // 2. Normalize keys to snake_case deeply
    return this.deep_snake_case(masked_payload);
  }

  private deep_snake_case(obj: any): any {
    if (obj === null || typeof obj !== "object") return obj;
    if (Array.isArray(obj)) return obj.map(item => this.deep_snake_case(item));

    const normalized: Record<string, any> = {};
    for (const key in obj) {
      const snake_key = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
      normalized[snake_key] = this.deep_snake_case(obj[key]);
    }
    return normalized;
  }
}
