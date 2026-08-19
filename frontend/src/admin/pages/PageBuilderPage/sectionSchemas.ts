/**
 * Describes, per Home section `type`, the human label and the form fields
 * the Inspector should render — one small declarative table driving a
 * single generic form component instead of bespoke JSX per block type.
 * Keeping this in one place is what makes the editor "más entendible":
 * every field an admin can touch actually changes real content on the
 * public Home page (shared/cms/homeContent.ts is the shared prop shape).
 */
export type FieldKind = 'text' | 'textarea' | 'select' | 'checkbox' | 'lines' | 'note';

export interface FieldDef {
  key: string;
  label: string;
  kind: FieldKind;
  /** Only used by kind: 'note' — a plain explanatory line, no input. */
  hint?: string;
  options?: { value: string; label: string }[];
}

export interface SectionSchema {
  label: string;
  /** Structural sections come from the real Home layout; generic ones are
   * freely addable/removable blocks from the palette. */
  kind: 'structural' | 'generic';
  fields: FieldDef[];
}

export const SECTION_SCHEMAS: Record<string, SectionSchema> = {
  hero: {
    label: 'Hero — Presentación',
    kind: 'structural',
    fields: [
      { key: 'eyebrow', label: 'Texto superior', kind: 'text' },
      { key: 'headingLine1', label: 'Título — línea 1', kind: 'text' },
      { key: 'headingLine2', label: 'Título — línea 2 (destacada)', kind: 'text' },
      { key: 'lede', label: 'Bajada', kind: 'textarea' },
      { key: 'primaryCtaLabel', label: 'Botón principal — texto', kind: 'text' },
      { key: 'primaryCtaTo', label: 'Botón principal — enlace', kind: 'text' },
      { key: 'secondaryCtaLabel', label: 'Enlace secundario — texto', kind: 'text' },
      { key: 'secondaryCtaTo', label: 'Enlace secundario — destino', kind: 'text' },
      { key: 'imageCaption', label: 'Descripción de la imagen', kind: 'text' },
    ],
  },
  gallery: {
    label: 'Galería de fotos',
    kind: 'structural',
    fields: [{ key: 'captions', label: 'Descripciones (una por línea)', kind: 'lines' }],
  },
  manifesto: {
    label: 'Manifiesto de marca',
    kind: 'structural',
    fields: [
      { key: 'quote', label: 'Frase destacada', kind: 'text' },
      { key: 'body', label: 'Texto', kind: 'textarea' },
    ],
  },
  'featured-books': {
    label: 'Libros destacados',
    kind: 'structural',
    fields: [
      { key: 'eyebrow', label: 'Texto superior', kind: 'text' },
      { key: 'title', label: 'Título', kind: 'text' },
      { key: 'description', label: 'Descripción', kind: 'textarea' },
      { key: '__note', label: '', kind: 'note', hint: 'Los libros que aparecen abajo se toman automáticamente de "Todos los libros".' },
    ],
  },
  'collection-teaser': {
    label: 'Colección destacada',
    kind: 'structural',
    fields: [
      { key: 'eyebrow', label: 'Texto superior', kind: 'text' },
      { key: 'title', label: 'Título', kind: 'text' },
      { key: 'description', label: 'Descripción', kind: 'textarea' },
      { key: 'ctaLabel', label: 'Botón — texto', kind: 'text' },
      { key: 'ctaTo', label: 'Botón — enlace', kind: 'text' },
      { key: 'imageCaption', label: 'Descripción de la imagen', kind: 'text' },
      {
        key: 'accent',
        label: 'Color de acento',
        kind: 'select',
        options: [
          { value: 'sky', label: 'Celeste' },
          { value: 'amber', label: 'Ámbar' },
        ],
      },
      { key: 'reverse', label: 'Imagen a la izquierda', kind: 'checkbox' },
    ],
  },
  about: {
    label: 'Sobre el proyecto',
    kind: 'structural',
    fields: [
      { key: 'eyebrow', label: 'Texto superior', kind: 'text' },
      { key: 'title', label: 'Título', kind: 'text' },
      { key: 'bio', label: 'Biografía', kind: 'textarea' },
      { key: 'imageCaption', label: 'Descripción de la imagen', kind: 'text' },
    ],
  },
  newsletter: {
    label: 'Newsletter',
    kind: 'structural',
    fields: [
      { key: 'title', label: 'Título', kind: 'text' },
      { key: 'subtitle', label: 'Subtítulo', kind: 'textarea' },
      { key: 'buttonLabel', label: 'Botón — texto', kind: 'text' },
      { key: 'confirmationText', label: 'Mensaje de confirmación', kind: 'text' },
      { key: 'fineprint', label: 'Texto legal', kind: 'text' },
    ],
  },
  title: {
    label: 'Título',
    kind: 'generic',
    fields: [{ key: 'text', label: 'Texto', kind: 'text' }],
  },
  text: {
    label: 'Texto',
    kind: 'generic',
    fields: [{ key: 'text', label: 'Texto', kind: 'textarea' }],
  },
  image: {
    label: 'Imagen',
    kind: 'generic',
    fields: [{ key: 'caption', label: 'Descripción de la imagen', kind: 'text' }],
  },
  quote: {
    label: 'Cita',
    kind: 'generic',
    fields: [{ key: 'text', label: 'Texto de la cita', kind: 'textarea' }],
  },
  divider: {
    label: 'Separador',
    kind: 'generic',
    fields: [],
  },
  spacer: {
    label: 'Espaciador',
    kind: 'generic',
    fields: [
      {
        key: 'height',
        label: 'Altura',
        kind: 'select',
        options: [
          { value: 'sm', label: 'Pequeño' },
          { value: 'md', label: 'Mediano' },
          { value: 'lg', label: 'Grande' },
        ],
      },
    ],
  },
};

/** The palette on the left — only the generic blocks; the 8 structural
 * sections already exist on the page and are reordered/edited in place,
 * not "added" (mirrors how the real Home layout works). */
export const ADDABLE_BLOCK_TYPES = ['title', 'text', 'image', 'quote', 'divider', 'spacer'] as const;

export function defaultPropsFor(type: string): Record<string, unknown> {
  switch (type) {
    case 'title':
      return { text: 'Nuevo título' };
    case 'text':
      return { text: 'Escribí el texto de este bloque acá.' };
    case 'image':
      return { caption: 'Foto — descripción' };
    case 'quote':
      return { text: 'Una frase destacada.' };
    case 'divider':
      return {};
    case 'spacer':
      return { height: 'md' };
    default:
      return {};
  }
}
