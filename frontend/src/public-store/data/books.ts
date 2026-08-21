/**
 * Shared catalog types. The public catalog is API-backed
 * (`public-store/catalog/CatalogProvider.tsx` → `GET /api/v1/books`,
 * architecture.md §8.1/§34) — this file only keeps the `Book`/`BookStatus`
 * shape (mirroring that endpoint's response) and the static category
 * filter list below, both still used by admin and public pages.
 */
export type BookStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

export interface Book {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  authorName: string;
  category: string;
  /** Which recolor of the shared gold/blue category treatment to use. */
  variant: 'gold' | 'blue';
  shortDescription: string;
  /** 0 means no price has been set yet (a draft in progress). */
  priceMinorUnits: number;
  currency: string;
  /** e.g. "PDF · EPUB" — architecture.md §8.1's `format` field. */
  format: string;
  isbn: string;
  publicationDateLabel: string;
  coverMediaId: string | null;
  coverCaption: string;
  status: BookStatus;
  /** ISO date — admin's "Última actualización" column. */
  updatedAtISO: string;
  /** Whether a real cover has been uploaded (architecture.md §8.1 `cover_media_id`, nullable). */
  hasCover: boolean;
}

/** Category filters shown on `/libros` (architecture.md §1.1 taxonomy). */
export const CATALOG_FILTERS = [
  'Todos',
  'Escritura',
  'Educación',
  'Meditaciones',
  'Herramientas personales',
] as const;

export type CatalogFilter = (typeof CATALOG_FILTERS)[number];
