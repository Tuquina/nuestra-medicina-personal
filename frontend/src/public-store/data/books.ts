/**
 * Mock catalog data. There's no backend yet (architecture.md §34 defines
 * `GET /api/v1/books` for this) — this stands in until it exists. Keep
 * the shape close to what that endpoint will actually return so swapping
 * a `fetch` in later doesn't change consuming components.
 */
export interface Book {
  slug: string;
  title: string;
  category: string;
  /** Which recolor of the shared gold/blue category treatment to use. */
  variant: 'gold' | 'blue';
  shortDescription: string;
  priceMinorUnits: number;
  currency: string;
  coverCaption: string;
}

export const FEATURED_BOOKS: Book[] = [
  {
    slug: 'el-poder-de-tu-historia',
    title: 'El poder de tu historia',
    category: 'Escritura',
    variant: 'gold',
    shortDescription:
      'Un recorrido íntimo por la escritura como herramienta de autoconocimiento.',
    priceMinorUnits: 1_890_000,
    currency: 'ARS',
    coverCaption: 'Portada — El poder de tu historia',
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
    coverCaption: 'Portada — La escritura terapéutica entra a la escuela',
  },
];
