import { FuzzerConfig } from './types';
import { DeterministicPRNG } from './prng';
import { HydrationSimulator } from './hydration';
import { CoherenceSimulator } from './coherence';
import { NetworkSimulator } from './network';
import { ShadowDataSimulator } from './shadow_data';
import { UrlStateSimulator } from './url_state';

class FuzzerEngine {
  private prng: DeterministicPRNG;
  private config: FuzzerConfig;
  
  public hydration: HydrationSimulator;
  public coherence: CoherenceSimulator;
  public network: NetworkSimulator;
  public shadow_data: ShadowDataSimulator;
  public url_state: UrlStateSimulator;

  constructor() {
    this.config = {
      seed: 'bugbouncer-default-seed',
      hydration_delay_ms: 100,
      coherence_interval_ms: 50,
      max_iterations: 1000,
      enabled: false
    };
    
    this.prng = new DeterministicPRNG(this.config.seed);
    this.hydration = new HydrationSimulator(this.prng, this.config);
    this.coherence = new CoherenceSimulator(this.prng, this.config);
    this.network = new NetworkSimulator(this.prng, this.config);
    this.shadow_data = new ShadowDataSimulator(this.prng, this.config);
    this.url_state = new UrlStateSimulator(this.prng, this.config);
  }

  public configure(config: Partial<FuzzerConfig>) {
    this.config = { ...this.config, ...config };
    
    // Re-initialize PRNG if seed changes
    if (config.seed !== undefined) {
      this.prng = new DeterministicPRNG(this.config.seed);
    }
    
    // Re-initialize simulators with updated config and PRNG
    this.hydration = new HydrationSimulator(this.prng, this.config);
    this.coherence = new CoherenceSimulator(this.prng, this.config);
    this.network = new NetworkSimulator(this.prng, this.config);
    this.shadow_data = new ShadowDataSimulator(this.prng, this.config);
    this.url_state = new UrlStateSimulator(this.prng, this.config);
  }

  public get_config(): FuzzerConfig {
    return this.config;
  }
}

export const fuzzer_engine = new FuzzerEngine();
