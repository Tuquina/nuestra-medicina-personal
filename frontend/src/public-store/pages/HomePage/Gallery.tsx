import { ImagePlaceholder } from '../../../shared/components/ImagePlaceholder/ImagePlaceholder';
import type { GalleryProps } from '../../../shared/cms/homeContent';
import styles from './Gallery.module.css';

/** Decorative accents rotate through this fixed palette by tile index —
 * editable content is just the caption, colors stay a design decision. */
const PALETTE = [
  { accent: 'var(--color-sky-pale)' },
  { accent: 'var(--color-accent-amber-soft)' },
  { accent: 'oklch(32% 0.06 254)', base: 'oklch(45% 0.05 254)' },
  { accent: 'var(--color-accent-amber-soft)' },
  { accent: 'var(--color-sky-pale)' },
  { accent: 'var(--color-accent-amber-soft)' },
];

/** The "vida cotidiana" photo collage introduced in architecture.md §1.3. */
export function Gallery({ captions }: GalleryProps) {
  return (
    <section className={styles.section} aria-label="Galería de naturaleza y vida">
      <div className={styles.grid}>
        {captions.map((caption, i) => {
          const tile = PALETTE[i % PALETTE.length];
          return (
            <ImagePlaceholder
              key={`${caption}-${i}`}
              className={styles.tile}
              accent={tile.accent}
              base={tile.base}
              caption={caption}
            />
          );
        })}
      </div>
    </section>
  );
}
