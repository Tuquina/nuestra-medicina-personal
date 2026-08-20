/**
 * Content model for editable pages (Home + each book's landing page).
 *
 * Shaped to match the real backend's `pages` table (migrations/001_initial_schema.up.sql,
 * see docs/architecture.md §13/§15): a page has a `type`, a `status`, and two
 * JSONB columns — `draft_content` and `published_content` — each holding
 * `{ schemaVersion, sections: [{ id, type, props }] }`. Keeping the exact same
 * shape here mirrors the API directly so editors, previews and public
 * renderers share one versioned content contract.
 *
 * Public pages read the published endpoint. Explicit admin previews use the
 * authenticated admin endpoint and render `draftContent`, so unpublished
 * edits never leak onto the live site (architecture.md §15).
 */

/**
 * Mirrors the backend and the expanded database constraint in migration 006.
 * Only `BOOK` carries `bookId`; the remaining values are singleton pages.
 */
export type PageType =
  | 'HOME'
  | 'BOOK'
  | 'MEDITACIONES'
  | 'HERRAMIENTAS'
  | 'CONTACTO'
  | 'SOPORTE'
  | 'FAQ'
  | 'TERMINOS'
  | 'PRIVACIDAD';
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
  id: string;
  type: PageType;
  /** 'inicio' for the Home page, the book's slug for a BOOK page. */
  slug: string;
  bookId: string | null;
  title: string;
  status: PageStatus;
  draftContent: PageContent;
  publishedContent: PageContent | null;
  updatedAt: string;
  publishedAt: string | null;
  createdAt: string;
}

export interface PublishedPage {
  id: string;
  type: PageType;
  bookId: string | null;
  slug: string;
  title: string;
  content: PageContent;
  publishedAt: string | null;
}

export interface PageVersion {
  id: string;
  versionNumber: number;
  content: PageContent;
  createdBy: string;
  createdAt: string;
}

export interface PageVersionList {
  items: PageVersion[];
  total: number;
}

export interface PageCreateInput {
  type: PageType;
  bookId: string | null;
  slug: string;
  title: string;
  content: PageContent;
}

export const HOME_SLUG = 'inicio';

export function emptyContent(): PageContent {
  return { schemaVersion: 1, sections: [] };
}
