import { DeterministicPRNG } from './prng';
import { FuzzerConfig, CoherenceAnomaly } from './types';

export class CoherenceSimulator {
  private prng: DeterministicPRNG;
  private config: FuzzerConfig;

  constructor(prng: DeterministicPRNG, config: FuzzerConfig) {
    this.prng = prng;
    this.config = config;
  }

  /**
   * Simulates aggregate coherence divergence for shared state dependencies.
   */
  public simulate_divergence(dependency_id: string, active_fibers: string[]): CoherenceAnomaly | null {
    if (!this.config.enabled) return null;

    // 2% chance of coherence anomaly
    if (this.prng.chance(0.02) && active_fibers.length > 0) {
      const affected_count = this.prng.next_int(1, active_fibers.length + 1);
      const shuffled_fibers = this.prng.shuffle([...active_fibers]);
      const affected_fibers = shuffled_fibers.slice(0, affected_count);

      return {
        anomaly_type: 'coherence_failure',
        dependency_id,
        affected_fibers,
        divergence_delta_ms: this.prng.next_int(10, 500),
        timestamp: Date.now()
      };
    }
    
    return null;
  }
}
