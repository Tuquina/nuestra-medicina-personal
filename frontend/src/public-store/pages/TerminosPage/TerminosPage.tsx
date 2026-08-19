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
  { id: 'aceptacion', title: '1. Aceptación de estos Términos' },
  { id: 'quienes-somos', title: '2. Quiénes somos' },
  { id: 'servicio', title: '3. Descripción del servicio' },
  { id: 'cuentas', title: '4. Cuentas y registro' },
  { id: 'precios-pagos', title: '5. Precios y medios de pago' },
  { id: 'compra-entrega', title: '6. Proceso de compra y entrega' },
  { id: 'arrepentimiento', title: '7. Derecho de arrepentimiento' },
  { id: 'propiedad-intelectual', title: '8. Propiedad intelectual y uso permitido' },
  { id: 'naturaleza-contenido', title: '9. Naturaleza del contenido' },
  { id: 'conducta', title: '10. Conducta del usuario' },
  { id: 'disponibilidad', title: '11. Disponibilidad del servicio' },
  { id: 'responsabilidad', title: '12. Limitación de responsabilidad' },
  { id: 'modificaciones', title: '13. Modificaciones a estos Términos' },
  { id: 'ley-jurisdiccion', title: '14. Ley aplicable y jurisdicción' },
  { id: 'contacto', title: '15. Contacto' },
];

/**
 * `/terminos` — Términos y Condiciones. No `.dc.html` mockup exists for
 * this (see LegalPage.tsx's doc comment). Written with Argentine
 * consumer-protection and e-commerce law in mind (Ley 24.240, Resolución
 * 424/2020, Ley 11.723) since the site sells to consumers in Argentina
 * via Mercado Pago — but this is a starting point, not a substitute for
 * review by an abogado before it governs real transactions. The bits
 * that need the site owner's real legal/business details are marked
 * with a highlighted note rather than invented.
 */
