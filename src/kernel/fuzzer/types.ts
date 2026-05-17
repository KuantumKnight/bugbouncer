export interface FuzzerConfig {
  seed: string;
  hydration_delay_ms: number;
  coherence_interval_ms: number;
  max_iterations: number;
  enabled: boolean;
}

export interface HydrationAnomaly {
  anomaly_type: 'hydration_mismatch';
  fiber_id: string;
  expected_state: string;
  actual_state: string;
  component_name: string;
  schema_hash: string;
  timestamp: number;
}

export interface CoherenceAnomaly {
  anomaly_type: 'coherence_failure';
  dependency_id: string;
  affected_fibers: string[];
  divergence_delta_ms: number;
  timestamp: number;
}

export interface OrphanedActionAnomaly {
  anomaly_type: 'orphaned_action';
  request_url: string;
  payload: unknown;
  simulated_failure: 'client_disconnect' | 'timeout';
  timestamp: number;
}

export interface VoidPayloadAnomaly {
  anomaly_type: 'void_payload';
  target_field: string;
  regex_pattern: string;
  injected_value: unknown;
  timestamp: number;
}

export interface UrlStateRotAnomaly {
  anomaly_type: 'url_state_rot';
  original_url: string;
  mutated_url: string;
  dropped_params: string[];
  timestamp: number;
}

export type FuzzerAnomaly = HydrationAnomaly | CoherenceAnomaly | OrphanedActionAnomaly | VoidPayloadAnomaly | UrlStateRotAnomaly;
