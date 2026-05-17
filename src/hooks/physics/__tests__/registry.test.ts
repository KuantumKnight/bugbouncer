import { describe, it, expect, beforeEach } from 'vitest';
import { PhysicsRegistry } from '../registry';

describe('PhysicsRegistry', () => {
  let registry: PhysicsRegistry;

  beforeEach(() => {
    registry = PhysicsRegistry.get_instance();
    registry.reset_all();
  });

  it('should manage kill switch states', () => {
    expect(registry.is_killed('test-switch')).toBe(false);
    registry.trip_kill('test-switch');
    expect(registry.is_killed('test-switch')).toBe(true);
    registry.reset_kill('test-switch');
    expect(registry.is_killed('test-switch')).toBe(false);
  });

  it('should manage phase lock states', () => {
    expect(registry.is_locked('test-lock')).toBe(false);
    registry.set_lock('test-lock', true);
    expect(registry.is_locked('test-lock')).toBe(true);
    registry.set_lock('test-lock', false);
    expect(registry.is_locked('test-lock')).toBe(false);
  });
});
