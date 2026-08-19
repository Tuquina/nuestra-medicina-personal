import { ComingSoonCollectionPage } from '../../components/ComingSoonCollectionPage/ComingSoonCollectionPage';

/** `/meditaciones` — built from Meditaciones.dc.html. */
export function MeditacionesPage() {
  return (
    <ComingSoonCollectionPage
      title="Meditaciones"
      description="Prácticas breves para volver a habitar el cuerpo y la respiración."
      eyebrowColor="var(--color-sky)"
      glowColor="var(--color-sky)"
      cards={[
        {
          title: 'Respirar y empezar',
          description: 'Una práctica breve para empezar el día con más calma.',
          imageAccent: 'var(--color-sky-pale)',
          imageCaption: 'Foto — amanecer en calma',
        },
        {
          title: 'Volver al cuerpo',
          description: 'Un ejercicio simple de atención para momentos de tensión.',
          imageAccent: 'var(--color-accent-amber-soft)',
          imageCaption: 'Foto — manos y luz cálida',
        },
        {
          title: 'Antes de dormir',
          description: 'Una pausa para soltar el día antes de descansar.',
          imageAccent: 'oklch(32% 0.06 254)',
          imageBase: 'oklch(45% 0.05 254)',
          imageCaption: 'Foto — cielo nocturno',
        },
      ]}
    />
  );
}
