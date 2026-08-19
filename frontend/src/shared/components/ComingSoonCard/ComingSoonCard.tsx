import { ImagePlaceholder } from '../ImagePlaceholder/ImagePlaceholder';
import styles from './ComingSoonCard.module.css';

interface ComingSoonCardProps {
  title: string;
  description: string;
  imageAccent: string;
  imageBase?: string;
  imageCaption: string;
}

/** A single "content coming soon" preview card (Meditaciones/Herramientas grids). */
export function ComingSoonCard({ title, description, imageAccent, imageBase, imageCaption }: ComingSoonCardProps) {
  return (
    <article className={styles.card}>
      <ImagePlaceholder
        className={styles.cover}
        accent={imageAccent}
        base={imageBase}
        caption={imageCaption}
        aspectRatio="4 / 3"
      />
      <h3 className={styles.title}>{title}</h3>
      <p className={styles.description}>{description}</p>
      <span className={styles.badge}>Próximamente</span>
    </article>
  );
}
