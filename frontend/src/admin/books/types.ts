import type { BookStatus } from '../../public-store/data/books';

export type BookVariant = 'gold' | 'blue';

export interface AdminBook {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  authorName: string;
  category: string;
  variant: BookVariant;
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
  status: BookStatus;
  seoTitle: string;
  seoDescription: string;
  seoIndexable: boolean;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
}

export interface AdminBookList {
  items: AdminBook[];
  total: number;
}

export type AdminBookInput = Omit<
  AdminBook,
  'id' | 'hasCover' | 'createdAt' | 'updatedAt' | 'publishedAt'
>;

export interface EbookUploadResponse {
  bookId: string;
  filename: string;
  mediaType: 'application/pdf' | 'application/epub+zip';
  sizeBytes: number;
}
