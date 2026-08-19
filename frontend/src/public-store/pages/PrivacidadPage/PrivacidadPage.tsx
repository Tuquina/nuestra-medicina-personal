import { useDocumentTitle } from '../../../shared/hooks/useDocumentTitle';
import {
  LegalPage,
  LegalSection,
  LegalParagraph,
  LegalList,
  LegalNote,
  LegalLink,
} from '../../../shared/components/LegalPage/LegalPage';

const SUPPORT_EMAIL = 'soporte@nuestramedicinapersonal.com';

const SECTIONS = [
  { id: 'responsable', title: '1. Responsable del tratamiento' },
  { id: 'datos-recopilados', title: '2. Qué datos recopilamos' },
  { id: 'finalidad', title: '3. Para qué usamos tus datos' },
  { id: 'base-legal', title: '4. Base legal del tratamiento' },
  { id: 'con-quien-compartimos', title: '5. Con quién compartimos tus datos' },
  { id: 'cookies', title: '6. Cookies y tecnologías similares' },
  { id: 'conservacion', title: '7. Conservación de los datos' },
  { id: 'derechos', title: '8. Tus derechos' },
  { id: 'seguridad', title: '9. Seguridad de los datos' },
  { id: 'menores', title: '10. Menores de edad' },
  { id: 'transferencias', title: '11. Transferencias internacionales' },
  { id: 'cambios', title: '12. Cambios a esta política' },
  { id: 'contacto', title: '13. Contacto' },
];

/**
 * `/privacidad` — Política de Privacidad. No `.dc.html` mockup exists
 * for this (see LegalPage.tsx's doc comment). Written around Ley 25.326
 * de Protección de Datos Personales (Argentina) and its enforcement
 * authority, la Agencia de Acceso a la Información Pública (AAIP) — the
 * successor of the old DNPDP. Same caveat as Términos: a starting point,
 * not a substitute for review by an abogado, and the site owner's real
 * identity/registration details are marked rather than invented.
 */
