import { NewsletterSignup } from '../../../shared/components/NewsletterSignup/NewsletterSignup';

export function Newsletter() {
  return (
    <NewsletterSignup
      sectionId="novedades"
      title="Recibí nuestras novedades"
      subtitle="Nuevos libros, meditaciones y contenidos directamente en tu correo."
      buttonLabel="Quiero recibir novedades"
      confirmationText="Gracias — ya estás suscripto/a. Podés darte de baja cuando quieras."
      fineprint="Podés darte de baja cuando quieras. Nunca compartimos tu correo."
    />
  );
}
