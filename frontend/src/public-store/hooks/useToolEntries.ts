import { useCallback, useEffect, useMemo, useState } from 'react';
import { ApiError, apiRequest } from '../../shared/api/client';
import { useAuth } from '../../shared/auth/useAuth';
import { meToolEntriesUrl } from '../../shared/config/api';
import { useLocalStorageState } from '../../shared/hooks/useLocalStorageState';
import type { ToolSlug } from '../../shared/cms/collectionContent';
import { createAccountWriter, isStaleWrite, nextRevision, putEntry, type SavedEntry } from './accountWriter';
import { deviceStorageKey, migrateLegacyDeviceEntries } from './legacyDeviceEntries';

/**
 * Where a Herramientas tool keeps what the person writes:
 *
 * - **account**: signed in and account storage is available — entries are
 *   saved through `/api/v1/me/tools/...`, encrypted on the server with the
 *   person's own key (ADR 0006). Nothing is cached in the browser.
 * - **device**: no session (or account storage is off) — entries live in
 *   this browser's `localStorage`, as before.
 *
 * Every tool stores the same generic shape: entries grouped by `kind`,
 * each identified by a `key` and holding a JSON object as `data`.
 */
export type ToolStorageMode = 'loading' | 'account' | 'device';
export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export interface ToolEntry {
  data: unknown;
  updatedAt: string;
}

/** kind → key → entry */
export type EntryMap = Record<string, Record<string, ToolEntry>>;

export interface ToolEntriesStore {
  mode: ToolStorageMode;
  /** Account entries failed to load; the tool must not be edited until `retryLoad` succeeds. */
  loadError: boolean;
  retryLoad: () => void;
  entries: EntryMap;
  /** Creates or replaces an entry. `debounceMs` groups fast edits (typing) into one save. */
  save: (kind: string, key: string, data: Record<string, unknown>, options?: { debounceMs?: number }) => void;
  remove: (kind: string, key: string) => void;
  /** Deletes every entry of the tool, or only those of one kind. */
  removeAll: (kind?: string) => void;
  saveStatus: SaveStatus;
  /** Entries saved in this browser that can be moved into the account. */
  deviceEntryCount: number;
  importing: boolean;
  importDeviceEntries: () => Promise<void>;
}

interface ApiPage {
  entries: SavedEntry[];
  nextCursor: string | null;
}

type AccountState =
  | { status: 'idle' }
  | { status: 'ready'; userId: string; entries: EntryMap }
  | { status: 'unavailable'; userId: string }
  | { status: 'error'; userId: string };

function isEntryMap(value: unknown): value is EntryMap {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  return Object.values(value).every(
    (byKey) =>
      typeof byKey === 'object' &&
      byKey !== null &&
      Object.values(byKey).every(
        (entry) =>
          typeof entry === 'object' &&
          entry !== null &&
          'data' in entry &&
          typeof (entry as { updatedAt?: unknown }).updatedAt === 'string',
      ),
  );
}

function withEntry(map: EntryMap, kind: string, key: string, entry: ToolEntry | null): EntryMap {
  const byKey = { ...(map[kind] ?? {}) };
  if (entry) byKey[key] = entry;
  else delete byKey[key];
  return { ...map, [kind]: byKey };
}

function withoutKind(map: EntryMap, kind?: string): EntryMap {
  if (!kind) return {};
  const next = { ...map };
  delete next[kind];
  return next;
}

function countEntries(map: EntryMap): number {
  return Object.values(map).reduce((total, byKey) => total + Object.keys(byKey).length, 0);
}

async function fetchAllEntries(tool: string): Promise<EntryMap> {
  let map: EntryMap = {};
  let cursor: string | null = null;
  // Bounded loop: the server caps entries per tool, so this always ends.
  for (let page = 0; page < 100; page++) {
    const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
    const response: ApiPage = await apiRequest<ApiPage>(`${meToolEntriesUrl(tool)}${query}`);
    for (const entry of response.entries) {
      map = withEntry(map, entry.kind, entry.key, { data: entry.data, updatedAt: entry.updatedAt });
    }
    cursor = response.nextCursor;
    if (!cursor) break;
  }
  return map;
}

