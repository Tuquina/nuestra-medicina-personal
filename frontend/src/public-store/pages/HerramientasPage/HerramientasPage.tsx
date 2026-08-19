import { ComingSoonCollectionPage } from '../../components/ComingSoonCollectionPage/ComingSoonCollectionPage';

/** `/herramientas` — built from Herramientas.dc.html. */
export function HerramientasPage() {
  return (
    <ComingSoonCollectionPage
      title="Caja de herramientas personales"
      description="Recursos simples para sostener la escritura y la reflexión en el día a día."
      eyebrowColor="var(--color-accent-gold)"
      glowColor="var(--color-accent-amber-soft)"
      cards={[
        {
          title: 'Registro de escritura diaria',
          description: 'Una plantilla simple para escribir unos minutos cada día.',
          imageAccent: 'color-mix(in oklch, var(--color-accent-gold) 45%, transparent)',
          imageCaption: 'Foto — cuaderno abierto',
        },
        {
          title: 'Preguntas para reflexionar',
          description: 'Un set de preguntas para volver sobre la propia semana.',
          imageAccent: 'color-mix(in oklch, var(--color-sky) 60%, transparent)',
          imageCaption: 'Foto — ventana y luz suave',
        },
        {
          title: 'Ritual de cierre semanal',
          description: 'Un pequeño ritual para cerrar la semana con más calma.',
          imageAccent: 'var(--color-accent-amber-soft)',
          imageCaption: 'Foto — atardecer cálido',
        },
      ]}
    />
  );
}
