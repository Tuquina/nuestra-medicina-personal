import type { PageContent } from './types';

/**
 * Content model for the two long legal documents (Términos, Privacidad)
 * — each is a hero (title + "last updated" line + an intro note) plus an
 * ordered list of numbered sections. A section's `body` is plain text in
 * a small markdown-lite dialect rather than raw HTML/JSX, so it's safe to
 * edit from a plain `<textarea>` in the admin (see
 * admin/pages/LegalDocEditorPage) without needing a rich-text editor:
 *
 * - Blank lines separate blocks (paragraphs).
 * - A block where every line starts with `- ` renders as a bullet list.
 * - A block whose first line starts with `> ` renders as a highlighted
 *   note (matches `LegalNote` — used for the "[a completar]" callouts).
 * - `**text**` renders bold; a bare email address auto-links to `mailto:`.
 */
export const LEGAL_DOC_SECTION_TYPE = 'legal-doc';

export interface LegalDocSection {
  id: string;
  title: string;
  body: string;
}

export interface LegalDocProps {
  title: string;
  updatedLabel: string;
  introNote: string;
  sections: LegalDocSection[];
}

export const TERMINOS_SLUG = 'terminos';
export const PRIVACIDAD_SLUG = 'privacidad';

const SUPPORT_EMAIL = 'soporte@nuestramedicinapersonal.com';

function wrap(props: LegalDocProps): PageContent {
  return {
    schemaVersion: 1,
    sections: [{ id: 'doc', type: LEGAL_DOC_SECTION_TYPE, props: props as unknown as Record<string, unknown> }],
  };
}