export function TerminosPage() {
  useDocumentTitle('Términos y Condiciones · Nuestra Medicina Personal');

  return (
    <LegalPage
      eyebrow="Legal"
      title="Términos y Condiciones"
      updatedLabel="Última actualización: 19 de agosto de 2026"
      sections={SECTIONS}
    >
      <LegalNote>
        Este texto es un punto de partida redactado con la legislación argentina como referencia (Ley 24.240 de
        Defensa del Consumidor, Ley 11.723 de Propiedad Intelectual, Código Civil y Comercial de la Nación). No
        reemplaza el asesoramiento de un/a abogado/a: antes de operar con usuarios reales, convendría que lo revise
        un profesional y complete los datos marcados como <strong>[a completar]</strong>.
      </LegalNote>

      <LegalSection id="aceptacion" title="1. Aceptación de estos Términos">
        <LegalParagraph>
          Estos Términos y Condiciones ("Términos") regulan el acceso y uso del sitio Nuestra Medicina Personal (el
          "Sitio") y la compra de los libros digitales y demás contenidos que se ofrecen en él (el "Servicio"). Al
          crear una cuenta, iniciar sesión o realizar una compra, aceptás estos Términos en su totalidad. Si no
          estás de acuerdo, te pedimos que no uses el Sitio.
        </LegalParagraph>
        <LegalParagraph>
          El Servicio está dirigido a personas mayores de edad según la legislación argentina, o a menores de edad
          bajo la supervisión de su madre, padre o tutor/a legal.
        </LegalParagraph>
      </LegalSection>

      <LegalSection id="quienes-somos" title="2. Quiénes somos">
        <LegalNote>
          [A completar] Razón social / nombre y apellido del/de la titular, CUIT/CUIL, domicilio legal en Argentina.
          Este dato es obligatorio para operar comercialmente y debe figurar en el Sitio (Ley 24.240, art. 4, y
          Resolución 424/2020 sobre comercio electrónico).
        </LegalNote>
        <LegalParagraph>
          Nuestra Medicina Personal es el nombre comercial bajo el cual se ofrece el Servicio. Podés contactarnos
          por correo electrónico a{' '}
          <LegalLink href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</LegalLink>
          .
        </LegalParagraph>
      </LegalSection>

      <LegalSection id="servicio" title="3. Descripción del servicio">
        <LegalParagraph>
          A través del Sitio ofrecemos libros digitales (en formato PDF y/o EPUB) sobre escritura, reflexión y
          herramientas personales, y ponemos a disposición secciones de meditaciones y herramientas cuyo contenido
          se irá ampliando con el tiempo. Los libros comprados quedan disponibles en tu biblioteca digital
          ("Mi biblioteca") mientras tu cuenta permanezca activa.
        </LegalParagraph>
        <LegalParagraph>
          Nos reservamos el derecho de agregar, modificar o discontinuar libros y funcionalidades del Servicio,
          respetando siempre el acceso a los contenidos ya comprados.
        </LegalParagraph>
      </LegalSection>

      <LegalSection id="cuentas" title="4. Cuentas y registro">
        <LegalParagraph>
          Para comprar y acceder a los libros necesitás una cuenta. El registro y el inicio de sesión se realizan a
          través de tu cuenta de Google. Sos responsable de mantener la confidencialidad de tu cuenta de Google y de
          toda actividad que ocurra bajo tu cuenta en el Sitio.
        </LegalParagraph>
        <LegalParagraph>
          Debés proporcionar información veraz y mantenerla actualizada. Podemos suspender o cancelar cuentas que
          incumplan estos Términos, incluyendo un uso fraudulento o abusivo del Servicio.
        </LegalParagraph>
      </LegalSection>

      <LegalSection id="precios-pagos" title="5. Precios y medios de pago">
        <LegalParagraph>
          Los precios de los libros se muestran en pesos argentinos (ARS) e incluyen los impuestos que
          correspondan según la normativa vigente, salvo que se indique lo contrario. Los precios pueden
          modificarse en cualquier momento; el precio aplicable a una compra es el vigente al momento de confirmarla.
        </LegalParagraph>
        <LegalParagraph>
          Los pagos se procesan a través de Mercado Pago. No almacenamos los datos de tu tarjeta ni de otros medios
          de pago: esa información es gestionada directamente por Mercado Pago conforme a sus propios términos y
          políticas.
        </LegalParagraph>
      </LegalSection>

      <LegalSection id="compra-entrega" title="6. Proceso de compra y entrega">
        <LegalParagraph>
          Al confirmar una compra, se te redirige a Mercado Pago para completar el pago. Una vez que Mercado Pago
          confirma la operación, el libro queda disponible de inmediato en tu biblioteca digital para su lectura y
          descarga. Te enviaremos también una confirmación por correo electrónico.
        </LegalParagraph>
        <LegalParagraph>
          Si el pago es rechazado o queda pendiente de acreditación, el acceso al libro se habilitará recién cuando
          Mercado Pago confirme el pago como aprobado.
        </LegalParagraph>
      </LegalSection>

      <LegalSection id="arrepentimiento" title="7. Derecho de arrepentimiento">
        <LegalParagraph>
          De acuerdo con el artículo 34 de la Ley 24.240 de Defensa del Consumidor, en las compras a distancia
          tenés derecho a arrepentirte de la compra dentro de los diez (10) días corridos desde que se perfeccionó
          el contrato, sin costo alguno.
        </LegalParagraph>
        <LegalParagraph>
          Por tratarse de contenido digital que se entrega de forma inmediata, este derecho puede ejercerse
          únicamente <strong>antes</strong> de acceder o descargar el libro por primera vez. Una vez que accediste o
          descargaste el archivo, entendemos —al igual que sucede en la generalidad de las tiendas de contenido
          digital— que el derecho de arrepentimiento se considera ejercido con la propia descarga, dado que el
          servicio ya fue prestado en su totalidad. Si todavía no accediste al libro, escribinos a{' '}
          <LegalLink href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</LegalLink>{' '}
          dentro del plazo indicado y gestionamos el reintegro.
        </LegalParagraph>
      </LegalSection>

      <LegalSection id="propiedad-intelectual" title="8. Propiedad intelectual y uso permitido">
        <LegalParagraph>
          Los libros, textos, imágenes y demás contenidos del Sitio están protegidos por la Ley 11.723 de Propiedad
          Intelectual y pertenecen a sus autores/as o a Nuestra Medicina Personal, según corresponda. La compra de
          un libro te otorga una licencia personal, intransferible y no exclusiva para leerlo en tus propios
          dispositivos, para tu uso privado.
        </LegalParagraph>
        <LegalList
          items={[
            'No está permitido reproducir, distribuir, revender, alquilar, prestar públicamente ni poner a disposición de terceros los archivos, en todo o en parte, sin autorización previa por escrito.',
            'No está permitido eliminar avisos de autoría, marcas de agua u otras indicaciones de propiedad de los archivos.',
            'No está permitido usar los contenidos para entrenar modelos de inteligencia artificial ni para otros usos automatizados de extracción masiva, salvo autorización expresa.',
          ]}
        />
      </LegalSection>

      <LegalSection id="naturaleza-contenido" title="9. Naturaleza del contenido">
        <LegalParagraph>
          Los contenidos de Nuestra Medicina Personal (libros, meditaciones, herramientas) tienen fines educativos y
          reflexivos. No constituyen consejo, diagnóstico ni tratamiento médico o psicológico, y no reemplazan la
          atención de un profesional de la salud. Si estás atravesando una situación que requiere atención
          profesional, te recomendamos consultar con quien corresponda.
        </LegalParagraph>
      </LegalSection>

      <LegalSection id="conducta" title="10. Conducta del usuario">
        <LegalParagraph>Al usar el Sitio te comprometés a no:</LegalParagraph>
        <LegalList
          items={[
            'Usar el Sitio con fines ilícitos o contrarios a estos Términos.',
            'Intentar vulnerar la seguridad del Sitio o acceder a cuentas de otras personas.',
            'Cargar reseñas, comentarios o contenido que sea difamatorio, discriminatorio, engañoso o que constituya spam.',
            'Usar bots, scraping u otros medios automatizados para extraer contenido del Sitio sin autorización.',
          ]}
        />
      </LegalSection>

      <LegalSection id="disponibilidad" title="11. Disponibilidad del servicio">
        <LegalParagraph>
          Hacemos esfuerzos razonables para mantener el Sitio disponible, pero no garantizamos que funcione de
          manera ininterrumpida o libre de errores. Podemos suspender el acceso temporalmente por tareas de
          mantenimiento, actualizaciones o causas fuera de nuestro control.
        </LegalParagraph>
      </LegalSection>

      <LegalSection id="responsabilidad" title="12. Limitación de responsabilidad">
        <LegalParagraph>
          En la medida permitida por la ley aplicable, no somos responsables por daños indirectos derivados del uso
          o la imposibilidad de uso del Sitio. Nada en esta sección limita los derechos que la Ley 24.240 reconoce
          a los consumidores y que no pueden renunciarse por contrato.
        </LegalParagraph>
      </LegalSection>

      <LegalSection id="modificaciones" title="13. Modificaciones a estos Términos">
        <LegalParagraph>
          Podemos actualizar estos Términos para reflejar cambios en el Servicio o en la normativa aplicable. Vamos
          a publicar la fecha de la última actualización al inicio de esta página. Si los cambios son
          significativos, intentaremos avisarte por correo electrónico o mediante un aviso en el Sitio. El uso
          continuado del Servicio después de una actualización implica la aceptación de los nuevos Términos.
        </LegalParagraph>
      </LegalSection>

      <LegalSection id="ley-jurisdiccion" title="14. Ley aplicable y jurisdicción">
        <LegalParagraph>
          Estos Términos se rigen por las leyes de la República Argentina. Para cualquier controversia, y conforme
          al artículo 36 de la Ley 24.240, será competente el tribunal correspondiente al domicilio del/de la
          consumidor/a, sin perjuicio de que puedas optar por otro fuero cuando la ley te lo permita.
        </LegalParagraph>
      </LegalSection>

      <LegalSection id="contacto" title="15. Contacto">
        <LegalParagraph>
          Ante cualquier consulta, reclamo o para ejercer el derecho de arrepentimiento, escribinos a{' '}
          <LegalLink href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</LegalLink>
          .
        </LegalParagraph>
      </LegalSection>
    </LegalPage>
  );
}
