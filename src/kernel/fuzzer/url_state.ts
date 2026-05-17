import { DeterministicPRNG } from './prng';
import { FuzzerConfig, UrlStateRotAnomaly } from './types';

export class UrlStateSimulator {
  private prng: DeterministicPRNG;
  private config: FuzzerConfig;

  constructor(prng: DeterministicPRNG, config: FuzzerConfig) {
    this.prng = prng;
    this.config = config;
  }

  /**
   * Simulates browser history navigation or OAuth bounces by artificially 
   * mutating or dropping URL search parameters.
   */
  public simulate_url_rot(original_url: string): UrlStateRotAnomaly | null {
    if (!this.config.enabled) return null;

    // 4% chance of URL state rot
    if (this.prng.chance(0.04)) {
      try {
        const url_obj = new URL(original_url, 'http://localhost');
        const params = Array.from(url_obj.searchParams.keys());
        
        if (params.length === 0) return null;

        const drop_count = this.prng.next_int(1, params.length + 1);
        const shuffled = this.prng.shuffle([...params]);
        const dropped_params = shuffled.slice(0, drop_count);
        
        dropped_params.forEach(p => url_obj.searchParams.delete(p));
        
        // Keep relative path if original was relative
        let mutated_url = url_obj.toString();
        if (!original_url.startsWith('http://') && !original_url.startsWith('https://')) {
          mutated_url = mutated_url.replace('http://localhost', '');
        }
        
        return {
          anomaly_type: 'url_state_rot',
          original_url,
          mutated_url,
          dropped_params,
          timestamp: Date.now()
        };
      } catch {
        // Fallback for completely invalid URLs
        return null;
      }
    }
    
    return null;
  }
}
