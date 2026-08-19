import type { PageContent } from './types';

/** Home page section prop shapes — one interface per `type` in the seed
 * below. The Page Builder's Inspector (admin/pages/PageBuilderPage) reads
 * these same shapes to render its edit form, and the public Home page
 * (public-store/pages/HomePage) reads them to render each section — both
 * sides of one source of truth. */

export interface HeroProps {
  eyebrow: string;
  headingLine1: string;
  headingLine2: string;
  lede: string;
  primaryCtaLabel: string;
  primaryCtaTo: string;
  secondaryCtaLabel: string;
  secondaryCtaTo: string;
  imageCaption: string;
}

export interface GalleryProps {
  captions: string[];
}

export interface ManifestoProps {
  quote: string;
  body: string;
}

export interface FeaturedBooksProps {
  eyebrow: string;
  title: string;
  description: string;
}

export interface CollectionTeaserProps {
  eyebrow: string;
  title: string;
  description: string;
  ctaLabel: string;
  ctaTo: string;
  imageCaption: string;
  reverse: boolean;
  accent: 'sky' | 'amber';
}

export interface AboutProps {
  eyebrow: string;
  title: string;
  bio: string;
  imageCaption: string;
}

export interface NewsletterProps {
  title: string;
  subtitle: string;
  buttonLabel: string;
  confirmationText: string;
  fineprint: string;
}

/** Simple, generic blocks an admin can add freely (Task #20's block palette). */
export interface TitleBlockProps {
  text: string;
}
export interface TextBlockProps {
  text: string;
}
export interface ImageBlockProps {
  caption: string;
}
export interface QuoteBlockProps {
  text: string;
}
export type DividerBlockProps = Record<string, never>;
export interface SpacerBlockProps {
  height: 'sm' | 'md' | 'lg';
}

export const HOME_SECTION_TYPES = [
  'hero',
  'gallery',
  'manifesto',
  'featured-books',
  'collection-teaser',
  'about',
  'newsletter',
  'title',
  'text',
  'image',
  'quote',
  'divider',
  'spacer',
] as const;

/** Today's real Home copy, seeded into the store on first load — mirrors
 * what was previously hardcoded across Hero.tsx/Gallery.tsx/etc. */
export function buildHomeSeedContent(): PageContent {
  return {
    schemaVersion: 1,
    sections: [
      {
        id: 'hero',
        type: 'hero',
        props: {
          eyebrow: 'Escritura · Reflexión · Herramientas personales',
          headingLine1: 'Nuestra',
          headingLine2: 'medicina personal',
          lede: 'Un espacio para escribir, mirar hacia adentro y encontrarnos con nuestras propias herramientas.',
          primaryCtaLabel: 'Explorar los libros',
          primaryCtaTo: '/libros',
          secondaryCtaLabel: 'Conocer el proyecto →',
          secondaryCtaTo: '#sobre-el-proyecto',
          imageCaption: 'Foto — amanecer sobre paisaje natural',
        } satisfies HeroProps,
      },
      {
        id: 'galeria',
        type: 'gallery',
        props: {
          captions: [
            'Naturaleza en calma',
            'El amanecer',
            'Cielo estrellado',
            'Una tarde en el pasto',
            'Gratitud en la mesa',
            'Asombro frente a lo vivo',
          ],
        } satisfies GalleryProps,
      },
      {
        id: 'manifiesto',
        type: 'manifesto',
        props: {
          quote: 'Hay historias que también nos ayudan a mirarnos.',
          body: 'Nuestra Medicina Personal reúne escritura, reflexión y herramientas para acompañar procesos de exploración personal y educativa.',
        } satisfies ManifestoProps,
      },
      {
        id: 'libros',
        type: 'featured-books',
        props: {
          eyebrow: 'Colección',
          title: 'Libros destacados',
          description: 'Escritura y educación para acompañar tus propios procesos.',
        } satisfies FeaturedBooksProps,
      },
      {
        id: 'meditaciones',
        type: 'collection-teaser',
        props: {
          eyebrow: 'Colección',
          title: 'Meditaciones',
          description: 'Prácticas breves para volver a habitar el cuerpo y la respiración.',
          ctaLabel: 'Explorar meditaciones',
          ctaTo: '/meditaciones',
          imageCaption: 'Colección — Meditaciones',
          reverse: false,
          accent: 'sky',
        } satisfies CollectionTeaserProps,
      },
      {
        id: 'herramientas',
        type: 'collection-teaser',
        props: {
          eyebrow: 'Colección',
          title: 'Caja de herramientas personales',
          description: 'Recursos simples para sostener la escritura y la reflexión en el día a día.',
          ctaLabel: 'Explorar herramientas',
          ctaTo: '/herramientas',
          imageCaption: 'Colección — Caja de herramientas personales',
          reverse: true,
          accent: 'amber',
        } satisfies CollectionTeaserProps,
      },
      {
        id: 'about',
        type: 'about',
        props: {
          eyebrow: 'Sobre el proyecto',
          title: 'Quién escribe estas páginas',
          bio: 'Nombre del autor/a — breve biografía editable sobre su recorrido en la escritura, la educación y el acompañamiento de procesos personales.',
          imageCaption: 'Foto — retrato del autor/a',
        } satisfies AboutProps,
      },
      {
        id: 'newsletter',
        type: 'newsletter',
        props: {
          title: 'Recibí nuestras novedades',
          subtitle: 'Nuevos libros, meditaciones y contenidos directamente en tu correo.',
          buttonLabel: 'Quiero recibir novedades',
          confirmationText: 'Gracias — ya estás suscripto/a. Podés darte de baja cuando quieras.',
          fineprint: 'Podés darte de baja cuando quieras. Nunca compartimos tu correo.',
        } satisfies NewsletterProps,
      },
    ],
  };
}
