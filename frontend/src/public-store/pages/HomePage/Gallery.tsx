import { ImagePlaceholder } from '../../../shared/components/ImagePlaceholder/ImagePlaceholder';
import styles from './Gallery.module.css';

const TILES = [
  { accent: 'var(--color-sky-pale)', caption: 'Naturaleza en calma' },
  { accent: 'var(--color-accent-amber-soft)', caption: 'El amanecer' },
  {
    accent: 'oklch(32% 0.06 254)',
    base: 'oklch(45% 0.05 254)',
    caption: 'Cielo estrellado',
  },
  { accent: 'var(--color-accent-amber-soft)', caption: 'Una tarde en el pasto' },
  { accent: 'var(--color-sky-pale)', caption: 'Gratitud en la mesa' },
  { accent: 'var(--color-accent-amber-soft)', caption: 'Asombro frente a lo vivo' },
];

/** The "vida cotidiana" photo collage introduced in architecture.md §1.3. */
export function Gallery() {
  return (
    <section className={styles.section} aria-label="Galería de naturaleza y vida">
      <div className={styles.grid}>
        {TILES.map((tile) => (
          <ImagePlaceholder
            key={tile.caption}
            className={styles.tile}
            accent={tile.accent}
            base={tile.base}
            caption={tile.caption}
          />
        ))}
      </div>
    </section>
  );
}
