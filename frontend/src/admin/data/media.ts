/**
 * Mock media library. Stands in for `media` (architecture.md §16-17) —
 * real files live on disk/object storage with only metadata + path in
 * Postgres, never as file content here.
 */
export type MediaCategory = 'Imágenes' | 'Portadas';

export interface MediaItem {
  id: number;
  name: string;
  type: 'Imagen' | 'Portada';
  category: MediaCategory;
  dims: string;
  sizeLabel: string;
  dateLabel: string;
  usedIn: string;
  accent: string;
}

/** Cycled across tiles, matching the mockup's 4-color rotation. */
export const THUMB_ACCENTS = [
  'var(--color-sky-pale)',
  'var(--color-accent-amber-soft)',
  'color-mix(in oklch, var(--color-accent-gold) 50%, transparent)',
  'color-mix(in oklch, var(--color-sky) 60%, transparent)',
];

export const MEDIA_ITEMS: MediaItem[] = [
  {
    id: 1,
    name: 'amanecer-01.jpg',
    type: 'Imagen',
    category: 'Imágenes',
    dims: '2400 × 1600 px',
    sizeLabel: '1,2 MB',
    dateLabel: '3 ago 2026',
    usedIn: 'Inicio — Hero',
    accent: THUMB_ACCENTS[0],
  },
  {
    id: 2,
    name: 'meadow-mujer.jpg',
    type: 'Imagen',
    category: 'Imágenes',
    dims: '2000 × 1500 px',
    sizeLabel: '980 KB',
    dateLabel: '2 ago 2026',
    usedIn: 'Inicio — Galería',
    accent: THUMB_ACCENTS[1],
  },
  {
    id: 3,
    name: 'portada-poder-historia.jpg',
    type: 'Portada',
    category: 'Portadas',
    dims: '1200 × 1800 px',
    sizeLabel: '640 KB',
    dateLabel: '28 jul 2026',
    usedIn: 'El poder de tu historia',
    accent: THUMB_ACCENTS[2],
  },
  {
    id: 4,
    name: 'cielo-estrellado.jpg',
    type: 'Imagen',
    category: 'Imágenes',
    dims: '2400 × 1600 px',
    sizeLabel: '1,4 MB',
    dateLabel: '25 jul 2026',
    usedIn: 'Inicio — Galería',
    accent: THUMB_ACCENTS[3],
  },
  {
    id: 5,
    name: 'portada-escritura-escuela.jpg',
    type: 'Portada',
    category: 'Portadas',
    dims: '1200 × 1800 px',
    sizeLabel: '710 KB',
    dateLabel: '20 jul 2026',
    usedIn: 'La escritura terapéutica...',
    accent: THUMB_ACCENTS[0],
  },
  {
    id: 6,
    name: 'gratitud-mesa.jpg',
    type: 'Imagen',
    category: 'Imágenes',
    dims: '2000 × 1500 px',
    sizeLabel: '890 KB',
    dateLabel: '18 jul 2026',
    usedIn: 'Inicio — Galería',
    accent: THUMB_ACCENTS[1],
  },
  {
    id: 7,
    name: 'retrato-autor.jpg',
    type: 'Imagen',
    category: 'Imágenes',
    dims: '1600 × 1600 px',
    sizeLabel: '520 KB',
    dateLabel: '10 jul 2026',
    usedIn: 'Inicio — Sobre el proyecto',
    accent: THUMB_ACCENTS[2],
  },
  {
    id: 8,
    name: 'nino-animales.jpg',
    type: 'Imagen',
    category: 'Imágenes',
    dims: '2400 × 1600 px',
    sizeLabel: '1,1 MB',
    dateLabel: '5 jul 2026',
    usedIn: 'Inicio — Galería',
    accent: THUMB_ACCENTS[3],
  },
];
