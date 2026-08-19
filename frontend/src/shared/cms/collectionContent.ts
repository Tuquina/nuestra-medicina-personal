import type { PageContent } from './types';

/**
 * Content for the two "coming soon" collection pages (Meditaciones,
 * Herramientas — see `public-store/components/ComingSoonCollectionPage`).
 * Each is a single section: hero copy + an ordered list of preview
 * cards. Simpler than Home's section list on purpose — these pages don't
 * have swappable blocks, just a hero and N cards — which is also why
 * their admin editor is a small dedicated form rather than the Page
 * Builder (see admin/pages/CollectionPageEditor).
 */
export const COLLECTION_SECTION_TYPE = 'collection';

export interface CollectionCard {
  id: string;
  title: string;
  description: string;
  imageCaption: string;
}

export interface CollectionPageProps {
  title: string;
  description: string;
  cards: CollectionCard[];
}

export const MEDITACIONES_SLUG = 'meditaciones';
export const HERRAMIENTAS_SLUG = 'herramientas';

function wrap(props: CollectionPageProps): PageContent {
  return {
    schemaVersion: 1,
    sections: [{ id: 'collection', type: COLLECTION_SECTION_TYPE, props: props as unknown as Record<string, unknown> }],
  };
}

/** Today's real Meditaciones copy, seeded on first load. */
export function buildMeditacionesSeedContent(): PageContent {
  return wrap({
    title: 'Meditaciones',
    description: 'Prácticas breves para volver a habitar el cuerpo y la respiración.',
    cards: [
      {
        id: 'card-1',
        title: 'Respirar y empezar',
        description: 'Una práctica breve para empezar el día con más calma.',
        imageCaption: 'Foto — amanecer en calma',
      },
      {
        id: 'card-2',
        title: 'Volver al cuerpo',
        description: 'Un ejercicio simple de atención para momentos de tensión.',
        imageCaption: 'Foto — manos y luz cálida',
      },
      {
        id: 'card-3',
        title: 'Antes de dormir',
        description: 'Una pausa para soltar el día antes de descansar.',
        imageCaption: 'Foto — cielo nocturno',
      },
    ],
  });
}

/** Today's real Herramientas copy, seeded on first load. */
export function buildHerramientasSeedContent(): PageContent {
  return wrap({
    title: 'Caja de herramientas personales',
    description: 'Recursos simples para sostener la escritura y la reflexión en el día a día.',
    cards: [
      {
        id: 'card-1',
        title: 'Registro de escritura diaria',
        description: 'Una plantilla simple para escribir unos minutos cada día.',
        imageCaption: 'Foto — cuaderno abierto',
      },
      {
        id: 'card-2',
        title: 'Preguntas para reflexionar',
        description: 'Un set de preguntas para volver sobre la propia semana.',
        imageCaption: 'Foto — ventana y luz suave',
      },
      {
        id: 'card-3',
        title: 'Ritual de cierre semanal',
        description: 'Un pequeño ritual para cerrar la semana con más calma.',
        imageCaption: 'Foto — atardecer cálido',
      },
    ],
  });
}

export function readCollectionProps(content: PageContent): CollectionPageProps {
  const section = content.sections.find((s) => s.type === COLLECTION_SECTION_TYPE);
  return (section?.props as unknown as CollectionPageProps) ?? { title: '', description: '', cards: [] };
}
