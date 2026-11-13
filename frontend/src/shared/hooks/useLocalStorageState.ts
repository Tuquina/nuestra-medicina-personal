import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';

/**
 * React state mirrored to `localStorage` under `key`.
 *
 * Reads once on mount and writes on every change. If storage is
 * unavailable (private browsing, blocked site data, full quota) or holds
 * something that doesn't pass `isValid` (an older shape, manual edits),
 * it falls back to `initial` and keeps working in memory, so the UI never
 * breaks because of storage.
 */
export function useLocalStorageState<T>(
  key: string,
  initial: T,
  isValid: (value: unknown) => value is T,
): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => readStoredValue(key, initial, isValid));

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Storage unavailable: the value still lives in memory for this visit.
    }
  }, [key, value]);

  return [value, setValue];
}

function readStoredValue<T>(key: string, initial: T, isValid: (value: unknown) => value is T): T {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return initial;
    const parsed: unknown = JSON.parse(raw);
    return isValid(parsed) ? parsed : initial;
  } catch {
    return initial;
  }
}
