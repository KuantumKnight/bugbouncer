import { DeterministicPRNG } from './prng';
import { FuzzerConfig, OrphanedActionAnomaly } from './types';

export class NetworkSimulator {
  private prng: DeterministicPRNG;
  private config: FuzzerConfig;

  constructor(prng: DeterministicPRNG, config: FuzzerConfig) {
    this.prng = prng;
    this.config = config;
  }

  /**
   * Simulates a sudden client disconnect or timeout after a server action starts.
   */
  public simulate_orphaned_action(request_url: string, payload: unknown): OrphanedActionAnomaly | null {
    if (!this.config.enabled) return null;

    // 3% chance of orphaned action
    if (this.prng.chance(0.03)) {
      const failure_type = this.prng.chance(0.5) ? 'client_disconnect' : 'timeout';
      
      return {
        anomaly_type: 'orphaned_action',
        request_url,
        payload,
        simulated_failure: failure_type,
        timestamp: Date.now()
      };
    }
    
    return null;
  }
}
