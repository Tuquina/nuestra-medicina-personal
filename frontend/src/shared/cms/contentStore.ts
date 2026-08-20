/**
 * localStorage-backed persistence for editable pages (Home + book landing
 * pages) — a temporary stand-in for the real `pages` API (see types.ts for
 * why the shape matches the backend's `pages` table exactly).
 *
 * Every read/write goes through this module so that once real endpoints
 * exist (`GET/PUT /api/v1/admin/pages/{id}`, `POST .../publish`, and a
 * public `GET /api/v1/pages/{slug}`), only this file needs to change
 * — every admin editor and every public page keeps calling the same
 * functions.
 */
import type { PageContent, PageRecord, PageStatus, PageType } from './types';
import { emptyContent } from './types';

const STORAGE_KEY = 'nmp_admin_pages_v1';

type StoredState = Record<string, PageRecord>;

const listeners = new Set<() => void>();

function recordKey(type: PageType, slug: string): string {
  return `${type}:${slug}`;
}

function readAll(): StoredState {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredState) : {};
  } catch {
    return {};
  }
}

function writeAll(state: StoredState): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  notify();
}

function notify(): void {
  listeners.forEach((listener) => listener());
}

if (typeof window !== 'undefined') {
  // Cross-tab: the public site (another tab) picks up admin publishes live.
  window.addEventListener('storage', (event) => {
    if (event.key === STORAGE_KEY) notify();
  });
}

/** Subscribe to any change in the page-content store (any page, any field).
 * Returns an unsubscribe function. Fires on same-tab writes too, unlike the
 * native `storage` event. */
export function subscribeToContentStore(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Reads a page record, creating it (seeded from `seed()`) on first access.
 * Safe to call on every render — the seed only runs once per page per
 * browser (subsequent calls read the persisted record).
 */
export function getOrInitPage(
  type: PageType,
  slug: string,
  seed: () => PageContent,
  bookId?: string,
): PageRecord {
  const all = readAll();
  const key = recordKey(type, slug);
  const existing = all[key];
  if (existing) return existing;

  const content = seed();
  const now = new Date().toISOString();
  const record: PageRecord = {
    type,
    slug,
    bookId,
    status: 'PUBLISHED',
    draftContent: content,
    publishedContent: content,
    updatedAt: now,
    publishedAt: now,
  };
  all[key] = record;
  writeAll(all);
  return record;
}

/** The content that should render on the public site right now. Falls back
 * to `seed()` if the page has never been touched (keeps today's real copy
 * showing without requiring an admin visit first). */
export function getPublishedContent(type: PageType, slug: string, seed: () => PageContent): PageContent {
  const record = getOrInitPage(type, slug, seed);
  return record.publishedContent ?? seed();
}

/** The content an admin editor should load — the draft, which may include
 * unpublished changes. */
export function getDraftContent(type: PageType, slug: string, seed: () => PageContent): PageContent {
  const record = getOrInitPage(type, slug, seed);
  return record.draftContent;
}

export function getPageRecord(type: PageType, slug: string, seed: () => PageContent): PageRecord {
  return getOrInitPage(type, slug, seed);
}

/** Persists draft content without publishing it (the "Guardar borrador" action). */
export function saveDraft(type: PageType, slug: string, content: PageContent, seed: () => PageContent): PageRecord {
  const all = readAll();
  const key = recordKey(type, slug);
  const existing = all[key] ?? getOrInitPage(type, slug, seed);
  const record: PageRecord = {
    ...existing,
    draftContent: content,
    updatedAt: new Date().toISOString(),
  };
  all[key] = record;
  writeAll(all);
  return record;
}

/** Copies the current draft into `publishedContent` — what the public site
 * reads (the "Publicar" action, architecture.md §15's draft/published split). */
export function publishPage(type: PageType, slug: string, seed: () => PageContent): PageRecord {
  const all = readAll();
  const key = recordKey(type, slug);
  const existing = all[key] ?? getOrInitPage(type, slug, seed);
  const now = new Date().toISOString();
  const record: PageRecord = {
    ...existing,
    status: 'PUBLISHED' as PageStatus,
    publishedContent: existing.draftContent,
    updatedAt: now,
    publishedAt: now,
  };
  all[key] = record;
  writeAll(all);
  return record;
}

/** Reverts unpublished changes — discards the draft back to what's live. */
export function discardDraft(type: PageType, slug: string, seed: () => PageContent): PageRecord {
  const all = readAll();
  const key = recordKey(type, slug);
  const existing = all[key] ?? getOrInitPage(type, slug, seed);
  const record: PageRecord = {
    ...existing,
    draftContent: existing.publishedContent ?? emptyContent(),
    updatedAt: new Date().toISOString(),
  };
  all[key] = record;
  writeAll(all);
  return record;
}

export function isDraftDirty(record: PageRecord): boolean {
  return JSON.stringify(record.draftContent) !== JSON.stringify(record.publishedContent);
}
