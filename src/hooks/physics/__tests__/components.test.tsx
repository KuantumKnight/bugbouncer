// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { KillSwitch, PhaseLockedRendering } from '../components';
import { PhysicsRegistry } from '../registry';

describe('Physics Components', () => {
  beforeEach(() => {
    PhysicsRegistry.get_instance().reset_all();
  });

  it('KillSwitch renders children when active and fallback when killed', () => {
    const { rerender } = render(
      <KillSwitch name="test-switch" fallback={<div data-testid="fallback">Killed</div>}>
        <div data-testid="children">Running</div>
      </KillSwitch>
    );

    expect(screen.getByTestId('children')).toBeDefined();
    expect(screen.queryByTestId('fallback')).toBeNull();

    act(() => {
      PhysicsRegistry.get_instance().trip_kill('test-switch');
    });

    rerender(
      <KillSwitch name="test-switch" fallback={<div data-testid="fallback">Killed</div>}>
        <div data-testid="children">Running</div>
      </KillSwitch>
    );

    expect(screen.getByTestId('fallback')).toBeDefined();
    expect(screen.queryByTestId('children')).toBeNull();
  });

  it('PhaseLockedRendering renders children when ready and fallback when locked', () => {
    const { rerender } = render(
      <PhaseLockedRendering lock_key="test-lock" is_ready={false} fallback={<div data-testid="fallback">Locked</div>}>
        <div data-testid="children">Ready</div>
      </PhaseLockedRendering>
    );

    expect(screen.getByTestId('fallback')).toBeDefined();
    expect(screen.queryByTestId('children')).toBeNull();

    rerender(
      <PhaseLockedRendering lock_key="test-lock" is_ready={true} fallback={<div data-testid="fallback">Locked</div>}>
        <div data-testid="children">Ready</div>
      </PhaseLockedRendering>
    );

    expect(screen.getByTestId('children')).toBeDefined();
    expect(screen.queryByTestId('fallback')).toBeNull();
  });
});
