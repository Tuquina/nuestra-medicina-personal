/**
 * Mock catalog data. There's no backend yet (architecture.md §34 defines
 * `GET /api/v1/books` for this, §8.1 defines the `Book` entity) — this
 * stands in until it exists. Keep the shape close to what that endpoint
 * will actually return so swapping a `fetch` in later doesn't change
 * consuming components.
 */
export type BookStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

export interface Book {
  slug: string;
  title: string;
  category: string;
  /** Which recolor of the shared gold/blue category treatment to use. */
  variant: 'gold' | 'blue';
  shortDescription: string;
  priceMinorUnits: number;
  currency: string;
  /** e.g. "PDF · EPUB" — architecture.md §8.1's `format` field. */
  format: string;
  coverCaption: string;
  status: BookStatus;
}

/**
 * Every book, any status — for admin use only. Public pages must use
 * `PUBLISHED_BOOKS` instead: "La web pública nunca debe mostrar cambios
 * no publicados" (architecture.md §15).
 */
export const BOOKS: Book[] = [
  {
    slug: 'el-poder-de-tu-historia',
    title: 'El poder de tu historia',
    category: 'Escritura',
    variant: 'gold',
    shortDescription:
      'Un recorrido íntimo por la escritura como herramienta de autoconocimiento.',
    priceMinorUnits: 1_890_000,
    currency: 'ARS',
    format: 'PDF · EPUB',
    coverCaption: 'Portada — El poder de tu historia',
    status: 'PUBLISHED',
  },
  {
    slug: 'la-escritura-terapeutica-entra-a-la-escuela',
    title: 'La escritura terapéutica entra a la escuela',
    category: 'Educación',
    variant: 'blue',
    shortDescription:
      'Una guía para docentes que quieren llevar la escritura reflexiva al aula.',
    priceMinorUnits: 2_150_000,
    currency: 'ARS',
    format: 'PDF · EPUB',
    coverCaption: 'Portada — La escritura terapéutica entra a la escuela',
    status: 'PUBLISHED',
  },
  {
    slug: 'meditaciones-vol-1',
    title: 'Meditaciones — vol. 1',
    category: 'Meditaciones',
    variant: 'blue',
    shortDescription: 'Prácticas breves para volver a habitar el cuerpo y la respiración.',
    priceMinorUnits: 1_500_000,
    currency: 'ARS',
    format: 'PDF · EPUB',
    coverCaption: 'Portada — Meditaciones vol. 1',
    status: 'DRAFT',
  },
];

/** What every public page should render from — never a draft/archived book. */
export const PUBLISHED_BOOKS: Book[] = BOOKS.filter((book) => book.status === 'PUBLISHED');

/** Category filters shown on `/libros` (architecture.md §1.1 taxonomy). */
export const CATALOG_FILTERS = [
  'Todos',
  'Escritura',
  'Educación',
  'Meditaciones',
  'Herramientas personales',
] as const;

export type CatalogFilter = (typeof CATALOG_FILTERS)[number];
