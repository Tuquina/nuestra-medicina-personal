/**
 * Per-book landing page content — everything the `/libros/{slug}`
 * mockups show beyond the catalog card (BOOKS in `books.ts`).
 *
 * The two existing landing mockups genuinely diverge in structure (one
 * has an image+text section and an FAQ accordion, the other has a
 * 3-column benefits grid and no FAQ) — see docs/frontend-plan.md. Rather
 * than force a rigid shared template, `middleSection` is a small
 * discriminated union so each book can pick the block that fits, which
 * mirrors how these will eventually be authored in the Page Builder
 * (architecture.md §10: a page is an ordered sequence of blocks).
 */
import type { Book } from './books';

interface ImageTextSection {
  type: 'image-text';
  heading: string;
  text: string;
  imageAccent: string;
  imageCaption: string;
}

interface BenefitsSection {
  type: 'benefits';
  heading: string;
  items: { title: string; description: string }[];
}

export interface BookLanding {
  slug: string;
  taglineColor: string;
  heroGlowColor: string;
  authorName: string;
  tagline: string;
  heroDescription: string;
  synopsisEyebrowColor: string;
  synopsisParagraphs: string[];
  middleSection: ImageTextSection | BenefitsSection;
  quote: string;
  quoteGlowSide: 'left' | 'right';
  publicationDate: string;
  isbn: string;
  fileSize: string;
  faqs?: { q: string; a: string }[];
  relatedSlug: string;
  ctaGlowSide: 'left' | 'right';
}

export const BOOK_LANDINGS: Record<string, BookLanding> = {
  'el-poder-de-tu-historia': {
    slug: 'el-poder-de-tu-historia',
    taglineColor: 'var(--color-accent-gold-dark)',
    heroGlowColor: 'var(--color-accent-amber-soft)',
    authorName: 'Nombre del autor/a',
    tagline: 'Escribir para mirar hacia adentro y reconocer tu propia historia.',
    heroDescription:
      'Un recorrido íntimo por la escritura como herramienta de autoconocimiento, pensado para quienes quieren empezar a poner en palabras su propio proceso.',
    synopsisEyebrowColor: 'var(--color-accent-gold)',
    synopsisParagraphs: [
      'Este libro propone un recorrido de escritura personal en el que cada capítulo funciona como una invitación a observar la propia historia desde otro lugar: con más calma, más curiosidad y menos juicio.',
      'No es un manual con respuestas cerradas, sino un espacio para escribir, tachar, volver a empezar y encontrar, poco a poco, una voz propia.',
    ],
    middleSection: {
      type: 'image-text',
      heading: 'Un cuaderno, una pregunta por día',
      text: 'Cada sección combina una breve reflexión con ejercicios de escritura simples, pensados para sostenerse en el tiempo sin exigir demasiado.',
      imageAccent: 'var(--color-sky-pale)',
      imageCaption: 'Foto — cuaderno y luz natural',
    },
    quote: '"Escribir no cambia lo que pasó, pero cambia el lugar desde el que lo miramos."',
    quoteGlowSide: 'left',
    publicationDate: 'Marzo 2026',
    isbn: '978-0-00-000000-0 (demo)',
    fileSize: '2,4 MB',
    faqs: [
      {
        q: '¿En qué formato recibo el libro?',
        a: 'El libro está disponible en PDF y EPUB. Podés descargarlo desde tu biblioteca después de la compra.',
      },
      {
        q: '¿Puedo leerlo en cualquier dispositivo?',
        a: 'Sí, los formatos PDF y EPUB son compatibles con la mayoría de lectores, tablets y celulares.',
      },
      {
        q: '¿Qué pasa si tengo un problema con el pago?',
        a: 'Podés volver a intentarlo desde esta misma página. Si el problema persiste, escribinos a soporte@nuestramedicinapersonal.com.',
      },
      {
        q: '¿El libro reemplaza un proceso terapéutico?',
        a: 'No. Es una herramienta de escritura y reflexión, pensada como complemento y no como sustituto de la atención médica o psicológica profesional.',
      },
    ],
    relatedSlug: 'la-escritura-terapeutica-entra-a-la-escuela',
    ctaGlowSide: 'right',
  },

  'la-escritura-terapeutica-entra-a-la-escuela': {
    slug: 'la-escritura-terapeutica-entra-a-la-escuela',
    taglineColor: 'oklch(40% 0.07 235)',
    heroGlowColor: 'var(--color-sky)',
    authorName: 'Nombre del autor/a',
    tagline: 'Una guía para llevar la escritura reflexiva al aula.',
    heroDescription:
      'Pensado para docentes que buscan herramientas simples y concretas para acompañar a sus estudiantes a través de la escritura.',
    synopsisEyebrowColor: 'var(--color-deep-blue)',
    synopsisParagraphs: [
      'Este libro reúne actividades de escritura reflexiva pensadas para el aula, junto con una introducción para docentes sobre cómo sostener estos espacios sin necesidad de formación clínica.',
      'Cada propuesta puede adaptarse a distintas edades y contextos educativos, priorizando siempre un clima de respeto y cuidado.',
    ],
    middleSection: {
      type: 'benefits',
      heading: 'Qué vas a encontrar',
      items: [
        {
          title: 'Actividades listas para usar',
          description: 'Consignas de escritura organizadas por edad y momento del año.',
        },
        {
          title: 'Guía para el aula',
          description: 'Orientaciones para sostener el espacio de escritura con cuidado.',
        },
        {
          title: 'Recursos descargables',
          description: 'Plantillas imprimibles listas para llevar a clase.',
        },
      ],
    },
    quote: '"Un aula que escribe también es un aula que escucha."',
    quoteGlowSide: 'right',
    publicationDate: 'Mayo 2026',
    isbn: '978-0-00-000001-0 (demo)',
    fileSize: '3,1 MB',
    relatedSlug: 'el-poder-de-tu-historia',
    ctaGlowSide: 'left',
  },
};

export function getBookBySlug(books: Book[], slug: string | undefined): Book | undefined {
  return books.find((book) => book.slug === slug);
}