export function buildTerminosSeedContent(): PageContent {
  return wrap({
    title: 'Términos y Condiciones',
    updatedLabel: 'Última actualización: 19 de agosto de 2026',
    introNote:
      'Este texto es un punto de partida redactado con la legislación argentina como referencia (Ley 24.240 de Defensa del Consumidor, Ley 11.723 de Propiedad Intelectual, Código Civil y Comercial de la Nación). No reemplaza el asesoramiento de un/a abogado/a: antes de operar con usuarios reales, convendría que lo revise un profesional y complete los datos marcados como **[a completar]**.',
    sections: [
      {
        id: 'aceptacion',
        title: '1. Aceptación de estos Términos',
        body: 'Estos Términos y Condiciones ("Términos") regulan el acceso y uso del sitio Nuestra Medicina Personal (el "Sitio") y la compra de los libros digitales y demás contenidos que se ofrecen en él (el "Servicio"). Al crear una cuenta, iniciar sesión o realizar una compra, aceptás estos Términos en su totalidad. Si no estás de acuerdo, te pedimos que no uses el Sitio.\n\nEl Servicio está dirigido a personas mayores de edad según la legislación argentina, o a menores de edad bajo la supervisión de su madre, padre o tutor/a legal.',
      },
      {
        id: 'quienes-somos',
        title: '2. Quiénes somos',
        body: '> [A completar] Razón social / nombre y apellido del/de la titular, CUIT/CUIL, domicilio legal en Argentina. Este dato es obligatorio para operar comercialmente y debe figurar en el Sitio (Ley 24.240, art. 4, y Resolución 424/2020 sobre comercio electrónico).\n\nNuestra Medicina Personal es el nombre comercial bajo el cual se ofrece el Servicio. Podés contactarnos por correo electrónico a soporte@nuestramedicinapersonal.com.',
      },
      {
        id: 'servicio',
        title: '3. Descripción del servicio',
        body: 'A través del Sitio ofrecemos libros digitales (en formato PDF y/o EPUB) sobre escritura, reflexión y herramientas personales, y ponemos a disposición secciones de meditaciones y herramientas cuyo contenido se irá ampliando con el tiempo. Los libros comprados quedan disponibles en tu biblioteca digital ("Mi biblioteca") mientras tu cuenta permanezca activa.\n\nNos reservamos el derecho de agregar, modificar o discontinuar libros y funcionalidades del Servicio, respetando siempre el acceso a los contenidos ya comprados.',
      },
      {
        id: 'cuentas',
        title: '4. Cuentas y registro',
        body: 'Para comprar y acceder a los libros necesitás una cuenta. El registro y el inicio de sesión se realizan a través de tu cuenta de Google. Sos responsable de mantener la confidencialidad de tu cuenta de Google y de toda actividad que ocurra bajo tu cuenta en el Sitio.\n\nDebés proporcionar información veraz y mantenerla actualizada. Podemos suspender o cancelar cuentas que incumplan estos Términos, incluyendo un uso fraudulento o abusivo del Servicio.',
      },
      {
        id: 'precios-pagos',
        title: '5. Precios y medios de pago',
        body: 'Los precios de los libros se muestran en pesos argentinos (ARS) e incluyen los impuestos que correspondan según la normativa vigente, salvo que se indique lo contrario. Los precios pueden modificarse en cualquier momento; el precio aplicable a una compra es el vigente al momento de confirmarla.\n\nLos pagos se procesan a través de Mercado Pago. No almacenamos los datos de tu tarjeta ni de otros medios de pago: esa información es gestionada directamente por Mercado Pago conforme a sus propios términos y políticas.',
      },
      {
        id: 'compra-entrega',
        title: '6. Proceso de compra y entrega',
        body: 'Al confirmar una compra, se te redirige a Mercado Pago para completar el pago. Una vez que Mercado Pago confirma la operación, el libro queda disponible de inmediato en tu biblioteca digital para su lectura y descarga. Te enviaremos también una confirmación por correo electrónico.\n\nSi el pago es rechazado o queda pendiente de acreditación, el acceso al libro se habilitará recién cuando Mercado Pago confirme el pago como aprobado.',
      },
      {
        id: 'arrepentimiento',
        title: '7. Derecho de arrepentimiento',
        body: 'De acuerdo con el artículo 34 de la Ley 24.240 de Defensa del Consumidor, en las compras a distancia tenés derecho a arrepentirte de la compra dentro de los diez (10) días corridos desde que se perfeccionó el contrato, sin costo alguno.\n\nPor tratarse de contenido digital que se entrega de forma inmediata, este derecho puede ejercerse únicamente **antes** de acceder o descargar el libro por primera vez. Una vez que accediste o descargaste el archivo, entendemos —al igual que sucede en la generalidad de las tiendas de contenido digital— que el derecho de arrepentimiento se considera ejercido con la propia descarga, dado que el servicio ya fue prestado en su totalidad. Si todavía no accediste al libro, escribinos a soporte@nuestramedicinapersonal.com dentro del plazo indicado y gestionamos el reintegro.',
      },
      {
        id: 'propiedad-intelectual',
        title: '8. Propiedad intelectual y uso permitido',
        body: 'Los libros, textos, imágenes y demás contenidos del Sitio están protegidos por la Ley 11.723 de Propiedad Intelectual y pertenecen a sus autores/as o a Nuestra Medicina Personal, según corresponda. La compra de un libro te otorga una licencia personal, intransferible y no exclusiva para leerlo en tus propios dispositivos, para tu uso privado.\n\n- No está permitido reproducir, distribuir, revender, alquilar, prestar públicamente ni poner a disposición de terceros los archivos, en todo o en parte, sin autorización previa por escrito.\n- No está permitido eliminar avisos de autoría, marcas de agua u otras indicaciones de propiedad de los archivos.\n- No está permitido usar los contenidos para entrenar modelos de inteligencia artificial ni para otros usos automatizados de extracción masiva, salvo autorización expresa.',
      },
      {
        id: 'naturaleza-contenido',
        title: '9. Naturaleza del contenido',
        body: 'Los contenidos de Nuestra Medicina Personal (libros, meditaciones, herramientas) tienen fines educativos y reflexivos. No constituyen consejo, diagnóstico ni tratamiento médico o psicológico, y no reemplazan la atención de un profesional de la salud. Si estás atravesando una situación que requiere atención profesional, te recomendamos consultar con quien corresponda.',
      },
      {
        id: 'conducta',
        title: '10. Conducta del usuario',
        body: 'Al usar el Sitio te comprometés a no:\n\n- Usar el Sitio con fines ilícitos o contrarios a estos Términos.\n- Intentar vulnerar la seguridad del Sitio o acceder a cuentas de otras personas.\n- Cargar reseñas, comentarios o contenido que sea difamatorio, discriminatorio, engañoso o que constituya spam.\n- Usar bots, scraping u otros medios automatizados para extraer contenido del Sitio sin autorización.',
      },
      {
        id: 'disponibilidad',
        title: '11. Disponibilidad del servicio',
        body: 'Hacemos esfuerzos razonables para mantener el Sitio disponible, pero no garantizamos que funcione de manera ininterrumpida o libre de errores. Podemos suspender el acceso temporalmente por tareas de mantenimiento, actualizaciones o causas fuera de nuestro control.',
      },
      {
        id: 'responsabilidad',
        title: '12. Limitación de responsabilidad',
        body: 'En la medida permitida por la ley aplicable, no somos responsables por daños indirectos derivados del uso o la imposibilidad de uso del Sitio. Nada en esta sección limita los derechos que la Ley 24.240 reconoce a los consumidores y que no pueden renunciarse por contrato.',
      },
      {
        id: 'modificaciones',
        title: '13. Modificaciones a estos Términos',
        body: 'Podemos actualizar estos Términos para reflejar cambios en el Servicio o en la normativa aplicable. Vamos a publicar la fecha de la última actualización al inicio de esta página. Si los cambios son significativos, intentaremos avisarte por correo electrónico o mediante un aviso en el Sitio. El uso continuado del Servicio después de una actualización implica la aceptación de los nuevos Términos.',
      },
      {
        id: 'ley-jurisdiccion',
        title: '14. Ley aplicable y jurisdicción',
        body: 'Estos Términos se rigen por las leyes de la República Argentina. Para cualquier controversia, y conforme al artículo 36 de la Ley 24.240, será competente el tribunal correspondiente al domicilio del/de la consumidor/a, sin perjuicio de que puedas optar por otro fuero cuando la ley te lo permita.',
      },
      {
        id: 'contacto',
        title: '15. Contacto',
        body: 'Ante cualquier consulta, reclamo o para ejercer el derecho de arrepentimiento, escribinos a soporte@nuestramedicinapersonal.com.',
      },
    ],
  });
}

