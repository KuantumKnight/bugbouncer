import { describe, it, expect, beforeEach } from 'vitest';
import { fuzzer_engine } from '../index';

describe('Fuzzer Engine', () => {
  beforeEach(() => {
    // Reset to a known seed and enabled state
    fuzzer_engine.configure({
      seed: 'test-seed-123',
      enabled: true
    });
  });

  describe('Hydration Simulator', () => {
    it('should be deterministic based on seed', () => {
      let anomalies = 0;
      for (let i = 0; i < 1000; i++) {
        const anomaly = fuzzer_engine.hydration.simulate_mismatch('fiber-1', 'TestComp', 'hash-123');
        if (anomaly) anomalies++;
      }
      
      const first_run_anomalies = anomalies;
      
      // Reset seed
      fuzzer_engine.configure({ seed: 'test-seed-123' });
      let anomalies_second_run = 0;
      for (let i = 0; i < 1000; i++) {
        const anomaly = fuzzer_engine.hydration.simulate_mismatch('fiber-1', 'TestComp', 'hash-123');
        if (anomaly) anomalies_second_run++;
      }
      
      expect(first_run_anomalies).toBe(anomalies_second_run);
      expect(first_run_anomalies).toBeGreaterThan(0); // Given 5% chance, 1000 runs should hit it
    });

    it('should return null if disabled', () => {
      fuzzer_engine.configure({ enabled: false });
      const anomaly = fuzzer_engine.hydration.simulate_mismatch('fiber-1', 'TestComp', 'hash-123');
      expect(anomaly).toBeNull();
    });
    
    it('should output expected snake_case anomaly shape', () => {
      // Force an anomaly by iterating until we hit one
      let anomaly = null;
      for (let i = 0; i < 1000; i++) {
        anomaly = fuzzer_engine.hydration.simulate_mismatch('fiber-1', 'TestComp', 'hash-123');
        if (anomaly) break;
      }
      
      expect(anomaly).not.toBeNull();
      expect(anomaly?.anomaly_type).toBe('hydration_mismatch');
      expect(anomaly?.fiber_id).toBe('fiber-1');
      expect(anomaly?.component_name).toBe('TestComp');
      expect(anomaly?.schema_hash).toBe('hash-123');
      expect(anomaly?.timestamp).toBeTypeOf('number');
      expect(anomaly?.expected_state).toBeTypeOf('string');
      expect(anomaly?.actual_state).toBeTypeOf('string');
    });
  });

  describe('Coherence Simulator', () => {
    it('should be deterministic based on seed', () => {
      const active_fibers = ['fiber-1', 'fiber-2', 'fiber-3', 'fiber-4'];
      let anomalies = 0;
      
      for (let i = 0; i < 1000; i++) {
        const anomaly = fuzzer_engine.coherence.simulate_divergence('dep-1', active_fibers);
        if (anomaly) anomalies++;
      }
      
      const first_run_anomalies = anomalies;
      
      // Reset seed
      fuzzer_engine.configure({ seed: 'test-seed-123' });
      let anomalies_second_run = 0;
      for (let i = 0; i < 1000; i++) {
        const anomaly = fuzzer_engine.coherence.simulate_divergence('dep-1', active_fibers);
        if (anomaly) anomalies_second_run++;
      }
      
      expect(first_run_anomalies).toBe(anomalies_second_run);
      expect(first_run_anomalies).toBeGreaterThan(0); // Given 2% chance, 1000 runs should hit it
    });

    it('should return null if disabled', () => {
      fuzzer_engine.configure({ enabled: false });
      const active_fibers = ['fiber-1', 'fiber-2', 'fiber-3', 'fiber-4'];
      const anomaly = fuzzer_engine.coherence.simulate_divergence('dep-1', active_fibers);
      expect(anomaly).toBeNull();
    });
    
    it('should output expected snake_case anomaly shape', () => {
      const active_fibers = ['fiber-1', 'fiber-2', 'fiber-3', 'fiber-4'];
      let anomaly = null;
      for (let i = 0; i < 1000; i++) {
        anomaly = fuzzer_engine.coherence.simulate_divergence('dep-1', active_fibers);
        if (anomaly) break;
      }
      
      expect(anomaly).not.toBeNull();
      expect(anomaly?.anomaly_type).toBe('coherence_failure');
      expect(anomaly?.dependency_id).toBe('dep-1');
      expect(Array.isArray(anomaly?.affected_fibers)).toBe(true);
      expect(anomaly?.divergence_delta_ms).toBeTypeOf('number');
      expect(anomaly?.timestamp).toBeTypeOf('number');
    });
  });
});
