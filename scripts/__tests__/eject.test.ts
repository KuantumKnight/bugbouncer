import { describe, it, expect } from 'vitest';
import { eject_content } from '../eject-physics';

describe('Eject Physics Script', () => {
  it('should remove library imports cleanly', () => {
    const input = `import { useState } from 'react';\nimport { KillSwitch, useKillSwitch } from '@bugbouncer/physics';\nconst x = 1;`;
    const expected = `import { useState } from 'react';\nconst x = 1;`;
    expect(eject_content(input).trim()).toBe(expected.trim());
  });

  it('should unwrap KillSwitch and PhaseLockedRendering JSX tags recursively', () => {
    const input = `
      <KillSwitch name="test" fallback={<Fallback />}>
        <div className="active">
          <PhaseLockedRendering lock_key="lock" is_ready={ready} fallback={<Spinner />}>
            <span>All System Stable</span>
          </PhaseLockedRendering>
        </div>
      </KillSwitch>
    `;
    const expected = `
      <div className="active">
        <span>All System Stable</span>
      </div>
    `;
    expect(eject_content(input).replace(/\s+/g, '')).toBe(expected.replace(/\s+/g, ''));
  });

  it('should replace hook calls with static false literal values', () => {
    const input = `
      const is_killed = useKillSwitch('billing-gate');
      const is_locked = usePhaseLockedRendering('auth-lock', ready);
      if (is_killed || is_locked) return null;
    `;
    const expected = `
      const is_killed = false;
      const is_locked = false;
      if (is_killed || is_locked) return null;
    `;
    expect(eject_content(input).trim().replace(/\s+/g, ' ')).toBe(expected.trim().replace(/\s+/g, ' '));
  });
});
