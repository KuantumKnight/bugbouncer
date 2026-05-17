// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useKillSwitch, usePhaseLockedRendering } from '../hooks';
import { PhysicsRegistry } from '../registry';

describe('Physics Hooks', () => {
  beforeEach(() => {
    PhysicsRegistry.get_instance().reset_all();
  });

  it('useKillSwitch should return correct killed state', () => {
    const { result } = renderHook(() => useKillSwitch('test-switch'));
    expect(result.current).toBe(false);

    act(() => {
      PhysicsRegistry.get_instance().trip_kill('test-switch');
    });

    // Re-render hook
    const { result: result2 } = renderHook(() => useKillSwitch('test-switch'));
    expect(result2.current).toBe(true);
  });

  it('usePhaseLockedRendering should return correct lock state based on ready flag', () => {
    const { result, rerender } = renderHook(({ is_ready }) => usePhaseLockedRendering('test-lock', is_ready), {
      initialProps: { is_ready: false }
    });

    expect(result.current).toBe(true);
    expect(PhysicsRegistry.get_instance().is_locked('test-lock')).toBe(true);

    rerender({ is_ready: true });
    expect(result.current).toBe(false);
    expect(PhysicsRegistry.get_instance().is_locked('test-lock')).toBe(false);
  });
});
