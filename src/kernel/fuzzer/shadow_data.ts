import { DeterministicPRNG } from './prng';
import { FuzzerConfig, VoidPayloadAnomaly } from './types';

export class ShadowDataSimulator {
  private prng: DeterministicPRNG;
  private config: FuzzerConfig;

  // Pre-defined void payloads corresponding to regex/fuzz patterns
  private void_patterns = [
    { pattern: 'deep_null', value: { nested: { deep: null } } },
    { pattern: 'prototype_pollution', value: { __proto__: { admin: true } } },
    { pattern: 'sql_injection_mock', value: "' OR 1=1 --" },
    { pattern: 'xss_mock', value: "<script>alert(1)</script>" },
    { pattern: 'emoji_overflow', value: "🚀".repeat(1000) }
  ];

  constructor(prng: DeterministicPRNG, config: FuzzerConfig) {
    this.prng = prng;
    this.config = config;
  }

  /**
   * Simulates the injection of malformed data payloads into specific fields.
   */
  public simulate_void_payload(target_field: string): VoidPayloadAnomaly | null {
    if (!this.config.enabled) return null;

    // 2% chance of void payload injection
    if (this.prng.chance(0.02)) {
      // Pick a random void pattern
      const index = this.prng.next_int(0, this.void_patterns.length);
      const selected = this.void_patterns[index];
      
      return {
        anomaly_type: 'void_payload',
        target_field,
        regex_pattern: selected.pattern,
        injected_value: selected.value,
        timestamp: Date.now()
      };
    }
    
    return null;
  }
}
