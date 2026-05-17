export const get_hydration_template = (component_name: string) => `
import { useState, useEffect } from 'react';

// Hydration guard for component: ${component_name}
export function useHydrationSafe() {
  const [is_mounted, set_is_mounted] = useState(false);
  useEffect(() => {
    set_is_mounted(true);
  }, []);
  return is_mounted;
}
`.trim();

export const get_orphaned_action_template = () => `
export function useSafeAction<TArgs extends any[], TResult>(
  action: (...args: TArgs) => Promise<TResult>,
  timeout_ms: number = 8000
) {
  return async (...args: TArgs): Promise<TResult> => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout_ms);
    try {
      const result = await Promise.race([
        action(...args),
        new Promise<never>((_, reject) => {
          controller.signal.addEventListener('abort', () => reject(new Error('Action timed out')));
        })
      ]);
      return result;
    } finally {
      clearTimeout(id);
    }
  };
}
`.trim();

export const get_coherence_template = () => `
import { useRef, useCallback } from 'react';

export function useCoherenceLock<T extends (...args: any[]) => any>(callback: T) {
  const is_locked = useRef(false);
  
  return useCallback(async (...args: Parameters<T>) => {
    if (is_locked.current) return;
    is_locked.current = true;
    try {
      await callback(...args);
    } finally {
      is_locked.current = false;
    }
  }, [callback]);
}
`.trim();

export const get_void_payload_template = (field: string) => `
export function usePayloadSanitizer<T>(payload: T): T {
  // Pure structural sanitizer for field: ${field}
  if (!payload || typeof payload !== 'object') return payload;
  
  const sanitized = { ...payload };
  if (sanitized && '${field}' in sanitized) {
    if (sanitized['${field}' as keyof T] === null || sanitized['${field}' as keyof T] === undefined) {
      // Provide safe fallback or filter
      delete sanitized['${field}' as keyof T];
    }
  }
  return sanitized;
}
`.trim();

export const get_url_state_template = () => `
import { useEffect, useState } from 'react';

export function useUrlStateRotSync(url: string) {
  const [is_synced, set_is_synced] = useState(true);
  useEffect(() => {
    // Detect missing mandatory search parameters
    const params = new URLSearchParams(window.location.search);
    if (!params.toString()) {
      set_is_synced(false);
    }
  }, [url]);
  return is_synced;
}
`.trim();
