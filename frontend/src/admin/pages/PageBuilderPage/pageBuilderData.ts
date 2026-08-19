/**
 * Block-editor data: the palette (architecture.md §11's block types) and
 * the per-block style maps (background/width presets, §12). Editing a
 * block only ever picks from these presets — never arbitrary CSS — per
 * architecture.md §12's "preferir opciones predefinidas frente a
 * permitir CSS arbitrario".
 */
export type BlockBg = 'crema' | 'cielo' | 'azul';
export type BlockWidth = 'normal' | 'amplio' | 'completo';

export interface PageBlock {
  id: string;
  type: string;
  label: string;
  bg: BlockBg;
  width: BlockWidth;
  hidden: boolean;
  vis: { d: boolean; t: boolean; m: boolean };
}

export const BG_STYLES: Record<BlockBg, string> = {
  crema: 'oklch(96% 0.02 78)',
  cielo: 'linear-gradient(135deg, oklch(91% 0.035 232), oklch(87% 0.05 250))',
  azul: 'oklch(28% 0.06 254)',
};

export const BG_TEXT_COLOR: Record<BlockBg, string> = {
  crema: 'oklch(30% 0.03 255)',
  cielo: 'oklch(28% 0.03 255)',
  azul: 'oklch(96% 0.02 80)',
};

export const WIDTH_MAX: Record<BlockWidth, string> = {
  normal: '640px',
  amplio: '100%',
  completo: '100%',
};

/** Mirrors Home's actual section sequence (architecture.md §1.3) as the starting draft for "Inicio". */
export const INITIAL_BLOCKS: PageBlock[] = [
  { id: 'hero', type: 'Hero', label: 'Hero — Presentación', bg: 'crema', width: 'normal', hidden: false, vis: { d: true, t: true, m: true } },
  { id: 'galeria', type: 'Galería', label: 'Galería de fotos', bg: 'crema', width: 'completo', hidden: false, vis: { d: true, t: true, m: true } },
  { id: 'manifiesto', type: 'Texto', label: 'Manifiesto de marca', bg: 'cielo', width: 'normal', hidden: false, vis: { d: true, t: true, m: true } },
  { id: 'libros', type: 'Libros', label: 'Libros destacados', bg: 'crema', width: 'amplio', hidden: false, vis: { d: true, t: true, m: true } },
  { id: 'meditaciones', type: 'Imagen + texto', label: 'Meditaciones', bg: 'crema', width: 'amplio', hidden: false, vis: { d: true, t: true, m: true } },
  { id: 'herramientas', type: 'Imagen + texto', label: 'Caja de herramientas', bg: 'crema', width: 'amplio', hidden: false, vis: { d: true, t: true, m: true } },
  { id: 'about', type: 'Sobre el autor', label: 'Sobre el proyecto', bg: 'crema', width: 'amplio', hidden: false, vis: { d: true, t: true, m: false } },
  { id: 'newsletter', type: 'CTA', label: 'Newsletter', bg: 'azul', width: 'completo', hidden: false, vis: { d: true, t: true, m: true } },
];

export const CONTENT_BLOCKS = [
  'Título', 'Texto', 'Texto enriquecido', 'Imagen', 'Imagen + texto', 'Galería', 'Video', 'Cita', 'Separador', 'Espaciador',
];
export const LAYOUT_BLOCKS = ['Sección', '2 columnas', '3 columnas', 'Contenedor'];
export const MARKETING_BLOCKS = [
  'Hero', 'Llamado a la acción', 'Características', 'Testimonios', 'Preguntas frecuentes', 'Sobre el autor',
];
export const COMMERCE_BLOCKS = ['Portada del libro', 'Precio', 'Botón de compra', 'Libros relacionados'];

export type PageStatus = 'published' | 'draft' | 'unsaved';

export const STATUS_LABEL: Record<PageStatus, string> = {
  published: 'Publicado',
  draft: 'Guardado',
  unsaved: 'Cambios sin guardar',
};
