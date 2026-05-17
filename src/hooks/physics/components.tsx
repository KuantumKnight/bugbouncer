import React, { ReactNode } from 'react';
import { useKillSwitch, usePhaseLockedRendering } from './hooks';

interface KillSwitchProps {
  name: string;
  fallback?: ReactNode;
  children: ReactNode;
}

export function KillSwitch({ name, fallback = null, children }: KillSwitchProps) {
  const is_killed = useKillSwitch(name);
  if (is_killed) {
    return <>{fallback}</>;
  }
  return <>{children}</>;
}

interface PhaseLockedProps {
  lock_key: string;
  is_ready: boolean;
  fallback?: ReactNode;
  children: ReactNode;
}

export function PhaseLockedRendering({ lock_key, is_ready, fallback = null, children }: PhaseLockedProps) {
  const is_locked = usePhaseLockedRendering(lock_key, is_ready);
  if (is_locked) {
    return <>{fallback}</>;
  }
  return <>{children}</>;
}
