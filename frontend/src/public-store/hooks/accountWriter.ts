import { ApiError, apiRequest } from '../../shared/api/client';
import { meToolEntriesUrl, meToolEntryUrl } from '../../shared/config/api';

export interface SavedEntry {
  kind: string;
  key: string;
  data: unknown;
  updatedAt: string;
}

export interface AccountWriterEvents {
  onSaving: () => void;
  /** An entry was stored (or a newer revision already was); `idle` is true when nothing else is waiting. */
  onSaved: (entry: SavedEntry | null, idle: boolean) => void;
  onError: () => void;
}

const RETRY_DELAY_MS = 5000;

let lastRevision = 0;

/**
 * A strictly increasing revision for every write: microseconds since the
 * epoch, bumped if two writes land in the same one. The server keeps the
 * highest revision per entry, so requests that arrive out of order (a slow
 * autosave, a keepalive sent while leaving) can never replace newer writing.
 */
export function nextRevision(): number {
  lastRevision = Math.max(Date.now() * 1000, lastRevision + 1);
  return lastRevision;
}

export function putEntry(
  tool: string,
  kind: string,
  key: string,
  data: unknown,
  revision: number,
  keepalive = false,
): Promise<SavedEntry> {
  return apiRequest<SavedEntry>(meToolEntryUrl(tool, kind, key), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data, revision }),
    keepalive,
  });
}

/** A 409 TOOL_ENTRY_STALE means a newer revision is already stored: nothing to retry. */
export function isStaleWrite(error: unknown): boolean {
  return error instanceof ApiError && error.status === 409 && error.code === 'TOOL_ENTRY_STALE';
}

interface PendingWrite {
  kind: string;
  key: string;
  data: unknown;
  revision: number;
}

/**
 * Sends a tool's account writes to the API, outside React state:
 *
 * - fast edits to one entry are debounced into a single request, and at
 *   most one request per entry is in flight while the page is open;
 * - every write carries a revision, so the server ignores older ones;
 * - a delete (single or bulk) requested while a save is in flight is
 *   applied after that save, and the save is never retried;
 * - failures keep the newest data queued and retry after a few seconds;
 * - `flushOnExit` sends whatever is still waiting with `keepalive`.
 */
export function createAccountWriter(tool: string, events: AccountWriterEvents) {
  const pending = new Map<string, PendingWrite>();
  const timers = new Map<string, number>();
  const inFlight = new Set<string>();
  const deleteAfterFlight = new Set<string>();
  let retryTimer: number | null = null;

  const idOf = (kind: string, key: string) => `${kind}/${key}`;
  const matchesKind = (id: string, kind?: string) => !kind || id.startsWith(`${kind}/`);

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
    putEntry(tool, write.kind, write.key, write.data, write.revision)
      .then((saved) => events.onSaved(saved, pending.size === 0 && inFlight.size === 1))
      .catch((error: unknown) => {
        if (isStaleWrite(error)) {
          events.onSaved(null, pending.size === 0 && inFlight.size === 1);
          return;
        }
        // Keep the newest data queued, unless the entry was deleted meanwhile.
        if (!pending.has(id) && !deleteAfterFlight.has(id)) pending.set(id, write);
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
      pending.set(id, { kind, key, data, revision: nextRevision() });
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
        if (!matchesKind(id, kind)) continue;
        cancelTimer(id);
        pending.delete(id);
      }
      // A save still in flight could land after the bulk delete: delete it again once it does.
      for (const id of inFlight) {
        if (matchesKind(id, kind)) deleteAfterFlight.add(id);
      }
      const query = kind ? `?kind=${encodeURIComponent(kind)}` : '';
      sendDelete(`${meToolEntriesUrl(tool)}${query}`);
    },

    /**
     * Sends every waiting write immediately, even if an older save of the
     * same entry is still in flight: revisions make the newest one win.
     */
    flushOnExit() {
      for (const [id, write] of pending) {
        cancelTimer(id);
        void putEntry(tool, write.kind, write.key, write.data, write.revision, true).catch(() => undefined);
      }
      pending.clear();
    },
  };
}

export type AccountWriter = ReturnType<typeof createAccountWriter>;
