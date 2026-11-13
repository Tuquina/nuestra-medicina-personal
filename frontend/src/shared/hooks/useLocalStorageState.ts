import { useCallback, useEffect, useRef, useState, type SetStateAction } from 'react';

export interface LocalStorageStatus {
  /**
   * False when the browser refused to store the value (private browsing,
   * blocked site data, full quota). The state still works in memory, but
   * it will be lost when the page closes, so the UI must not claim it was
   * saved.
   */
  persisted: boolean;
}

/**
 * React state mirrored to `localStorage` under `key`.
 *
 * - Reads once on mount; a missing value, or one that doesn't pass
 *   `isValid` (an older shape, manual edits), falls back to `initial`.
 * - Every update is written immediately, from the setter itself, and the
 *   hook reports whether that write succeeded.
 * - Follows changes made by other tabs (the `storage` event), so a stale
 *   tab never overwrites newer data with its own outdated snapshot: the
 *   next update in this tab builds on what the other tab saved.
 */
export function useLocalStorageState<T>(
  key: string,
  initial: T,
  isValid: (value: unknown) => value is T,
): [T, (action: SetStateAction<T>) => void, LocalStorageStatus] {
  const [initialRead] = useState(() => readStoredValue(key, initial, isValid));
  const [state, setState] = useState<T>(initialRead.value);
  const [persisted, setPersisted] = useState(initialRead.readable);
  // Latest value, updated synchronously so consecutive updates in one
  // event (or right after another tab's change) compose correctly.
  const current = useRef<T>(initialRead.value);
  const initialRef = useRef(initial);
  const isValidRef = useRef(isValid);

  const update = useCallback(
    (action: SetStateAction<T>) => {
      const next = typeof action === 'function' ? (action as (previous: T) => T)(current.current) : action;
      current.current = next;
      setState(next);
      try {
        window.localStorage.setItem(key, JSON.stringify(next));
        setPersisted(true);
      } catch {
        setPersisted(false);
      }
    },
    [key],
  );

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== key || event.storageArea !== window.localStorage) return;
      const next = parseStored(event.newValue, initialRef.current, isValidRef.current);
      current.current = next;
      setState(next);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [key]);

  return [state, update, { persisted }];
}

function parseStored<T>(raw: string | null, initial: T, isValid: (value: unknown) => value is T): T {
  if (raw === null) return initial;
  try {
    const parsed: unknown = JSON.parse(raw);
    return isValid(parsed) ? parsed : initial;
  } catch {
    return initial;
  }
}

function readStoredValue<T>(key: string, initial: T, isValid: (value: unknown) => value is T): { value: T; readable: boolean } {
  try {
    return { value: parseStored(window.localStorage.getItem(key), initial, isValid), readable: true };
  } catch {
    return { value: initial, readable: false };
  }
}