export function useToolEntries(tool: ToolSlug): ToolEntriesStore {
  const auth = useAuth();
  const authUserId = auth.status === 'authenticated' ? auth.user.id : null;

  // Must run before the device store reads `.v2`: converts the first version's data once.
  useState(() => migrateLegacyDeviceEntries(tool));
  const [device, setDevice, { persisted: devicePersisted }] = useLocalStorageState<EntryMap>(
    deviceStorageKey(tool),
    {},
    isEntryMap,
  );
  const [account, setAccount] = useState<AccountState>({ status: 'idle' });
  const [reloadToken, setReloadToken] = useState(0);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [importing, setImporting] = useState(false);

  const setAccountEntries = useCallback((update: (entries: EntryMap) => EntryMap) => {
    setAccount((previous) => (previous.status === 'ready' ? { ...previous, entries: update(previous.entries) } : previous));
  }, []);

  const writer = useMemo(
    () =>
      createAccountWriter(tool, {
        onSaving: () => setSaveStatus('saving'),
        onSaved: (saved, idle) => {
          // Only refresh the timestamp: the local data may already be newer.
          if (saved) {
            setAccountEntries((entries) => {
              const current = entries[saved.kind]?.[saved.key];
              return current ? withEntry(entries, saved.kind, saved.key, { ...current, updatedAt: saved.updatedAt }) : entries;
            });
          }
          if (idle) setSaveStatus('saved');
        },
        onError: () => setSaveStatus('error'),
      }),
    [tool, setAccountEntries],
  );

  // Leaving the page (or the tool): send whatever is still waiting.
  useEffect(() => {
    const onPageHide = () => writer.flushOnExit();
    window.addEventListener('pagehide', onPageHide);
    return () => {
      window.removeEventListener('pagehide', onPageHide);
      writer.flushOnExit();
    };
  }, [writer]);

  useEffect(() => {
    if (!authUserId) return;
    let cancelled = false;
    fetchAllEntries(tool)
      .then((entries) => {
        if (!cancelled) setAccount({ status: 'ready', userId: authUserId, entries });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const unavailable = error instanceof ApiError && (error.status === 503 || error.status === 401);
        setAccount({ status: unavailable ? 'unavailable' : 'error', userId: authUserId });
      });
    return () => {
      cancelled = true;
    };
  }, [tool, authUserId, reloadToken]);

  // Account state only counts for the user it was loaded for.
  const accountForUser = account.status !== 'idle' && account.userId === authUserId ? account : null;
  const mode: ToolStorageMode =
    auth.status === 'loading'
      ? 'loading'
      : !authUserId
        ? 'device'
        : !accountForUser
          ? 'loading'
          : accountForUser.status === 'unavailable'
            ? 'device'
            : 'account';
  const loadError = accountForUser?.status === 'error';
  const accountEntries = accountForUser?.status === 'ready' ? accountForUser.entries : null;

  const save = useCallback<ToolEntriesStore['save']>(
    (kind, key, data, options) => {
      const entry: ToolEntry = { data, updatedAt: new Date().toISOString() };
      if (mode !== 'account') {
        setDevice((previous) => withEntry(previous, kind, key, entry));
        return;
      }
      setAccountEntries((entries) => withEntry(entries, kind, key, entry));
      writer.save(kind, key, data, options?.debounceMs);
    },
    [mode, writer, setDevice, setAccountEntries],
  );

  const remove = useCallback<ToolEntriesStore['remove']>(
    (kind, key) => {
      if (mode !== 'account') {
        setDevice((previous) => withEntry(previous, kind, key, null));
        return;
      }
      setAccountEntries((entries) => withEntry(entries, kind, key, null));
      writer.remove(kind, key);
    },
    [mode, writer, setDevice, setAccountEntries],
  );

  const removeAll = useCallback<ToolEntriesStore['removeAll']>(
    (kind) => {
      if (mode !== 'account') {
        setDevice((previous) => withoutKind(previous, kind));
        return;
      }
      setAccountEntries((entries) => withoutKind(entries, kind));
      writer.removeAll(kind);
    },
    [mode, writer, setDevice, setAccountEntries],
  );

  const importDeviceEntries = useCallback(async () => {
    if (mode !== 'account' || !accountEntries) return;
    setImporting(true);
    try {
      for (const [kind, byKey] of Object.entries(device)) {
        for (const [key, entry] of Object.entries(byKey)) {
          const existing = accountEntries[kind]?.[key];
          // Keep whichever version is newer.
          if (existing && existing.updatedAt >= entry.updatedAt) continue;
          try {
            const saved = await putEntry(tool, kind, key, entry.data, nextRevision());
            setAccountEntries((entries) => withEntry(entries, kind, key, { data: entry.data, updatedAt: saved.updatedAt }));
          } catch (error) {
            // Edited in the account meanwhile: the account's newer version wins.
            if (!isStaleWrite(error)) throw error;
          }
        }
      }
      setDevice({});
      setSaveStatus('saved');
    } catch {
      setSaveStatus('error');
    } finally {
      setImporting(false);
    }
  }, [mode, accountEntries, device, tool, setDevice, setAccountEntries]);

  const retryLoad = useCallback(() => {
    setAccount({ status: 'idle' });
    setReloadToken((value) => value + 1);
  }, []);

  return {
    mode,
    loadError,
    retryLoad,
    entries: mode === 'account' ? (accountEntries ?? {}) : device,
    save,
    remove,
    removeAll,
    saveStatus: mode === 'device' ? (devicePersisted ? 'saved' : 'error') : saveStatus,
    deviceEntryCount: mode === 'account' ? countEntries(device) : 0,
    importing,
    importDeviceEntries,
  };
}
