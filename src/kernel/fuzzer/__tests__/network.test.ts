import { describe, it, expect, beforeEach } from 'vitest';
import { fuzzer_engine } from '../index';

describe('Network Fuzzer Suite', () => {
  beforeEach(() => {
    fuzzer_engine.configure({
      seed: 'network-seed-456',
      enabled: true
    });
  });

  describe('Network Simulator (Orphaned Actions)', () => {
    it('should be deterministic based on seed', () => {
      let anomalies = 0;
      for (let i = 0; i < 1000; i++) {
        const anomaly = fuzzer_engine.network.simulate_orphaned_action('/api/submit', { data: 1 });
        if (anomaly) anomalies++;
      }
      
      const first_run_anomalies = anomalies;
      
      // Reset seed
      fuzzer_engine.configure({ seed: 'network-seed-456' });
      let anomalies_second_run = 0;
      for (let i = 0; i < 1000; i++) {
        const anomaly = fuzzer_engine.network.simulate_orphaned_action('/api/submit', { data: 1 });
        if (anomaly) anomalies_second_run++;
      }
      
      expect(first_run_anomalies).toBe(anomalies_second_run);
      expect(first_run_anomalies).toBeGreaterThan(0);
    });

    it('should format anomaly correctly', () => {
      let anomaly = null;
      for (let i = 0; i < 1000; i++) {
        anomaly = fuzzer_engine.network.simulate_orphaned_action('/api/submit', { data: 1 });
        if (anomaly) break;
      }
      expect(anomaly).not.toBeNull();
      expect(anomaly?.anomaly_type).toBe('orphaned_action');
      expect(anomaly?.request_url).toBe('/api/submit');
      expect(['client_disconnect', 'timeout']).toContain(anomaly?.simulated_failure);
    });
  });

  describe('Shadow Data Simulator (Void Payloads)', () => {
    it('should be deterministic based on seed', () => {
      let anomalies = 0;
      for (let i = 0; i < 1000; i++) {
        const anomaly = fuzzer_engine.shadow_data.simulate_void_payload('userProfile');
        if (anomaly) anomalies++;
      }
      
      const first_run_anomalies = anomalies;
      fuzzer_engine.configure({ seed: 'network-seed-456' });
      
      let anomalies_second_run = 0;
      for (let i = 0; i < 1000; i++) {
        const anomaly = fuzzer_engine.shadow_data.simulate_void_payload('userProfile');
        if (anomaly) anomalies_second_run++;
      }
      
      expect(first_run_anomalies).toBe(anomalies_second_run);
      expect(first_run_anomalies).toBeGreaterThan(0);
    });
  });

  describe('Url State Simulator (State Rot)', () => {
    it('should be deterministic based on seed', () => {
      const url = '/dashboard?tab=billing&page=2&sort=asc';
      let anomalies = 0;
      for (let i = 0; i < 1000; i++) {
        const anomaly = fuzzer_engine.url_state.simulate_url_rot(url);
        if (anomaly) anomalies++;
      }
      
      const first_run_anomalies = anomalies;
      fuzzer_engine.configure({ seed: 'network-seed-456' });
      
      let anomalies_second_run = 0;
      for (let i = 0; i < 1000; i++) {
        const anomaly = fuzzer_engine.url_state.simulate_url_rot(url);
        if (anomaly) anomalies_second_run++;
      }
      
      expect(first_run_anomalies).toBe(anomalies_second_run);
      expect(first_run_anomalies).toBeGreaterThan(0);
    });

    it('should correctly drop params from URL', () => {
      let anomaly = null;
      for (let i = 0; i < 1000; i++) {
        anomaly = fuzzer_engine.url_state.simulate_url_rot('/app?token=abc&user_id=123');
        if (anomaly) break;
      }
      expect(anomaly).not.toBeNull();
      expect(anomaly?.anomaly_type).toBe('url_state_rot');
      expect(anomaly?.dropped_params.length).toBeGreaterThan(0);
      
      // The mutated URL should not contain the dropped params
      const mutated = new URL(anomaly!.mutated_url, 'http://localhost');
      anomaly!.dropped_params.forEach(param => {
        expect(mutated.searchParams.has(param)).toBe(false);
      });
    });
  });
});