export function buildPrivacidadSeedContent(): PageContent {
  return wrap({
    title: 'Política de Privacidad',
    updatedLabel: 'Última actualización: 19 de agosto de 2026',
    introNote:
      'Este texto es un punto de partida redactado con la Ley 25.326 de Protección de Datos Personales como referencia. No reemplaza el asesoramiento de un/a abogado/a: antes de operar con usuarios reales, convendría que lo revise un profesional, que se confirme si corresponde inscribir la base de datos ante la AAIP (Agencia de Acceso a la Información Pública, art. 21 de la Ley 25.326), y que se complete lo marcado como **[a completar]**.',
    sections: [
      {
        id: 'responsable',
        title: '1. Responsable del tratamiento',
        body: '> [A completar] Razón social / nombre y apellido del/de la titular, CUIT/CUIL y domicilio legal en Argentina, responsables del tratamiento de los datos descriptos en esta política.\n\nA los efectos de esta política, "nosotros" se refiere a quien opera Nuestra Medicina Personal. Podés contactarnos por correo electrónico a soporte@nuestramedicinapersonal.com para cualquier consulta sobre el tratamiento de tus datos personales.',
      },
      {
        id: 'datos-recopilados',
        title: '2. Qué datos recopilamos',
        body: 'Recopilamos los siguientes datos personales:\n\n- Datos de identificación y contacto: nombre, dirección de correo electrónico y foto de perfil, que recibimos de Google cuando iniciás sesión con tu cuenta de Google.\n- Datos de compra: los libros adquiridos, fechas de compra y el identificador de la operación en Mercado Pago. No accedemos ni almacenamos los datos de tu tarjeta u otro medio de pago — eso lo procesa Mercado Pago directamente.\n- Datos de suscripción: tu correo electrónico, si te suscribís voluntariamente al newsletter de novedades.\n- Datos de uso: información técnica básica sobre cómo usás el Sitio (por ejemplo, páginas visitadas), que puede recopilarse a través de cookies (ver sección 6).',
      },
      {
        id: 'finalidad',
        title: '3. Para qué usamos tus datos',
        body: '- Crear y gestionar tu cuenta, y darte acceso a tu biblioteca digital.\n- Procesar tus compras y coordinarlas con Mercado Pago.\n- Enviarte comunicaciones vinculadas a tu cuenta y a tus compras (por ejemplo, confirmaciones de pago).\n- Enviarte novedades por correo, únicamente si te suscribiste voluntariamente al newsletter — podés darte de baja en cualquier momento.\n- Responder tus consultas cuando nos escribís.\n- Mejorar el Sitio y prevenir usos fraudulentos o abusivos.',
      },
      {
        id: 'base-legal',
        title: '4. Base legal del tratamiento',
        body: 'Tratamos tus datos personales sobre la base de: (a) la ejecución del contrato que se genera cuando creás una cuenta o comprás un libro; (b) tu consentimiento, por ejemplo al suscribirte al newsletter; y (c) nuestro interés legítimo en mantener la seguridad del Sitio y prevenir fraudes, siempre que ese interés no prevalezca sobre tus derechos.',
      },
      {
        id: 'con-quien-compartimos',
        title: '5. Con quién compartimos tus datos',
        body: 'No vendemos tus datos personales. Los compartimos únicamente con los proveedores que necesitamos para operar el Sitio, que actúan como encargados del tratamiento o bajo sus propias políticas de privacidad:\n\n- Google — para el inicio de sesión (autenticación) de tu cuenta.\n- Mercado Pago — para procesar los pagos de tus compras.\n- Proveedores de infraestructura y correo electrónico que usamos para alojar el Sitio y enviar comunicaciones transaccionales o el newsletter.\n\nPodríamos también divulgar datos si así lo exige la ley, una orden judicial o una autoridad competente.',
      },
      {
        id: 'cookies',
        title: '6. Cookies y tecnologías similares',
        body: 'Usamos cookies esenciales para mantener tu sesión iniciada y para que el Sitio funcione correctamente. También podemos usar cookies analíticas para entender cómo se usa el Sitio y mejorarlo. Podés gestionar o bloquear las cookies desde la configuración de tu navegador, aunque esto podría afectar el funcionamiento de algunas partes del Sitio, como mantener tu sesión iniciada.',
      },
      {
        id: 'conservacion',
        title: '7. Conservación de los datos',
        body: 'Conservamos tus datos mientras tu cuenta esté activa y durante el plazo adicional necesario para cumplir obligaciones legales, contables o fiscales, o para resolver eventuales reclamos. Si eliminás tu cuenta, podemos conservar cierta información sobre tus compras cuando la normativa aplicable así lo requiera.',
      },
      {
        id: 'derechos',
        title: '8. Tus derechos',
        body: 'De acuerdo con la Ley 25.326, tenés derecho a acceder a tus datos personales, y a solicitar su rectificación, actualización o supresión cuando corresponda. También podés retirar tu consentimiento para recibir el newsletter en cualquier momento, sin que eso afecte tu cuenta ni tus compras.\n\nPara ejercer estos derechos, escribinos a soporte@nuestramedicinapersonal.com. Vamos a responder tu solicitud dentro de los plazos que establece la normativa vigente.\n\nLa Agencia de Acceso a la Información Pública (AAIP), órgano de control de la Ley 25.326, es la autoridad de aplicación en materia de protección de datos personales en Argentina. Tenés derecho a presentar una denuncia ante la AAIP si considerás que no respetamos tus derechos.',
      },
      {
        id: 'seguridad',
        title: '9. Seguridad de los datos',
        body: 'Aplicamos medidas técnicas y organizativas razonables para proteger tus datos personales contra el acceso no autorizado, la pérdida o la alteración. Ningún sistema es completamente infalible, pero trabajamos para mantener estas medidas actualizadas.',
      },
      {
        id: 'menores',
        title: '10. Menores de edad',
        body: 'El Sitio no está dirigido específicamente a niños, niñas y adolescentes. Si sos menor de edad, debés usar el Sitio bajo la supervisión de tu madre, padre o tutor/a legal.',
      },
      {
        id: 'transferencias',
        title: '11. Transferencias internacionales',
        body: 'Algunos de nuestros proveedores (por ejemplo, Google) pueden procesar datos en servidores ubicados fuera de la Argentina. En esos casos, procuramos que el proveedor ofrezca garantías adecuadas de protección de datos, conforme a los estándares de la Ley 25.326 para transferencias internacionales.',
      },
      {
        id: 'cambios',
        title: '12. Cambios a esta política',
        body: 'Podemos actualizar esta política para reflejar cambios en el Servicio o en la normativa aplicable. Vamos a publicar la fecha de la última actualización al inicio de esta página, y te avisaremos por correo electrónico o mediante un aviso en el Sitio si los cambios son significativos.',
      },
      {
        id: 'contacto',
        title: '13. Contacto',
        body: 'Para consultas sobre esta política o para ejercer tus derechos sobre tus datos personales, escribinos a soporte@nuestramedicinapersonal.com.',
      },
    ],
  });
}

export function readLegalDocProps(content: PageContent): LegalDocProps {
  const section = content.sections.find((s) => s.type === LEGAL_DOC_SECTION_TYPE);
  return (
    (section?.props as unknown as LegalDocProps) ?? {
      title: '',
      updatedLabel: '',
      introNote: '',
      sections: [],
    }
  );
}

export { SUPPORT_EMAIL };
