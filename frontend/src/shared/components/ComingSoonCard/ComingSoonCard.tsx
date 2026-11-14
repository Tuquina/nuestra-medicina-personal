import { CmsImage } from '../CmsImage/CmsImage';
import styles from './ComingSoonCard.module.css';

interface ComingSoonCardProps {
  title: string;
  description: string;
  imageAccent: string;
  imageBase?: string;
  imageCaption: string;
  imageId?: string;
}

/** A single "content coming soon" preview card (Meditaciones/Herramientas grids). */
export function ComingSoonCard({ title, description, imageAccent, imageBase, imageCaption, imageId }: ComingSoonCardProps) {
  return (
    <article className={styles.card}>
      <CmsImage imageId={imageId}
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
