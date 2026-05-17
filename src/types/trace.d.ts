/**
 * BugBouncer Trace Metadata Types
 * 
 * MANDATORY CONVENTION: All keys MUST be in snake_case.
 * This is optimized for zero-copy performance via SharedArrayBuffer 
 * and direct alignment with SQLite Ledger keys.
 */

import { FuzzerAnomaly } from "@/kernel/fuzzer/types";

export interface TraceMetadata {
  trace_id: string;
  span_id: string;
  parent_span_id?: string;
  timestamp_nanos: number;
  event_type: "dom_mutation" | "network_request" | "fiber_update" | "error" | "fuzzer_anomaly";
  user_id?: string;
  
  // High-performance context payload
  payload: {
    // Network Metadata
    request_url?: string;
    response_status?: number;
    latency_ms?: number;
    request_method?: string;
    request_type?: string;

    // Fiber Metadata
    component_name?: string;
    props?: Record<string, unknown>;
    duration_ms?: number;
    fiber_tag?: number;

    // DOM / Error Metadata
    target_node_id?: string;
    error_stack?: string;
    error_message?: string;

    // Structural Hashing (FR24 — Schema Drift Detection)
    schema_hash?: string;

    // Fuzzer Context
    anomaly_data?: FuzzerAnomaly;
  };

  // Stability markers
  stability_score: number; // 0.0 to 1.0
  is_panic_event: boolean;
}

export interface LedgerEntry {
  id: number;
  trace_data: TraceMetadata;
  created_at: string;
}
