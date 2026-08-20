import type { Book } from '../data/books';

export interface CatalogBookResponse {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  authorName: string;
  category: string;
  variant: Book['variant'];
  shortDescription: string;
  priceMinorUnits: number;
  currency: string;
  isbn: string;
  publicationDate: string | null;
  publicationDateLabel: string;
  format: string;
  fileSizeBytes: number | null;
  coverMediaId: string | null;
  coverCaption: string;
  hasCover: boolean;
  status: Book['status'];
  seoTitle: string;
  seoDescription: string;
  seoIndexable: boolean;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
}

export interface CatalogResponse {
  items: CatalogBookResponse[];
  total: number;
}

export type CatalogState =
  | { status: 'loading'; retry: () => void }
  | { status: 'ready'; books: Book[]; retry: () => void }
  | { status: 'error'; retry: () => void };
