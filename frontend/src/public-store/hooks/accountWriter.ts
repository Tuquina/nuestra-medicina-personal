import { apiRequest } from '../../shared/api/client';
import { meToolEntriesUrl, meToolEntryUrl } from '../../shared/config/api';

export interface SavedEntry {
  kind: string;
  key: string;
  data: unknown;
  updatedAt: string;
}

export interface AccountWriterEvents {
  onSaving: () => void;
  /** An entry was stored; `idle` is true when nothing else is waiting or in flight. */
  onSaved: (entry: SavedEntry, idle: boolean) => void;
  onError: () => void;
}

const RETRY_DELAY_MS = 5000;

export function putEntry(tool: string, kind: string, key: string, data: unknown, keepalive = false): Promise<SavedEntry> {
  return apiRequest<SavedEntry>(meToolEntryUrl(tool, kind, key), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data }),
    keepalive,
  });
}

/**
 * Sends a tool's account writes to the API, outside React state:
 *
 * - fast edits to one entry are debounced into a single request;
 * - at most one request per entry is in flight, and the newest data is
 *   sent after it, so an older save never lands after a newer one;
 * - a delete requested while that entry's save is in flight waits for it;
 * - failures keep the newest data queued and retry after a few seconds;
 * - `flushOnExit` sends whatever is still waiting with `keepalive`.
 */
export function createAccountWriter(tool: string, events: AccountWriterEvents) {
  const pending = new Map<string, { kind: string; key: string; data: unknown }>();
  const timers = new Map<string, number>();
  const inFlight = new Set<string>();
  const deleteAfterFlight = new Set<string>();
  let retryTimer: number | null = null;

  const idOf = (kind: string, key: string) => `${kind}/${key}`;

  function cancelTimer(id: string) {
    const timer = timers.get(id);
    if (timer !== undefined) window.clearTimeout(timer);
    timers.delete(id);
  }

  function sendDelete(url: string) {
    apiRequest<void>(url, { method: 'DELETE' }).catch(() => events.onError());
  }

  function scheduleRetry() {
    if (retryTimer !== null) return;
    retryTimer = window.setTimeout(() => {
      retryTimer = null;
      for (const id of [...pending.keys()]) flush(id);
    }, RETRY_DELAY_MS);
  }

  function flush(id: string) {
    cancelTimer(id);
    const write = pending.get(id);
    if (!write || inFlight.has(id)) return;
    pending.delete(id);
    inFlight.add(id);
    events.onSaving();
    putEntry(tool, write.kind, write.key, write.data)
      .then((saved) => events.onSaved(saved, pending.size === 0 && inFlight.size === 1))
      .catch(() => {
        if (!pending.has(id)) pending.set(id, write);
        events.onError();
        scheduleRetry();
      })
      .finally(() => {
        inFlight.delete(id);
        if (deleteAfterFlight.delete(id)) {
          pending.delete(id);
          sendDelete(meToolEntryUrl(tool, write.kind, write.key));
          return;
        }
        if (pending.has(id) && !timers.has(id) && retryTimer === null) flush(id);
      });
  }

  return {
    save(kind: string, key: string, data: unknown, debounceMs = 0) {
      const id = idOf(kind, key);
      deleteAfterFlight.delete(id);
      pending.set(id, { kind, key, data });
      cancelTimer(id);
      if (debounceMs > 0) {
        events.onSaving();
        timers.set(id, window.setTimeout(() => flush(id), debounceMs));
      } else {
        flush(id);
      }
    },

    remove(kind: string, key: string) {
      const id = idOf(kind, key);
      cancelTimer(id);
      pending.delete(id);
      if (inFlight.has(id)) {
        deleteAfterFlight.add(id);
        return;
      }
      sendDelete(meToolEntryUrl(tool, kind, key));
    },

    /** Deletes every entry of the tool, or only those of one kind. */
    removeAll(kind?: string) {
      for (const id of [...pending.keys(), ...timers.keys()]) {
        if (kind && !id.startsWith(`${kind}/`)) continue;
        cancelTimer(id);
        pending.delete(id);
      }
      const query = kind ? `?kind=${encodeURIComponent(kind)}` : '';
      sendDelete(`${meToolEntriesUrl(tool)}${query}`);
    },

    flushOnExit() {
      for (const [id, write] of pending) {
        cancelTimer(id);
        void putEntry(tool, write.kind, write.key, write.data, true).catch(() => undefined);
      }
      pending.clear();
    },
  };
}

export type AccountWriter = ReturnType<typeof createAccountWriter>;
