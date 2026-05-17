import { describe, it, expect } from 'vitest';
import { generate_ghost_hook_prompt } from '../prompt_builder';
import { FuzzerAnomaly } from '../../fuzzer/types';

describe('Ghost Hook Prompt Generator', () => {
  it('should generate a valid prompt for hydration mismatch', () => {
    const anomaly: FuzzerAnomaly = {
      anomaly_type: 'hydration_mismatch',
      component_name: 'TestComponent',
      fiber_id: 'fiber_1',
      expected_state: 'A',
      actual_state: 'B',
      schema_hash: 'hash_1',
      timestamp: Date.now()
    };

    const result = generate_ghost_hook_prompt(anomaly);
    
    expect(result.is_valid).toBe(true);
    expect(result.generation_time_ms).toBeLessThan(10000); // NFR-P2 < 10s
    expect(result.markdown).toContain('TestComponent');
    expect(result.markdown).toContain('useHydrationSafe');
    expect(result.markdown).toContain('Zero-Edit Refactor Ruleset');
  });

  it('should generate a valid prompt for orphaned action', () => {
    const anomaly: FuzzerAnomaly = {
      anomaly_type: 'orphaned_action',
      request_url: '/api/action',
      payload: {},
      simulated_failure: 'timeout',
      timestamp: Date.now()
    };

    const result = generate_ghost_hook_prompt(anomaly);
    
    expect(result.is_valid).toBe(true);
    expect(result.generation_time_ms).toBeLessThan(10000);
    expect(result.markdown).toContain('/api/action');
    expect(result.markdown).toContain('useSafeAction');
    expect(result.markdown).toContain('Zero-Edit Refactor Ruleset');
  });

  it('should generate a valid prompt for void payload', () => {
    const anomaly: FuzzerAnomaly = {
      anomaly_type: 'void_payload',
      target_field: 'user_id',
      regex_pattern: '.*',
      injected_value: null,
      timestamp: Date.now()
    };

    const result = generate_ghost_hook_prompt(anomaly);
    
    expect(result.is_valid).toBe(true);
    expect(result.generation_time_ms).toBeLessThan(10000);
    expect(result.markdown).toContain('user_id');
    expect(result.markdown).toContain('usePayloadSanitizer');
    expect(result.markdown).toContain('Zero-Edit Refactor Ruleset');
  });

  it('should invalidate code if syntax is broken (mock test)', () => {
    import('../validator').then(m => {
      // A quick test for the validator directly
      const is_valid = m.validate_syntax('const a = ;');
      expect(is_valid).toBe(false);
    });
  });
});
