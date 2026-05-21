
//i have no idea wtf is this

import { DeterministicPRNG } from './prng';
import { FuzzerConfig, HydrationAnomaly } from './types';

export class HydrationSimulator {
  private prng: DeterministicPRNG;
  private config: FuzzerConfig;

  constructor(prng: DeterministicPRNG, config: FuzzerConfig) {
    this.prng = prng;
    this.config = config;
  }

  /**
   * Simulates a hydration mismatch for a given component fiber.
   * Uses the PRNG to ensure reproducibility of anomalies.
   */
  public simulate_mismatch(fiber_id: string, component_name: string, schema_hash: string): HydrationAnomaly | null {
    if (!this.config.enabled) return null;

    // 5% chance of hydration anomaly
    if (this.prng.chance(0.05)) {
      const is_client_faster = this.prng.chance(0.5);
      
      const expected_state = `Server Rendered: ${this.prng.next_int(100, 999)}`;
      const actual_state = is_client_faster ? `Client Rendered: ${this.prng.next_int(100, 999)}` : expected_state;

      if (expected_state !== actual_state) {
        return {
          anomaly_type: 'hydration_mismatch',
          fiber_id,
          expected_state,
          actual_state,
          component_name,
          schema_hash,
          timestamp: Date.now()
        };
      }
    }
    
    return null;
  }
}
