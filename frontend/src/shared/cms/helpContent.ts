import type { PageContent } from './types';

/**
 * Content for the three "Ayuda" footer pages (Contacto, Soporte,
 * Preguntas frecuentes) — simple, single-section pages edited from a
 * dedicated admin form each, same content-store wiring as everything
 * else in `shared/cms`.
 */
const SUPPORT_EMAIL = 'soporte@nuestramedicinapersonal.com';

export const CONTACTO_SLUG = 'contacto';
export const SOPORTE_SLUG = 'soporte';
export const FAQ_SLUG = 'preguntas-frecuentes';

export const CONTACTO_SECTION_TYPE = 'contacto';
export const SOPORTE_SECTION_TYPE = 'soporte';
export const FAQ_SECTION_TYPE = 'faq';

export interface ContactMethod {
  id: string;
  label: string;
  value: string;
  href: string;
}

export interface ContactoProps {
  title: string;
  intro: string;
  methods: ContactMethod[];
}

export interface SupportTopic {
  id: string;
  title: string;
  description: string;
}

export interface SoporteProps {
  title: string;
  intro: string;
  topics: SupportTopic[];
}

export interface FaqItem {
  id: string;
  q: string;
  a: string;
}

export interface FaqPageProps {
  title: string;
  intro: string;
  faqs: FaqItem[];
}

function wrap<T extends object>(type: string, props: T): PageContent {
  return { schemaVersion: 1, sections: [{ id: type, type, props: props as unknown as Record<string, unknown> }] };
}

export function buildContactoSeedContent(): PageContent {
  return wrap<ContactoProps>(CONTACTO_SECTION_TYPE, {
    title: 'Contacto',
    intro: '¿Tenés una consulta sobre un libro, tu cuenta o cualquier otra cosa? Escribinos y te respondemos a la brevedad.',
    methods: [
      { id: 'email', label: 'Correo', value: SUPPORT_EMAIL, href: `mailto:${SUPPORT_EMAIL}` },
    ],
  });
}

export function buildSoporteSeedContent(): PageContent {
  return wrap<SoporteProps>(SOPORTE_SECTION_TYPE, {
    title: 'Soporte',
    intro: 'Te ayudamos con cualquier problema relacionado a tu cuenta, tus compras o los archivos de tus libros.',
    topics: [
      {
        id: 't1',
        title: 'Acceso a tu cuenta',
        description: 'Problemas para iniciar sesión con Google o para entrar a tu biblioteca.',
      },
      {
        id: 't2',
        title: 'Pagos y compras',
        description: 'Consultas sobre el estado de un pago, comprobantes o reembolsos.',
      },
      {
        id: 't3',
        title: 'Problemas con los archivos',
        description: 'Si un libro no se descarga o el archivo no abre correctamente en tu dispositivo.',
      },
    ],
  });
}

export function buildFaqSeedContent(): PageContent {
  return wrap<FaqPageProps>(FAQ_SECTION_TYPE, {
    title: 'Preguntas frecuentes',
    intro: 'Las dudas más comunes sobre libros, compras y tu cuenta.',
    faqs: [
      {
        id: 'f1',
        q: '¿En qué formato recibo los libros?',
        a: 'Todos los libros están disponibles en PDF y EPUB, así podés elegir el formato que prefieras para tu dispositivo.',
      },
      {
        id: 'f2',
        q: '¿Cómo accedo a mis libros después de comprarlos?',
        a: 'Todos tus libros quedan disponibles en "Mi biblioteca" apenas Mercado Pago confirma el pago.',
      },
      {
        id: 'f3',
        q: '¿Puedo pedir un reembolso?',
        a: 'Sí, dentro de los 10 días de la compra y siempre que no hayas descargado el libro. Escribinos a soporte@nuestramedicinapersonal.com.',
      },
      {
        id: 'f4',
        q: '¿Necesito una cuenta para comprar?',
        a: 'Sí, iniciás sesión con tu cuenta de Google para poder acceder a tus compras desde cualquier dispositivo.',
      },
    ],
  });
}

export function readContactoProps(content: PageContent): ContactoProps {
  const section = content.sections.find((s) => s.type === CONTACTO_SECTION_TYPE);
  return (section?.props as unknown as ContactoProps) ?? { title: '', intro: '', methods: [] };
}

export function readSoporteProps(content: PageContent): SoporteProps {
  const section = content.sections.find((s) => s.type === SOPORTE_SECTION_TYPE);
  return (section?.props as unknown as SoporteProps) ?? { title: '', intro: '', topics: [] };
}

export function readFaqProps(content: PageContent): FaqPageProps {
  const section = content.sections.find((s) => s.type === FAQ_SECTION_TYPE);
  return (section?.props as unknown as FaqPageProps) ?? { title: '', intro: '', faqs: [] };
}
