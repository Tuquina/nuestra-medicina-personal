/**
 * Mock purchase records for the current mock user (see currentUser.ts).
 * Stands in for `GET /api/v1/me/books` (architecture.md §27) — that
 * endpoint returns books joined through PAID orders, so this only ever
 * references real catalog slugs rather than duplicating book data.
 */
export interface LibraryEntry {
  bookSlug: string;
  purchasedAtLabel: string;
}

export const LIBRARY_ENTRIES: LibraryEntry[] = [
  { bookSlug: 'el-poder-de-tu-historia', purchasedAtLabel: 'Comprado el 12 de marzo de 2026' },
  {
    bookSlug: 'la-escritura-terapeutica-entra-a-la-escuela',
    purchasedAtLabel: 'Comprado el 2 de junio de 2026',
  },
];
