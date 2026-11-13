import type { ToolSlug } from '../../shared/cms/collectionContent';
import type { EntryMap } from './useToolEntries';

/**
 * The first version of the tools kept each tool's data in its own shape
 * under `nmp.herramientas.<tool>.v1`. This converts that data, once, into
 * the generic entry map stored under `.v2`, so nothing written before is
 * lost (and it can then be moved into the account like any other entry).
 */
export function deviceStorageKey(tool: ToolSlug): string {
  return `nmp.herramientas.${tool}.v2`;
}

function legacyStorageKey(tool: ToolSlug): string {
  return `nmp.herramientas.${tool}.v1`;
}

type Record_ = Record<string, unknown>;

const isRecord = (value: unknown): value is Record_ => typeof value === 'object' && value !== null && !Array.isArray(value);
const isString = (value: unknown): value is string => typeof value === 'string';
const isStringArray = (value: unknown): value is string[] => Array.isArray(value) && value.every(isString);
const KEY = /^[A-Za-z0-9_-]{1,64}$/;

function put(map: EntryMap, kind: string, key: string, data: unknown, updatedAt: string) {
  if (!KEY.test(key)) return;
  map[kind] = { ...(map[kind] ?? {}), [key]: { data, updatedAt } };
}

function fromJournal(legacy: unknown, map: EntryMap) {
  if (!isRecord(legacy)) return;
  for (const [date, entry] of Object.entries(legacy)) {
    if (!isRecord(entry) || !isString(entry.prompt) || !isString(entry.text)) continue;
    const mood = isString(entry.mood) ? entry.mood : null;
    const updatedAt = isString(entry.updatedAt) && entry.updatedAt ? entry.updatedAt : new Date().toISOString();
    put(map, 'day', date, { prompt: entry.prompt, mood, text: entry.text }, updatedAt);
  }
}

function fromQuestions(legacy: unknown, map: EntryMap, now: string) {
  if (!isRecord(legacy)) return;
  if (isStringArray(legacy.favorites) && legacy.favorites.length > 0) {
    put(map, 'favorites', 'all', { ids: legacy.favorites }, now);
  }
  if (!Array.isArray(legacy.answers)) return;
  for (const answer of legacy.answers) {
    if (!isRecord(answer) || !isString(answer.id) || !isString(answer.questionId) || !isString(answer.text) || !isString(answer.date)) {
      continue;
    }
    // v1 ids were Date.now() values: keep them as the save time, so the order survives.
    const savedAt = /^\d+$/.test(answer.id) ? new Date(Number(answer.id)).toISOString() : now;
    put(map, 'answer', answer.id, { questionId: answer.questionId, text: answer.text, date: answer.date }, savedAt);
  }
}

function fromRitual(legacy: unknown, map: EntryMap, now: string) {
  if (!isRecord(legacy)) return;
  const fields = (value: Record_) =>
    isStringArray(value.moments) && isStringArray(value.gratitude) && isString(value.intention) && isString(value.care)
      ? { moments: value.moments, gratitude: value.gratitude, intention: value.intention, care: value.care }
      : null;

  if (Array.isArray(legacy.closures)) {
    for (const closure of legacy.closures) {
      if (!isRecord(closure) || !isString(closure.weekKey)) continue;
      const data = fields(closure);
      if (!data) continue;
      const savedAt = isString(closure.savedAt) ? closure.savedAt : now;
      put(map, 'closure', closure.weekKey, { ...data, weekLabel: isString(closure.weekLabel) ? closure.weekLabel : '' }, savedAt);
    }
  }
  if (isRecord(legacy.draft) && isString(legacy.draft.weekKey) && !map.closure?.[legacy.draft.weekKey]) {
    const data = fields(legacy.draft);
    const hasContent = data && [...data.moments, ...data.gratitude, data.intention, data.care].some((text) => text.trim());
    if (data && hasContent) put(map, 'draft', legacy.draft.weekKey, data, now);
  }
}

/** Converts `.v1` data into `.v2` when `.v2` doesn't exist yet. Safe to call on every mount. */
export function migrateLegacyDeviceEntries(tool: ToolSlug): void {
  try {
    const storage = window.localStorage;
    const raw = storage.getItem(legacyStorageKey(tool));
    if (raw === null || storage.getItem(deviceStorageKey(tool)) !== null) return;
    const legacy: unknown = JSON.parse(raw);
    const map: EntryMap = {};
    const now = new Date().toISOString();
    if (tool === 'escritura-diaria') fromJournal(legacy, map);
    if (tool === 'preguntas') fromQuestions(legacy, map, now);
    if (tool === 'cierre-semanal') fromRitual(legacy, map, now);
    storage.setItem(deviceStorageKey(tool), JSON.stringify(map));
    storage.removeItem(legacyStorageKey(tool));
  } catch {
    // Unreadable legacy data or blocked storage: leave everything as it is.
  }
}
