export interface LibraryBookResponse {
  id: string;
  slug: string;
  title: string;
  coverMediaId: string | null;
  format: string;
  fileSizeBytes: number | null;
  purchasedAt: string;
  downloadAvailable: boolean;
}

export interface LibraryResponse {
  items: LibraryBookResponse[];
  total: number;
}
