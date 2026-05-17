import { useState, useEffect } from 'react';
import { PhysicsRegistry } from './registry';

/**
 * Hook to retrieve the current killed status of a stability primitive.
 */
export function useKillSwitch(name: string): boolean {
  const registry = PhysicsRegistry.get_instance();
  const [is_killed, set_is_killed] = useState(registry.is_killed(name));

  useEffect(() => {
    // Set initial state in case it changed before subscription was active
    set_is_killed(registry.is_killed(name));

    const unsubscribe = registry.subscribe(() => {
      set_is_killed(registry.is_killed(name));
    });
    return unsubscribe;
  }, [name, registry]);

  return is_killed;
}

/**
 * Hook to manage rendering phase locking. Locks rendering until ready is true.
 */
export function usePhaseLockedRendering(key: string, is_ready: boolean): boolean {
  const registry = PhysicsRegistry.get_instance();
  const [is_locked, set_is_locked] = useState(!is_ready);

  useEffect(() => {
    registry.set_lock(key, !is_ready);
    set_is_locked(!is_ready);
  }, [key, is_ready, registry]);

  useEffect(() => {
    const unsubscribe = registry.subscribe(() => {
      set_is_locked(registry.is_locked(key));
    });
    return unsubscribe;
  }, [key, registry]);

  return is_locked;
}
