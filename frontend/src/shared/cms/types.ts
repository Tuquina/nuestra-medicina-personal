/**
 * Content model for editable pages (Home + each book's landing page).
 *
 * Shaped to match the real backend's `pages` table (migrations/001_initial_schema.up.sql,
 * see docs/architecture.md §13/§15): a page has a `type`, a `status`, and two
 * JSONB columns — `draft_content` and `published_content` — each holding
 * `{ schemaVersion, sections: [{ id, type, props }] }`. Keeping the exact same
 * shape here means swapping this localStorage-backed store for real API calls
 * later only touches `contentStore.ts`, not the editors or the public pages
 * that read through it.
 *
 * Public pages only ever read `publishedContent` — never `draftContent` —
 * except in an explicit `?preview=1` mode, so unpublished admin edits never
 * leak onto the live site (architecture.md §15).
 */

export type PageType = 'HOME' | 'BOOK';
export type PageStatus = 'DRAFT' | 'PUBLISHED';

/** A single content block. `props` is intentionally untyped here — each
 * section `type` (see `homeContent.ts` / `bookLandingContent.ts`) defines
 * its own props shape and casts at the point of use. */
export interface Section<TProps = Record<string, unknown>> {
  id: string;
  type: string;
  props: TProps;
  hidden?: boolean;
}

export interface PageContent {
  schemaVersion: 1;
  sections: Section[];
}

export interface PageRecord {
  type: PageType;
  /** 'inicio' for the Home page, the book's slug for a BOOK page. */
  slug: string;
  bookId?: string;
  status: PageStatus;
  draftContent: PageContent;
  publishedContent: PageContent | null;
  updatedAt: string;
  publishedAt: string | null;
}

export const HOME_SLUG = 'inicio';

export function emptyContent(): PageContent {
  return { schemaVersion: 1, sections: [] };
}
