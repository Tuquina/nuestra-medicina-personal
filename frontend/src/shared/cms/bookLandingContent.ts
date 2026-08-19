import type { PageContent } from './types';
import { BOOK_LANDINGS, type BookLanding } from '../../public-store/data/bookLandings';

/**
 * A book's landing page is intentionally *not* a free-form block list like
 * Home — it's one fixed, richly-structured section (matches how the user
 * asked for this editor: "más completo y más simple de usar" than the
 * generic Page Builder). It still fits the same `{schemaVersion, sections}`
 * envelope as Home and the real backend schema: exactly one section of
 * type `book-landing`, whose `props` is the full landing content.
 */
export type BookLandingProps = Omit<BookLanding, 'slug'>;

export const BOOK_LANDING_SECTION_TYPE = 'book-landing';

/** Seeds a book's landing content from today's hardcoded `BOOK_LANDINGS`
 * data when one exists, otherwise from sensible blank defaults so any book
 * — including ones created after this feature shipped — gets a working
 * editor immediately. */
export function buildBookLandingSeedContent(slug: string): PageContent {
  const existing = BOOK_LANDINGS[slug];
  const props: BookLandingProps = existing
    ? { ...existing }
    : {
        taglineColor: 'var(--color-accent-gold-dark)',
        heroGlowColor: 'var(--color-accent-amber-soft)',
        authorName: 'Nombre del autor/a',
        tagline: '',
        heroDescription: '',
        synopsisEyebrowColor: 'var(--color-accent-gold)',
        synopsisParagraphs: [''],
        middleSection: {
          type: 'image-text',
          heading: '',
          text: '',
          imageAccent: 'var(--color-sky-pale)',
          imageCaption: 'Foto — portada del libro',
        },
        quote: '',
        quoteGlowSide: 'left',
        publicationDate: '',
        isbn: '',
        fileSize: '',
        relatedSlug: '',
        ctaGlowSide: 'right',
      };

  return {
    schemaVersion: 1,
    sections: [{ id: 'book-landing', type: BOOK_LANDING_SECTION_TYPE, props }],
  };
}

export function readBookLandingProps(content: PageContent): BookLandingProps {
  const section = content.sections.find((s) => s.type === BOOK_LANDING_SECTION_TYPE);
  return (section?.props as BookLandingProps) ?? (buildBookLandingSeedContent('').sections[0].props as BookLandingProps);
}
