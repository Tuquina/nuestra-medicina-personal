import type { BookStatus } from '../../../public-store/data/books';

/** The Información + SEO tabs' editable fields, as plain form state. */
export interface LibroFormState {
  title: string;
  subtitle: string;
  authorName: string;
  slug: string;
  shortDescription: string;
  /** Raw text as typed (e.g. "18.900") — parsed to minor units on save. */
  priceDisplay: string;
  currency: string;
  status: BookStatus;
  isbn: string;
  publicationDateLabel: string;
  format: string;
  seoTitle: string;
  seoDescription: string;
  seoIndexable: boolean;
}

export const STATUS_OPTIONS: { value: BookStatus; label: string }[] = [
  { value: 'PUBLISHED', label: 'Publicado' },
  { value: 'DRAFT', label: 'Borrador' },
  { value: 'ARCHIVED', label: 'Archivado' },
];
