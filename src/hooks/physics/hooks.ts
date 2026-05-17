import { useEffect, useSyncExternalStore } from 'react';
import { PhysicsRegistry } from './registry';

/**
 * Hook to retrieve the current killed status of a stability primitive.
 */
export function useKillSwitch(name: string): boolean {
  const registry = PhysicsRegistry.get_instance();
  return useSyncExternalStore(
    (callback) => registry.subscribe(callback),
    () => registry.is_killed(name),
    () => false // server fallback
  );
}

/**
 * Hook to manage rendering phase locking. Locks rendering until ready is true.
 */
export function usePhaseLockedRendering(key: string, is_ready: boolean): boolean {
  const registry = PhysicsRegistry.get_instance();

  useEffect(() => {
    registry.set_lock(key, !is_ready);
  }, [key, is_ready, registry]);

  return useSyncExternalStore(
    (callback) => registry.subscribe(callback),
    () => registry.is_locked(key),
    () => !is_ready // server fallback
  );
}
