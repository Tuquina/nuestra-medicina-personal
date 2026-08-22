/**
 * Section kinds for the manuscript editor: what a section *is* (a
 * portada, a prólogo, a capítulo, an epílogo...) as opposed to always
 * being "a chapter" — and whether its heading is the kind's own
 * auto-generated label or text the author typed themselves.
 *
 * These two fields (`kind`, `titleMode`) round-trip through the backend
 * (`manuscript.Chapter.Kind`/`.TitleMode` — see
 * backend/internal/domain/manuscript/manuscript.go) purely so the editor
 * can restore the right dropdown/toggle state after a reload; the actual
 * heading text that ends up in the exported EPUB/PDF always comes from
 * `title`, which this module resolves before every save.
 */

export type SectionKind =
  | 'COVER'
  | 'DEDICATION'
  | 'PROLOGUE'
  | 'INTRODUCTION'
  | 'CHAPTER'
  | 'EPILOGUE'
  | 'ACKNOWLEDGMENTS'
  | 'APPENDIX'
  | 'CUSTOM';

export type TitleMode = 'AUTO' | 'CUSTOM';

interface SectionKindMeta {
  kind: SectionKind;
  label: string;
  /** Short glyph shown next to the section in the sidebar list — purely decorative. */
  glyph: string;
  /** Whether this kind counts towards "Capítulo N" numbering (only CHAPTER does). */
  numbered: boolean;
  defaultTitle: (bookTitle: string, number: number) => string;
}

export const SECTION_KINDS: SectionKindMeta[] = [
  { kind: 'COVER', label: 'Portada', glyph: '▭', numbered: false, defaultTitle: (bookTitle) => bookTitle || 'Portada' },
  { kind: 'DEDICATION', label: 'Dedicatoria', glyph: '❧', numbered: false, defaultTitle: () => 'Dedicatoria' },
  { kind: 'PROLOGUE', label: 'Prólogo', glyph: '§', numbered: false, defaultTitle: () => 'Prólogo' },
  { kind: 'INTRODUCTION', label: 'Introducción', glyph: '§', numbered: false, defaultTitle: () => 'Introducción' },
  { kind: 'CHAPTER', label: 'Capítulo', glyph: '¶', numbered: true, defaultTitle: (_bookTitle, number) => `Capítulo ${number}` },
  { kind: 'EPILOGUE', label: 'Epílogo', glyph: '§', numbered: false, defaultTitle: () => 'Epílogo' },
  { kind: 'ACKNOWLEDGMENTS', label: 'Agradecimientos', glyph: '♥', numbered: false, defaultTitle: () => 'Agradecimientos' },
  { kind: 'APPENDIX', label: 'Apéndice', glyph: '≡', numbered: false, defaultTitle: () => 'Apéndice' },
  { kind: 'CUSTOM', label: 'Personalizada', glyph: '✦', numbered: false, defaultTitle: () => '' },
];

const DEFAULT_KIND: SectionKind = 'CHAPTER';

export function sectionKindMeta(kind: SectionKind | '' | undefined): SectionKindMeta {
  return SECTION_KINDS.find((entry) => entry.kind === kind) ?? sectionKindMeta(DEFAULT_KIND);
}

/** An empty/unrecognized kind (manuscripts saved before this field existed) behaves as CHAPTER. */
export function effectiveKind(kind: SectionKind | '' | undefined): SectionKind {
  return kind && SECTION_KINDS.some((entry) => entry.kind === kind) ? kind : DEFAULT_KIND;
}

export function effectiveTitleMode(mode: TitleMode | '' | undefined): TitleMode {
  return mode === 'CUSTOM' ? 'CUSTOM' : 'AUTO';
}

/**
 * The auto-generated title for the section at `index` — CHAPTER counts
 * only chapters up to and including this one (a Prólogo or a Portada
 * in between doesn't consume a chapter number).
 */
export function autoTitleFor(sections: { kind?: SectionKind }[], index: number, bookTitle: string): string {
  const kind = effectiveKind(sections[index]?.kind);
  const meta = sectionKindMeta(kind);
  if (!meta.numbered) return meta.defaultTitle(bookTitle, 0);
  let number = 0;
  for (let i = 0; i <= index; i++) {
    if (effectiveKind(sections[i]?.kind) === kind) number++;
  }
  return meta.defaultTitle(bookTitle, number);
}