export function PrivacidadPage() {
  useDocumentTitle('Política de Privacidad · Nuestra Medicina Personal');

  return (
    <LegalPage
      eyebrow="Legal"
      title="Política de Privacidad"
      updatedLabel="Última actualización: 19 de agosto de 2026"
      sections={SECTIONS}
    >
      <LegalNote>
        Este texto es un punto de partida redactado con la Ley 25.326 de Protección de Datos Personales como
        referencia. No reemplaza el asesoramiento de un/a abogado/a: antes de operar con usuarios reales, convendría
        que lo revise un profesional, que se confirme si corresponde inscribir la base de datos ante la AAIP
        (Agencia de Acceso a la Información Pública, art. 21 de la Ley 25.326), y que se complete lo marcado como{' '}
        <strong>[a completar]</strong>.
      </LegalNote>

      <LegalSection id="responsable" title="1. Responsable del tratamiento">
        <LegalNote>
          [A completar] Razón social / nombre y apellido del/de la titular, CUIT/CUIL y domicilio legal en
          Argentina, responsables del tratamiento de los datos descriptos en esta política.
        </LegalNote>
        <LegalParagraph>
          A los efectos de esta política, "nosotros" se refiere a quien opera Nuestra Medicina Personal. Podés
          contactarnos por correo electrónico a <LegalLink href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</LegalLink> para
          cualquier consulta sobre el tratamiento de tus datos personales.
        </LegalParagraph>
      </LegalSection>

      <LegalSection id="datos-recopilados" title="2. Qué datos recopilamos">
        <LegalParagraph>Recopilamos los siguientes datos personales:</LegalParagraph>
        <LegalList
          items={[
            'Datos de identificación y contacto: nombre, dirección de correo electrónico y foto de perfil, que recibimos de Google cuando iniciás sesión con tu cuenta de Google.',
            'Datos de compra: los libros adquiridos, fechas de compra y el identificador de la operación en Mercado Pago. No accedemos ni almacenamos los datos de tu tarjeta u otro medio de pago — eso lo procesa Mercado Pago directamente.',
            'Datos de suscripción: tu correo electrónico, si te suscribís voluntariamente al newsletter de novedades.',
            'Datos de uso: información técnica básica sobre cómo usás el Sitio (por ejemplo, páginas visitadas), que puede recopilarse a través de cookies (ver sección 6).',
          ]}
        />
      </LegalSection>

      <LegalSection id="finalidad" title="3. Para qué usamos tus datos">
        <LegalList
          items={[
            'Crear y gestionar tu cuenta, y darte acceso a tu biblioteca digital.',
            'Procesar tus compras y coordinarlas con Mercado Pago.',
            'Enviarte comunicaciones vinculadas a tu cuenta y a tus compras (por ejemplo, confirmaciones de pago).',
            'Enviarte novedades por correo, únicamente si te suscribiste voluntariamente al newsletter — podés darte de baja en cualquier momento.',
            'Responder tus consultas cuando nos escribís.',
            'Mejorar el Sitio y prevenir usos fraudulentos o abusivos.',
          ]}
        />
      </LegalSection>

      <LegalSection id="base-legal" title="4. Base legal del tratamiento">
        <LegalParagraph>
          Tratamos tus datos personales sobre la base de: (a) la ejecución del contrato que se genera cuando creás
          una cuenta o comprás un libro; (b) tu consentimiento, por ejemplo al suscribirte al newsletter; y (c)
          nuestro interés legítimo en mantener la seguridad del Sitio y prevenir fraudes, siempre que ese interés no
          prevalezca sobre tus derechos.
        </LegalParagraph>
      </LegalSection>

      <LegalSection id="con-quien-compartimos" title="5. Con quién compartimos tus datos">
        <LegalParagraph>
          No vendemos tus datos personales. Los compartimos únicamente con los proveedores que necesitamos para
          operar el Sitio, que actúan como encargados del tratamiento o bajo sus propias políticas de privacidad:
        </LegalParagraph>
        <LegalList
          items={[
            'Google — para el inicio de sesión (autenticación) de tu cuenta.',
            'Mercado Pago — para procesar los pagos de tus compras.',
            'Proveedores de infraestructura y correo electrónico que usamos para alojar el Sitio y enviar comunicaciones transaccionales o el newsletter.',
          ]}
        />
        <LegalParagraph>
          Podríamos también divulgar datos si así lo exige la ley, una orden judicial o una autoridad competente.
        </LegalParagraph>
      </LegalSection>

      <LegalSection id="cookies" title="6. Cookies y tecnologías similares">
        <LegalParagraph>
          Usamos cookies esenciales para mantener tu sesión iniciada y para que el Sitio funcione correctamente.
          También podemos usar cookies analíticas para entender cómo se usa el Sitio y mejorarlo. Podés gestionar o
          bloquear las cookies desde la configuración de tu navegador, aunque esto podría afectar el funcionamiento
          de algunas partes del Sitio, como mantener tu sesión iniciada.
        </LegalParagraph>
      </LegalSection>

      <LegalSection id="conservacion" title="7. Conservación de los datos">
        <LegalParagraph>
          Conservamos tus datos mientras tu cuenta esté activa y durante el plazo adicional necesario para cumplir
          obligaciones legales, contables o fiscales, o para resolver eventuales reclamos. Si eliminás tu cuenta,
          podemos conservar cierta información sobre tus compras cuando la normativa aplicable así lo requiera.
        </LegalParagraph>
      </LegalSection>

      <LegalSection id="derechos" title="8. Tus derechos">
        <LegalParagraph>
          De acuerdo con la Ley 25.326, tenés derecho a acceder a tus datos personales, y a solicitar su
          rectificación, actualización o supresión cuando corresponda. También podés retirar tu consentimiento para
          recibir el newsletter en cualquier momento, sin que eso afecte tu cuenta ni tus compras.
        </LegalParagraph>
        <LegalParagraph>
          Para ejercer estos derechos, escribinos a{' '}
          <LegalLink href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</LegalLink>. Vamos a responder tu solicitud
          dentro de los plazos que establece la normativa vigente.
        </LegalParagraph>
        <LegalParagraph>
          La Agencia de Acceso a la Información Pública (AAIP), órgano de control de la Ley 25.326, es la autoridad
          de aplicación en materia de protección de datos personales en Argentina. Tenés derecho a presentar una
          denuncia ante la AAIP si considerás que no respetamos tus derechos.
        </LegalParagraph>
      </LegalSection>

      <LegalSection id="seguridad" title="9. Seguridad de los datos">
        <LegalParagraph>
          Aplicamos medidas técnicas y organizativas razonables para proteger tus datos personales contra el acceso
          no autorizado, la pérdida o la alteración. Ningún sistema es completamente infalible, pero trabajamos para
          mantener estas medidas actualizadas.
        </LegalParagraph>
      </LegalSection>

      <LegalSection id="menores" title="10. Menores de edad">
        <LegalParagraph>
          El Sitio no está dirigido específicamente a niños, niñas y adolescentes. Si sos menor de edad, debés usar
          el Sitio bajo la supervisión de tu madre, padre o tutor/a legal.
        </LegalParagraph>
      </LegalSection>

      <LegalSection id="transferencias" title="11. Transferencias internacionales">
        <LegalParagraph>
          Algunos de nuestros proveedores (por ejemplo, Google) pueden procesar datos en servidores ubicados fuera
          de la Argentina. En esos casos, procuramos que el proveedor ofrezca garantías adecuadas de protección de
          datos, conforme a los estándares de la Ley 25.326 para transferencias internacionales.
        </LegalParagraph>
      </LegalSection>

      <LegalSection id="cambios" title="12. Cambios a esta política">
        <LegalParagraph>
          Podemos actualizar esta política para reflejar cambios en el Servicio o en la normativa aplicable. Vamos a
          publicar la fecha de la última actualización al inicio de esta página, y te avisaremos por correo
          electrónico o mediante un aviso en el Sitio si los cambios son significativos.
        </LegalParagraph>
      </LegalSection>

      <LegalSection id="contacto" title="13. Contacto">
        <LegalParagraph>
          Para consultas sobre esta política o para ejercer tus derechos sobre tus datos personales, escribinos a{' '}
          <LegalLink href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</LegalLink>.
        </LegalParagraph>
      </LegalSection>
    </LegalPage>
  );
}
